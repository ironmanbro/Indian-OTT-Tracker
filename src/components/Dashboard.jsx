// Dashboard container: owns filter/picker/drawer state, derives everything from (movies, subs, log).
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { DashboardHeader, FilterBar, HudStats, Rise } from './DashboardHUD.jsx';
import ConstellationGraph from './ConstellationGraph.jsx';
import MovieCard from './MovieCard.jsx';
import DetailDrawer from './DetailDrawer.jsx';
import NextMoviePicker from './NextMoviePicker.jsx';
import ProfilePanel from './ProfilePanel.jsx';
import { useMovieRecommender } from '../hooks/useMovieRecommender.js';
import { getAccess } from '../lib/access.js';
import { GRAPH_MAX } from '../lib/constants.js';
import { pickDiverseDeck } from '../lib/deck.js';
import { fmtDuration } from '../lib/format.js';
import { recommend } from '../lib/recommend.js';

export function Dashboard({ movies, source, subs, setSubs, log, setLog, onRetake }) {
  // filters
  const [freeOnly, setFreeOnly] = useState(false);
  const [onMySubs, setOnMySubs] = useState(false);
  const [imdb8, setImdb8] = useState(false);
  const [query, setQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const deferredQuery = useDeferredValue(query); // typing stays instant while the chart re-filters
  const [limit, setLimit] = useState(40); // catalog cards rendered; "Load more" extends it
  // picker + drawer
  const [selectedId, setSelectedId] = useState(null);
  const [pickGenres, setPickGenres] = useState(() => new Set());
  const [maxRuntime, setMaxRuntime] = useState(0);
  const [accessOnly, setAccessOnly] = useState(true);
  const [pickedId, setPickedId] = useState(null);
  const [skipped, setSkipped] = useState(() => new Set());

  const genresList = useMemo(() => [...new Set(movies.flatMap((mv) => mv.genres))].sort(), [movies]);

  const toggleSub = useCallback((p) => setSubs((prev) => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; }), [setSubs]);
  const toggleWatched = useCallback((id) => setLog((prev) => {
    if (prev[id]?.watched) { const { [id]: _drop, ...rest } = prev; return rest; } // unwatching clears the rating
    return { ...prev, [id]: { watched: true, rating: 0 } };
  }), [setLog]);
  const rate = useCallback((id, rating) => setLog((prev) => ({ ...prev, [id]: { watched: true, rating } })), [setLog]);
  const closeDrawer = useCallback(() => setSelectedId(null), []);

  const toggleGenre = useCallback((g) => {
    setPickedId(null);
    setPickGenres((prev) => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });
  }, []);
  const changeRuntime = useCallback((v) => { setPickedId(null); setMaxRuntime(v); }, []);
  const changeAccessOnly = useCallback((v) => { setPickedId(null); setAccessOnly(v); }, []);
  const clearPicker = useCallback(() => { setPickedId(null); setPickGenres(new Set()); setMaxRuntime(0); setSkipped(new Set()); }, []);
  const resetSkipped = useCallback(() => setSkipped(new Set()), []);
  const resetFilters = useCallback(() => { setQuery(''); setGenreFilter(''); setImdb8(false); setFreeOnly(false); setOnMySubs(false); }, []);

  // ── derived data ──
  const accessMap = useMemo(() => new Map(movies.map((mv) => [mv.id, getAccess(mv, subs)])), [movies, subs]); // subs only

  // TF-IDF / cosine taste engine → brightness + proximity in the graph, and the picker's taste score
  const rec = useMovieRecommender(movies, log);
  const { similarity, whyFor, topFeatures } = rec;

  const visibleMovies = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    // search, genre and IMDb are AND filters; the two access toggles combine with OR ("watchable without extra cost")
    return movies.filter((mv) => {
      if (genreFilter && !mv.genres.includes(genreFilter)) return false;
      if (imdb8 && !(mv.imdb_rating >= 8)) return false;
      if (q && !mv.title.toLowerCase().includes(q) && !mv.genres.some((g) => g.toLowerCase().includes(q))) return false;
      if (!freeOnly && !onMySubs) return true;
      const a = accessMap.get(mv.id);
      return (freeOnly && a.isFree) || (onMySubs && a.isIncluded);
    });
  }, [movies, deferredQuery, genreFilter, imdb8, freeOnly, onMySubs, accessMap]);
  const visibleIds = useMemo(() => new Set(visibleMovies.map((x) => x.id)), [visibleMovies]);

  const stats = useMemo(() => {
    let count = 0, minutes = 0, ratingSum = 0, rated = 0;
    for (const mv of movies) {
      const e = log[mv.id];
      if (!e?.watched) continue;
      count++; minutes += mv.runtime;
      if (e.rating) { ratingSum += e.rating; rated++; }
    }
    return { count, minutes, avg: rated ? (ratingSum / rated).toFixed(1) : '—' };
  }, [movies, log]);

  const recs = useMemo(
    () => recommend(movies, log, accessMap, { genres: pickGenres, maxRuntime, accessOnly, skipped, similarity, whyFor }),
    [movies, log, accessMap, pickGenres, maxRuntime, accessOnly, skipped, similarity, whyFor],
  );
  const recRank = useMemo(() => new Map(recs.slice(0, 3).map((r, i) => [r.movie.id, i])), [recs]);
  const criteriaActive = pickGenres.size > 0 || maxRuntime > 0;
  const focusIds = useMemo(() => (criteriaActive ? new Set(recs.map((r) => r.movie.id)) : null), [criteriaActive, recs]);

  // score-weighted random among the top 3 candidates
  const pickFrom = (list) => {
    const pool = list.slice(0, 3);
    if (!pool.length) return null;
    let t = Math.random() * pool.reduce((s, r) => s + r.score, 0);
    return (pool.find((r) => (t -= r.score) <= 0) || pool[0]).movie.id;
  };
  const surprise = useCallback(() => setPickedId(pickFrom(recs)), [recs]);
  const notInTheMood = useCallback(() => {
    if (!pickedId) return;
    setSkipped((prev) => new Set(prev).add(pickedId));
    setPickedId(pickFrom(recs.filter((r) => r.movie.id !== pickedId)));
  }, [recs, pickedId]);

  // Graph set: a genre-diverse slice (≤ GRAPH_MAX) + anything you've watched, so a big catalog never explodes the graph
  const baseGraph = useMemo(() => pickDiverseDeck(movies, GRAPH_MAX, 250), [movies]);
  const extraKey = useMemo(() => {
    const inBase = new Set(baseGraph.map((x) => x.id));
    return movies.filter((mv) => log[mv.id]?.watched && !inBase.has(mv.id)).map((mv) => mv.id).join('|');
  }, [movies, baseGraph, log]);
  const graphMovies = useMemo(() => {
    if (!extraKey) return baseGraph;
    const extra = new Set(extraKey.split('|'));
    return [...baseGraph, ...movies.filter((mv) => extra.has(mv.id))];
  }, [baseGraph, extraKey, movies]);

  // ticker aggregates
  const ticker = useMemo(() => {
    const open = movies.filter((mv) => accessMap.get(mv.id).accessible && !log[mv.id]?.watched);
    return {
      accessible: movies.filter((mv) => accessMap.get(mv.id).accessible).length,
      free: movies.filter((mv) => accessMap.get(mv.id).isFree).length,
      top: movies.filter((mv) => mv.imdb_rating >= 8).length,
      backlog: open.reduce((t, mv) => t + mv.runtime, 0),
      leaders: open.filter((mv) => mv.imdb_rating).sort((a, b) => b.imdb_rating - a.imdb_rating).slice(0, 8),
    };
  }, [movies, accessMap, log]);

  const selected = selectedId ? movies.find((x) => x.id === selectedId) : null;
  const hasRatings = movies.some((mv) => mv.imdb_rating);

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,.10),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(217,70,239,.10),transparent_45%)] text-slate-200 antialiased selection:bg-cyan-400/30">
      <style>{`
        @keyframes ottTwinkle { 0%,100% { opacity:.55 } 50% { opacity:1 } }
        .ott-twinkle { animation: ottTwinkle 3.5s ease-in-out infinite; }
        @keyframes ottSlide { from { transform: translateX(100%) } to { transform: none } }
        .ott-slide { animation: ottSlide .25s ease-out; }
        @keyframes ottPulse { 0%,100% { opacity:1 } 50% { opacity:.3 } }
        .ott-pulse { animation: ottPulse 1.6s ease-in-out infinite; }
        @keyframes ottMarquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .ott-marquee { animation: ottMarquee 45s linear infinite; }
        .ott-marquee:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .ott-twinkle, .ott-slide, .ott-pulse, .ott-marquee { animation: none; } }
      `}</style>

      <DashboardHeader source={source} subs={subs} onToggleSub={toggleSub} onRetake={onRetake} ticker={ticker} />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        <Rise><HudStats stats={stats} total={movies.length} accessible={ticker.accessible} /></Rise>
        <Rise delay={0.05}><ProfilePanel movies={movies} log={log} learned={topFeatures} /></Rise>
        <Rise delay={0.1}>
          <NextMoviePicker
            genresList={genresList} recs={recs} pickGenres={pickGenres} maxRuntime={maxRuntime} accessOnly={accessOnly}
            pickedId={pickedId} criteriaActive={criteriaActive}
            onToggleGenre={toggleGenre} onRuntime={changeRuntime} onAccessOnly={changeAccessOnly} onClear={clearPicker}
            onSurprise={surprise} onSkip={notInTheMood} skippedCount={skipped.size} onResetSkipped={resetSkipped}
            onOpen={setSelectedId} onMarkWatched={toggleWatched}
          />
        </Rise>
        <Rise delay={0.15}>
          <FilterBar
            f={{ onMySubs, freeOnly, imdb8, query, genre: genreFilter }}
            set={{ onMySubs: setOnMySubs, freeOnly: setFreeOnly, imdb8: setImdb8, query: setQuery, genre: setGenreFilter, reset: resetFilters }}
            genresList={genresList} shown={visibleMovies.length} total={movies.length} hasRatings={hasRatings}
          />
        </Rise>

        <Rise delay={0.2}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section aria-label="Movie constellation">
              <h2 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Constellation discovery graph</h2>
              <ConstellationGraph movies={graphMovies} accessMap={accessMap} log={log} visibleIds={visibleIds} onSelect={setSelectedId} recRank={recRank} focusIds={focusIds} similarity={similarity} />
            </section>

            <section aria-label="Catalog">
              <h2 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Catalog <span className="text-slate-600">({visibleMovies.length}/{movies.length})</span>
              </h2>
              <div className="grid max-h-[640px] gap-2 overflow-y-auto pr-1">
                {visibleMovies.length === 0 && (
                  <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No matches. Add a subscription or relax the filters.</p>
                )}
                {visibleMovies.slice(0, limit).map((mv) => (
                  <MovieCard key={mv.id} movie={mv} access={accessMap.get(mv.id)} entry={log[mv.id]} onToggleWatched={toggleWatched} onRate={rate} onOpen={setSelectedId} />
                ))}
                {visibleMovies.length > limit && (
                  <button onClick={() => setLimit((n) => n + 40)} className="rounded-xl border border-white/10 py-2 font-mono text-xs text-cyan-300 hover:bg-white/5">
                    LOAD MORE · {visibleMovies.length - limit} remaining
                  </button>
                )}
              </div>
            </section>
          </div>
        </Rise>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 font-mono text-[10px] text-slate-600">
        {source === 'tmdb'
          ? 'This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data provided by JustWatch.' + (hasRatings ? ' IMDb ratings from IMDb\'s non-commercial datasets.' : '')
          : 'Demo data — illustrative availability and approximate IMDb ratings, not live.'}
      </footer>

      <AnimatePresence>
        {selected && (
          <DetailDrawer key={selected.id} movie={selected} access={accessMap.get(selected.id)} entry={log[selected.id]} signal={similarity.get(selected.id)} onClose={closeDrawer} onToggleWatched={toggleWatched} onRate={rate} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default Dashboard;
