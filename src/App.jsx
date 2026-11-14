'use client';
/**
 * CineTerminal IN — India Cinema Tracker: swipe onboarding + trading-terminal dashboard (single-file)
 * Deps: react, d3, framer-motion (npm i d3 framer-motion), Tailwind CSS v3+.
 * Next.js: save as app/page.jsx (or import into a page). No API keys; all data is mock.
 * NOTE: platform availability below is illustrative sample data, not live/verified.
 */
import React, { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, memo } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY,
} from 'd3';

/* ───────────────────────── Mock data ───────────────────────── */

// Inline SVG placeholder poster (no network needed)
const poster = (title, hue) => {
  const t = title.length > 22 ? title.slice(0, 21) + '…' : title;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},70%,35%)'/><stop offset='1' stop-color='hsl(${(hue + 50) % 360},60%,10%)'/></linearGradient></defs><rect width='300' height='450' fill='url(#g)'/><text x='150' y='235' fill='white' fill-opacity='.9' font-family='sans-serif' font-size='24' font-weight='700' text-anchor='middle'>${t.replace(/&/g, '&amp;')}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Demo-only: director names are public facts; IMDb ratings are APPROXIMATE sample values so the
// "IMDb 8.0+" filter has something to show. Real ratings come from sync_india_movies.py.
const m = (id, title, genres, runtime, flatrate, free, hue, director, imdb) => ({
  id, title, genres, runtime, platforms: { flatrate, free }, poster: poster(title, hue),
  director, imdb_rating: imdb, imdb_votes: null,
});

const MOCK_MOVIES = [
  m('1', 'RRR', ['Action', 'Drama', 'Period'], 187, ['Netflix', 'Zee5'], [], 10, 'S. S. Rajamouli', 7.8),
  m('2', '3 Idiots', ['Comedy', 'Drama'], 170, ['Amazon Prime Video'], ['YouTube'], 200, 'Rajkumar Hirani', 8.4),
  m('3', 'Dangal', ['Drama', 'Sports', 'Biopic'], 161, ['Netflix', 'JioHotstar'], [], 30, 'Nitesh Tiwari', 8.3),
  m('4', 'Gully Boy', ['Drama', 'Music'], 153, ['Amazon Prime Video'], ['MX Player'], 280, 'Zoya Akhtar', 7.9),
  m('5', 'Drishyam', ['Thriller', 'Crime', 'Drama'], 163, ['JioHotstar'], ['JioCinema'], 160, 'Nishikant Kamat', 8.2),
  m('6', 'Andhadhun', ['Thriller', 'Comedy', 'Crime'], 139, ['Netflix', 'JioHotstar'], [], 340, 'Sriram Raghavan', 8.2),
  m('7', 'Kantara', ['Action', 'Thriller', 'Folk'], 148, ['Amazon Prime Video'], [], 40, 'Rishab Shetty', 8.2),
  m('8', 'Lagaan', ['Drama', 'Sports', 'Period'], 224, ['Netflix'], ['YouTube'], 90, 'Ashutosh Gowariker', 8.1),
  m('9', 'Inception', ['Sci-Fi', 'Action', 'Thriller'], 148, ['JioHotstar', 'SonyLIV'], [], 220, 'Christopher Nolan', 8.8),
  m('10', 'Parasite', ['Thriller', 'Drama', 'Comedy'], 132, ['SonyLIV'], ['MX Player'], 130, 'Bong Joon-ho', 8.5),
  m('11', 'Oppenheimer', ['Biopic', 'Drama', 'Period'], 180, ['Amazon Prime Video', 'JioHotstar'], [], 20, 'Christopher Nolan', 8.3),
  m('12', 'Jawan', ['Action', 'Thriller'], 169, ['Netflix', 'Zee5'], ['JioCinema'], 350, 'Atlee', 7.0),
  m('13', 'Zindagi Na Milegi Dobara', ['Comedy', 'Drama', 'Romance'], 155, ['Netflix'], [], 190, 'Zoya Akhtar', 8.1),
  m('14', 'Queen', ['Comedy', 'Drama', 'Romance'], 146, ['Amazon Prime Video'], ['YouTube'], 320, 'Vikas Bahl', 8.2),
  m('15', 'Tumbbad', ['Horror', 'Fantasy', 'Folk'], 104, ['Amazon Prime Video'], [], 150, 'Rahi Anil Barve', 8.2),
  m('16', 'Stree', ['Horror', 'Comedy'], 128, ['Amazon Prime Video', 'JioHotstar'], [], 300, 'Amar Kaushik', 7.5),
  m('17', 'Baahubali: The Beginning', ['Action', 'Fantasy', 'Period'], 159, ['Netflix', 'JioHotstar'], [], 60, 'S. S. Rajamouli', 8.0),
  m('18', 'Pather Panchali', ['Drama', 'Classic'], 125, [], ['YouTube'], 70, 'Satyajit Ray', 8.2),
  m('19', 'Kahaani', ['Thriller', 'Mystery'], 122, ['Amazon Prime Video'], ['MX Player'], 250, 'Sujoy Ghosh', 8.1),
  m('20', 'Bajrangi Bhaijaan', ['Drama', 'Comedy'], 163, ['Zee5', 'Netflix'], [], 120, 'Kabir Khan', 8.1),
  m('21', 'Super Deluxe', ['Comedy', 'Crime', 'Drama'], 176, ['SonyLIV'], [], 310, 'Thiagarajan Kumararaja', 8.4),
  m('22', 'Manjummel Boys', ['Thriller', 'Adventure'], 135, ['JioHotstar'], [], 170, 'Chidambaram', 8.2),
  m('23', 'Interstellar', ['Sci-Fi', 'Drama', 'Adventure'], 169, ['Netflix', 'JioHotstar'], [], 230, 'Christopher Nolan', 8.7),
  m('24', 'Gangs of Wasseypur', ['Crime', 'Action', 'Drama'], 160, ['Zee5', 'Amazon Prime Video'], ['MX Player'], 5, 'Anurag Kashyap', 8.2),
  m('25', 'Pushpa: The Rise', ['Action', 'Crime', 'Drama'], 179, ['Amazon Prime Video'], [], 100, 'Sukumar', 7.6),
];

const PLATFORMS = ['Netflix', 'Amazon Prime Video', 'JioHotstar', 'Zee5', 'SonyLIV', 'JioCinema'];
const STORAGE_KEY = 'cineterminal-in-v1';
const DECK_SIZE = 25;

// Search deep-links per provider (TMDB's API only gives a JustWatch page per region, not per-app URLs).
// NOTE: these URL patterns are best-effort and unverified — confirm them before launch.
const PLATFORM_SEARCH = {
  Netflix: (q) => `https://www.netflix.com/search?q=${q}`,
  'Amazon Prime Video': (q) => `https://www.primevideo.com/search/?phrase=${q}`,
  JioHotstar: (q) => `https://www.hotstar.com/in/search?q=${q}`,
  Zee5: (q) => `https://www.zee5.com/search?q=${q}`,
  SonyLIV: (q) => `https://www.sonyliv.com/search?searchTerm=${q}`,
  JioCinema: (q) => `https://www.jiocinema.com/search/${q}`,
  YouTube: (q) => `https://www.youtube.com/results?search_query=${q}`,
  'MX Player': (q) => `https://www.mxplayer.in/search?q=${q}`,
};
const providerLink = (provider, title) =>
  PLATFORM_SEARCH[provider]
    ? PLATFORM_SEARCH[provider](encodeURIComponent(title))
    : `https://www.google.com/search?q=${encodeURIComponent(`watch ${title} on ${provider}`)}`;

/* ───────────────────────── Helpers ───────────────────────── */

const fmtDuration = (mins) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;

/** Access info for one movie given the set of active subscriptions. Pure → memoizable. */
function getAccess(movie, subs) {
  const included = movie.platforms.flatrate.filter((p) => subs.has(p));
  // A free listing on a platform you also subscribe to counts as "free" too
  const free = movie.platforms.free;
  return {
    included,
    free,
    isIncluded: included.length > 0,
    isFree: free.length > 0,
    // green star = on my sub OR free
    accessible: included.length > 0 || free.length > 0,
    requires: movie.platforms.flatrate.filter((p) => !subs.has(p)),
  };
}

const sharedGenres = (a, b) => a.genres.filter((g) => b.genres.includes(g));

/**
 * Similarity (0..1) of every movie to the titles you rated.
 * Genre affinity = mean of (rating-3)/2 per genre. If you have ≥1 four/five-star title, blend in the
 * best Jaccard genre overlap with those favourites. Drives the size of UNWATCHED stars.
 */
function computeSimilarity(movies, log) {
  const sum = {}, cnt = {};
  const liked = [];
  for (const mv of movies) {
    const e = log[mv.id];
    if (!e?.watched || !e.rating) continue;
    if (e.rating >= 4) liked.push(mv);
    for (const g of mv.genres) { sum[g] = (sum[g] || 0) + (e.rating - 3) / 2; cnt[g] = (cnt[g] || 0) + 1; }
  }
  const out = new Map();
  for (const mv of movies) {
    const taste = mv.genres.reduce((t, g) => t + (cnt[g] ? sum[g] / cnt[g] : 0), 0) / mv.genres.length;
    const taste01 = (taste + 1) / 2;
    let best = 0;
    for (const l of liked) {
      if (l.id === mv.id) continue;
      const inter = sharedGenres(mv, l).length;
      best = Math.max(best, inter / (mv.genres.length + l.genres.length - inter));
    }
    out.set(mv.id, liked.length ? 0.6 * taste01 + 0.4 * best : taste01);
  }
  return out;
}

const RUNTIME_OPTIONS = [
  { label: 'Any length', value: 0 },
  { label: '≤ 2h', value: 120 },
  { label: '≤ 2h 30m', value: 150 },
  { label: '≤ 3h', value: 180 },
];

/**
 * Rank unwatched movies for the "what next?" picker.
 * score = 40% genre match + 25% personal taste + 20% accessibility + 15% IMDb quality (all 0..1)
 *  - IMDb quality: rating mapped 5→0 … 9→1; neutral 0.5 when the movie has no rating
 *  - genre match: share of the chosen genres the movie covers (neutral 0.5 if none chosen)
 *  - taste: avg per-genre affinity learned from YOUR ratings ((rating-3)/2 → -1..1); neutral if nothing rated
 *  - access: on your subs = 1, free = 0.9, else 0
 * Hard filters: not already watched, runtime cap, (optional) must be watchable now, must hit ≥1 chosen genre.
 */
function recommend(movies, log, accessMap, { genres, maxRuntime, accessOnly, skipped }) {
  const sum = {}, cnt = {};
  for (const mv of movies) {
    const e = log[mv.id];
    if (!e?.watched || !e.rating) continue;
    for (const g of mv.genres) {
      sum[g] = (sum[g] || 0) + (e.rating - 3) / 2;
      cnt[g] = (cnt[g] || 0) + 1;
    }
  }
  const affinity = (g) => (cnt[g] ? sum[g] / cnt[g] : 0);

  const out = [];
  for (const mv of movies) {
    if (log[mv.id]?.watched || skipped.has(mv.id)) continue;
    if (maxRuntime && mv.runtime > maxRuntime) continue;
    const acc = accessMap.get(mv.id);
    if (accessOnly && !acc.accessible) continue;
    const matched = mv.genres.filter((g) => genres.has(g));
    if (genres.size && !matched.length) continue;

    const genreScore = genres.size ? matched.length / Math.min(genres.size, mv.genres.length) : 0.5;
    const taste = mv.genres.reduce((s, g) => s + affinity(g), 0) / mv.genres.length;
    const accessScore = acc.isIncluded ? 1 : acc.isFree ? 0.9 : 0;
    const quality = mv.imdb_rating ? Math.min(1, Math.max(0, (mv.imdb_rating - 5) / 4)) : 0.5;
    const score = 0.4 * genreScore + 0.25 * ((taste + 1) / 2) + 0.2 * accessScore + 0.15 * quality;

    const reasons = [];
    if (matched.length) reasons.push(`Matches ${matched.join(' + ')}`);
    const loved = mv.genres.filter((g) => affinity(g) > 0.25);
    const disliked = mv.genres.filter((g) => affinity(g) < -0.25);
    if (loved.length) reasons.push(`You rate ${loved.join('/')} highly`);
    if (disliked.length) reasons.push(`⚠ You rated ${disliked.join('/')} low`);
    if (mv.imdb_rating >= 7.5) reasons.push(`IMDb ${mv.imdb_rating.toFixed(1)}`);
    if (acc.isIncluded) reasons.push(`On your ${acc.included[0]}`);
    else if (acc.isFree) reasons.push(`Free on ${acc.free[0]}`);
    else reasons.push(`Needs ${acc.requires[0]} sub`);

    out.push({ movie: mv, score, pct: Math.round(score * 100), reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.movie.runtime - b.movie.runtime);
}

/* ───────────────────────── Small UI pieces ───────────────────────── */

/** IMDb rating chip — renders nothing when the catalog has no rating (e.g. demo data). */
const ImdbBadge = memo(function ImdbBadge({ movie, className = '' }) {
  if (!movie.imdb_rating) return null;
  const v = movie.imdb_votes;
  const votes = v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : v;
  return (
    <span
      title={`IMDb rating${v ? `, ${v.toLocaleString('en-IN')} votes` : ''}`}
      className={`inline-flex items-center gap-1 rounded bg-yellow-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-300 ring-1 ring-yellow-400/25 ${className}`}
    >
      <span className="rounded-sm bg-yellow-400 px-0.5 text-[8px] font-black leading-tight text-black">IMDb</span>
      {movie.imdb_rating.toFixed(1)}{votes ? <span className="font-normal text-yellow-200/60">· {votes}</span> : null}
    </span>
  );
});

const Star = ({ filled, className = '' }) => (
  <svg viewBox="0 0 20 20" className={`h-4 w-4 ${className}`} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
    <path d="M10 1.8l2.4 5.2 5.6.7-4.2 3.8 1.2 5.6L10 14.4 5 17.1l1.2-5.6L2 7.7l5.6-.7L10 1.8z" strokeLinejoin="round" />
  </svg>
);

const StarRating = memo(function StarRating({ value, onChange, size = '' }) {
  return (
    <div className="inline-flex gap-0.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(value === n ? 0 : n)}
          className={`transition-transform hover:scale-125 ${n <= value ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-300'}`}
        >
          <Star filled={n <= value} className={size} />
        </button>
      ))}
    </div>
  );
});

const Badges = memo(function Badges({ access }) {
  const tag = 'rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ring-1';
  return (
    <div className="flex flex-wrap gap-1">
      {access.isIncluded && (
        <span className={`${tag} bg-emerald-400/10 text-emerald-300 ring-emerald-400/40 shadow-[0_0_12px_-4px_rgba(52,211,153,.9)]`}>
          [✓ Stream on {access.included.join(' / ')}]
        </span>
      )}
      {access.isFree && (
        <span className={`${tag} bg-sky-400/10 text-sky-300 ring-sky-400/40`}>[Watch FREE on {access.free.join(' / ')}]</span>
      )}
      {!access.isIncluded && access.requires.length > 0 && (
        <span className={`${tag} bg-slate-400/10 text-slate-400 ring-slate-400/30`}>[🔒 Requires {access.requires.join(' / ')}]</span>
      )}
    </div>
  );
});

/* ───────────────────────── Movie card (memoized) ───────────────────────── */

const MovieCard = memo(function MovieCard({ movie, access, entry, onToggleWatched, onRate, onOpen }) {
  const watched = !!entry?.watched;
  return (
    <article
      className={`group flex gap-3 rounded-xl border p-2.5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/50 hover:shadow-[0_0_24px_-10px_rgba(34,211,238,.8)] ${
        watched ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-white/10 bg-white/5'
      }`}
    >
      <button type="button" onClick={() => onOpen(movie.id)} className="relative shrink-0 overflow-hidden rounded-lg" aria-label={`Details for ${movie.title}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={movie.poster} alt={`${movie.title} poster`} className="h-32 w-[86px] object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        {movie.imdb_rating ? (
          <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-yellow-400 px-1 py-0.5 font-mono text-[11px] font-black leading-none text-black shadow-lg">
            <span className="text-[8px]">IMDb</span>{movie.imdb_rating.toFixed(1)}
          </span>
        ) : null}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div>
          <h3 className="truncate text-sm font-semibold text-slate-100">{movie.title}</h3>
          <p className="font-mono text-[11px] text-slate-400">
            {fmtDuration(movie.runtime)} · {movie.genres.join(' / ')}
          </p>
        </div>
        <Badges access={access} />
        <div className="mt-auto flex items-center justify-between gap-2">
          <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={watched}
              onChange={() => onToggleWatched(movie.id)}
              className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 accent-cyan-400"
            />
            Watched
          </label>
          {watched && <StarRating value={entry.rating || 0} onChange={(r) => onRate(movie.id, r)} />}
        </div>
      </div>
    </article>
  );
});

/* ───────────────────────── Constellation ───────────────────────── */

const W = 820;
const H = 520;
const GRAPH_MAX = 60; // cap on stars drawn: edges grow O(n²), so a 1,000-movie file must not all go in the graph
const dirsOf = (mv) => (mv.director ? mv.director.split(',').map((x) => x.trim()) : []);

/** Star size: IMDb quality (3.5–12.5 unwatched) and, once watched, your own rating (5★ → ~25). */
function nodeRadius(entry, sim = 0.5, imdb = null) {
  const q = imdb ? Math.min(1, Math.max(0, (imdb - 5) / 4)) : 0.5; // IMDb 5 → 0 … 9 → 1
  if (!entry?.watched) return 3.5 + q * 4 + sim * 5;
  const r = entry.rating || 0;
  return r === 0 ? 8 + q * 2 : 8 + r * 3 + q * 2;
}

const Constellation = memo(function Constellation({ movies, accessMap, log, visibleIds, onSelect, recRank, focusIds, sim }) {
  const [hover, setHover] = useState(null);

  // Faint background star-field (deterministic)
  const field = useMemo(() => {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 70 }, () => ({ x: rnd() * W, y: rnd() * H, r: 0.4 + rnd() * 1.1, o: 0.15 + rnd() * 0.5 }));
  }, []);

  // Layout is computed ONCE per catalog — ratings/filters only restyle nodes, never re-run physics.
  const { nodes, links } = useMemo(() => {
    const ns = movies.map((mv) => ({ id: mv.id, movie: mv }));
    const ls = [];
    for (let i = 0; i < movies.length; i++) {
      for (let j = i + 1; j < movies.length; j++) {
        const g = sharedGenres(movies[i], movies[j]).length;
        const d = dirsOf(movies[i]).some((x) => dirsOf(movies[j]).includes(x));
        if (g || d) ls.push({ source: movies[i].id, target: movies[j].id, shared: g + (d ? 2 : 0), director: d });
      }
    }
    const simu = forceSimulation(ns)
      .force('link', forceLink(ls).id((d) => d.id).distance((d) => Math.max(45, 150 - d.shared * 22)).strength((d) => Math.min(0.3, 0.08 * d.shared)))
      .force('charge', forceManyBody().strength(-420))
      .force('center', forceCenter(W / 2, H / 2))
      .force('x', forceX(W / 2).strength(0.04))
      .force('y', forceY(H / 2).strength(0.07))
      .force('collide', forceCollide(34))
      .stop();
    for (let i = 0; i < 350; i++) simu.tick();
    const padX = 70, padY = 55; // rescale the settled layout to fill the canvas
    const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    ns.forEach((n) => {
      n.x = padX + ((n.x - x0) / (x1 - x0 || 1)) * (W - 2 * padX);
      n.y = padY + ((n.y - y0) / (y1 - y0 || 1)) * (H - 2 * padY);
    });
    return { nodes: ns, links: ls };
  }, [movies]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_center,#0b1b3a_0%,#020617_72%)] shadow-[0_0_50px_-20px_rgba(34,211,238,.45)] [background-size:auto] before:pointer-events-none before:absolute before:inset-0 before:[background-image:linear-gradient(rgba(34,211,238,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.05)_1px,transparent_1px)] before:[background-size:34px_34px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="relative h-auto w-full" role="img" aria-label="Movie constellation chart">
        <defs>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="9" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="edgeGlow" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g aria-hidden="true">
          {field.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#bae6fd" opacity={st.o} />)}
        </g>

        {/* Edges — one glow filter over the whole group (cheap) */}
        <g filter="url(#edgeGlow)">
          {links.map((l) => {
            const a = byId.get(l.source.id ?? l.source);
            const b = byId.get(l.target.id ?? l.target);
            const active = hover && (hover === a.id || hover === b.id);
            const vis = visibleIds.has(a.id) && visibleIds.has(b.id);
            const base = l.director ? '#e879f9' : '#22d3ee';
            return (
              <line
                key={`${a.id}-${b.id}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={active ? '#ecfeff' : base}
                strokeWidth={active ? 1.8 : 0.5 + l.shared * 0.3}
                strokeOpacity={active ? 0.95 : vis ? (l.director ? 0.4 : 0.2) : 0.04}
                style={{ transition: 'stroke-opacity .3s, stroke .3s' }}
              />
            );
          })}
        </g>

        {/* Stars */}
        <g>
          {nodes.map((n, i) => {
            const entry = log[n.id];
            const acc = accessMap.get(n.id);
            const r = nodeRadius(entry, sim.get(n.id), n.movie.imdb_rating);
            const rating = entry?.rating || 0;
            const color = acc.accessible ? '#34d399' : '#94a3b8';
            const visible = visibleIds.has(n.id);
            const glowing = rating >= 4;
            const dim = !entry?.watched;
            const label = n.movie.title.length > 20 ? `${n.movie.title.slice(0, 19)}…` : n.movie.title;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                opacity={visible && (!focusIds || focusIds.has(n.id)) ? 1 : 0.15}
                style={{ transition: 'opacity .3s', cursor: 'pointer', pointerEvents: visible ? 'auto' : 'none' }}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(n.id)}
                tabIndex={0}
                role="button"
                aria-label={`${n.movie.title}${n.movie.imdb_rating ? `, IMDb ${n.movie.imdb_rating}` : ''}${rating ? `, rated ${rating} stars` : ''}`}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(n.id)}
              >
                <circle r={Math.max(r + 10, 18)} fill="transparent" />
                {recRank.has(n.id) && (
                  <g pointerEvents="none">
                    <circle
                      r={r + 10}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={recRank.get(n.id) === 0 ? 2.5 : 1.5}
                      strokeDasharray={recRank.get(n.id) === 0 ? undefined : '4 3'}
                      className={recRank.get(n.id) === 0 ? 'ott-pulse' : ''}
                    />
                    <text y={-r - 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fbbf24">
                      #{recRank.get(n.id) + 1}
                    </text>
                  </g>
                )}
                {rating === 5 && <circle r={r + 6} fill="none" stroke={color} strokeOpacity="0.45" className="ott-pulse" />}
                <circle
                  r={r}
                  fill={color}
                  fillOpacity={dim ? 0.3 + 0.5 * (sim.get(n.id) ?? 0.5) : 0.95}
                  filter={glowing ? 'url(#glow)' : undefined}
                  stroke={hover === n.id ? '#fff' : color}
                  strokeOpacity={hover === n.id ? 1 : 0.5}
                  strokeWidth={hover === n.id ? 2 : 1}
                  className={dim ? 'ott-twinkle' : ''}
                  style={{ animationDelay: `${(i % 6) * 0.5}s`, transition: 'r .4s ease, fill .4s ease' }}
                />
                {rating > 0 && (
                  <path
                    d={`M0 ${-r - 6} L2 -2 L${r + 6} 0 L2 2 L0 ${r + 6} L-2 2 L${-r - 6} 0 L-2 -2 Z`}
                    fill={color}
                    fillOpacity={0.35 + rating * 0.1}
                  />
                )}
                <text y={r + 15} textAnchor="middle" className="select-none fill-slate-300" fontSize="10.5" style={{ paintOrder: 'stroke', fontFamily: 'ui-monospace, monospace' }} stroke="#020617" strokeWidth="3">
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-slate-400">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />on sub / free</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-400" />needs another sub</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full border border-amber-400" />recommended</span>
        <span><i className="mr-1 inline-block h-0.5 w-3 bg-cyan-400" />genre link</span>
        <span><i className="mr-1 inline-block h-0.5 w-3 bg-fuchsia-400" />same director</span>
        <span>size = IMDb + your rating · glow = 4–5★</span>
      </div>
    </div>
  );
});

/* ───────────────────────── Detail drawer ───────────────────────── */

function DetailDrawer({ movie, access, entry, signal, onClose, onToggleWatched, onRate }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const watched = !!entry?.watched;
  const best = access.included[0] || access.free[0];
  const score = movie.imdb_rating;
  const C = 2 * Math.PI * 26;
  const cell = (label, value) => (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-0.5 truncate font-mono text-sm text-slate-100">{value}</p>
    </div>
  );

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={movie.title}
        onClick={(e) => e.stopPropagation()}
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 34 }}
        className="h-full w-full max-w-md overflow-y-auto border-l border-cyan-400/20 bg-slate-950/80 p-5 shadow-[0_0_60px_-15px_rgba(34,211,238,.5)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">
          <span>// title terminal</span>
          <button onClick={onClose} className="rounded px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close">✕ ESC</button>
        </div>

        <div className="mt-4 flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={movie.poster} alt="" className="h-40 w-28 shrink-0 rounded-lg object-cover shadow-lg ring-1 ring-white/10" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-tight text-white">{movie.title}</h2>
            {movie.director && <p className="mt-1 text-xs text-slate-400">Dir. {movie.director}</p>}
            <div className="mt-3 flex items-center gap-3">
              <svg viewBox="0 0 60 60" className="h-16 w-16 -rotate-90" aria-hidden="true">
                <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
                {score ? (
                  <motion.circle
                    cx="30" cy="30" r="26" fill="none" stroke="#facc15" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - score / 10) }}
                    transition={{ duration: 0.9, ease: 'easeOut' }} style={{ filter: 'drop-shadow(0 0 4px rgba(250,204,21,.7))' }}
                  />
                ) : null}
              </svg>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">IMDb rating</p>
                <p className="font-mono text-3xl font-bold text-yellow-300">{score ? score.toFixed(1) : '—'}<span className="text-sm font-normal text-slate-500">/10</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {cell('Runtime', `${fmtDuration(movie.runtime)} · ${movie.runtime}m`)}
          {cell('IMDb votes', movie.imdb_votes ? movie.imdb_votes.toLocaleString('en-IN') : '—')}
          {cell('Taste match', watched ? 'LOGGED' : signal != null ? `${Math.round(signal * 100)}%` : '—')}
          {cell('Access', access.isIncluded ? 'ON YOUR SUBS' : access.isFree ? 'FREE' : 'NEEDS SUB')}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {movie.genres.map((g) => <span key={g} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-300">{g}</span>)}
        </div>

        <h3 className="mb-2 mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Streaming pathways · India</h3>
        {best && (
          <a
            href={providerLink(best, movie.title)}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-[0_0_24px_-6px_rgba(52,211,153,.9)] transition hover:bg-emerald-300"
          >
            ▶ {access.included[0] ? 'Stream' : 'Watch FREE'} on {best}
          </a>
        )}
        <div className="space-y-1.5 text-sm">
          {[...movie.platforms.flatrate.map((p) => [p, 'flat']), ...movie.platforms.free.map((p) => [p, 'free'])].map(([p, kind]) => (
            <a
              key={`${kind}-${p}`}
              href={providerLink(p, movie.title)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between rounded-lg border px-3 py-1.5 transition-colors hover:brightness-125 ${kind === 'free' ? 'border-sky-400/20 bg-sky-400/10' : 'border-white/10 bg-white/5'}`}
            >
              <span className="text-slate-200">{p} <span className="text-slate-500">↗</span></span>
              {kind === 'free' ? <span className="font-mono text-xs text-sky-300">FREE</span>
                : access.included.includes(p) ? <span className="font-mono text-xs text-emerald-300">✓ IN YOUR SUBS</span>
                : <span className="font-mono text-xs text-slate-400">🔒 SUB</span>}
            </a>
          ))}
          {!movie.platforms.flatrate.length && !movie.platforms.free.length && <p className="text-xs text-slate-500">Not streaming in India right now.</p>}
        </div>

        <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={watched} onChange={() => onToggleWatched(movie.id)} className="h-4 w-4 accent-cyan-400" />
            Mark as watched
          </label>
          {watched && (
            <div className="flex items-center gap-3 text-sm text-slate-400">
              Your rating <StarRating value={entry.rating || 0} onChange={(r) => onRate(movie.id, r)} size="!h-5 !w-5" />
            </div>
          )}
        </div>
      </motion.aside>
    </motion.div>
  );
}

/* ───────────────────────── Main component ───────────────────────── */

function Dashboard({ movies, source, subs, setSubs, log, setLog, onRetake }) {
  const [freeOnly, setFreeOnly] = useState(false);
  const [onMySubs, setOnMySubs] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [pickGenres, setPickGenres] = useState(() => new Set());
  const [maxRuntime, setMaxRuntime] = useState(0);
  const [accessOnly, setAccessOnly] = useState(true);
  const [pickedId, setPickedId] = useState(null);
  const [query, setQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [imdb8, setImdb8] = useState(false);
  const [limit, setLimit] = useState(40); // catalog cards rendered; "Load more" extends it
  const deferredQuery = useDeferredValue(query); // keeps typing instant while the chart re-filters
  const [skipped, setSkipped] = useState(() => new Set()); // "Not in the mood" — session only
  const genresList = useMemo(() => [...new Set(movies.flatMap((mv) => mv.genres))].sort(), [movies]);

  // Stable handlers → memoized children don't re-render needlessly
  const toggleSub = useCallback((p) => {
    setSubs((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }, []);

  const toggleWatched = useCallback((id) => {
    setLog((prev) => {
      const cur = prev[id];
      if (cur?.watched) { const { [id]: _drop, ...rest } = prev; return rest; } // unwatch clears rating
      return { ...prev, [id]: { watched: true, rating: 0 } };
    });
  }, []);

  const rate = useCallback((id, rating) => {
    setLog((prev) => ({ ...prev, [id]: { watched: true, rating } }));
  }, []);

  const closeDrawer = useCallback(() => setSelectedId(null), []);

  const toggleGenre = useCallback((g) => {
    setPickedId(null);
    setPickGenres((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }, []);
  const changeRuntime = useCallback((v) => { setPickedId(null); setMaxRuntime(v); }, []);
  const changeAccessOnly = useCallback((v) => { setPickedId(null); setAccessOnly(v); }, []);
  const clearPicker = useCallback(() => { setPickedId(null); setPickGenres(new Set()); setMaxRuntime(0); setSkipped(new Set()); }, []);
  const resetSkipped = useCallback(() => setSkipped(new Set()), []);

  // Depends only on subs → recomputed when subscriptions change, NOT on watch/rating changes
  const accessMap = useMemo(() => new Map(movies.map((mv) => [mv.id, getAccess(mv, subs)])), [movies, subs]);

  const similarity = useMemo(() => computeSimilarity(movies, log), [movies, log]);

  const visibleMovies = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    // Search + genre are AND filters; the two access toggles combine with OR ("watchable without extra cost")
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

  // Depends only on log
  const stats = useMemo(() => {
    let count = 0, minutes = 0, ratingSum = 0, rated = 0;
    for (const mv of movies) {
      const e = log[mv.id];
      if (e?.watched) {
        count++; minutes += mv.runtime;
        if (e.rating) { ratingSum += e.rating; rated++; }
      }
    }
    return { count, minutes, avg: rated ? (ratingSum / rated).toFixed(1) : '—' };
  }, [movies, log]);

  // Recommendations: recomputed when criteria, subs or the watch log change
  const recs = useMemo(
    () => recommend(movies, log, accessMap, { genres: pickGenres, maxRuntime, accessOnly, skipped }),
    [movies, log, accessMap, pickGenres, maxRuntime, accessOnly, skipped],
  );
  const recRank = useMemo(() => new Map(recs.slice(0, 3).map((r, i) => [r.movie.id, i])), [recs]);
  const criteriaActive = pickGenres.size > 0 || maxRuntime > 0;
  const focusIds = useMemo(() => (criteriaActive ? new Set(recs.map((r) => r.movie.id)) : null), [criteriaActive, recs]);

  // score-weighted random among the top 3 of a candidate list
  const pickFrom = (list) => {
    const pool = list.slice(0, 3);
    if (!pool.length) return null;
    let t = Math.random() * pool.reduce((s, r) => s + r.score, 0);
    return (pool.find((r) => (t -= r.score) <= 0) || pool[0]).movie.id;
  };
  const surprise = useCallback(() => setPickedId(pickFrom(recs)), [recs]);

  // "Not in the mood": drop the current pick from future suggestions and draw the next one
  const notInTheMood = useCallback(() => {
    if (!pickedId) return;
    setSkipped((prev) => new Set(prev).add(pickedId));
    setPickedId(pickFrom(recs.filter((r) => r.movie.id !== pickedId))); // null if nothing is left
  }, [recs, pickedId]);

  // Constellation set: a genre-diverse slice (max GRAPH_MAX) + anything you've watched, so a big catalog never explodes the graph
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

  // Ticker / HUD aggregates
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

  const toggleBtn = (on, tone) =>
    `rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur-md transition-all duration-200 ${
      on ? tone : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/30 hover:text-slate-200'
    }`;

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

      {/* Top bar: brand + subscription matrix */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="flex items-center gap-2 font-mono text-base font-bold tracking-[0.18em] text-white">
              <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,.9)]">◈</span>
              CINE<span className="text-cyan-400">TERMINAL</span><span className="text-fuchsia-400">·IN</span>
              <span className={`ml-1 flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium tracking-widest ${source === 'tmdb' ? 'border-emerald-400/40 text-emerald-300' : 'border-slate-500/40 text-slate-400'}`}>
                <i className={`inline-block h-1.5 w-1.5 rounded-full ${source === 'tmdb' ? 'bg-emerald-400 ott-pulse' : 'bg-slate-500'}`} />
                {source === 'tmdb' ? 'LIVE' : 'DEMO'}
              </span>
            </h1>
            <button type="button" onClick={onRetake} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-500 transition-colors hover:border-white/30 hover:text-slate-200">
              ↺ Redo setup
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">My streaming subscriptions (India)</span>
            {PLATFORMS.map((p) => {
              const on = subs.has(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSub(p)}
                  className={toggleBtn(on, 'border-cyan-400 bg-cyan-400/15 text-cyan-100 shadow-[0_0_14px_-2px_rgba(34,211,238,.7)]')}
                >
                  {on ? '✓ ' : ''}{p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ticker */}
        <div className="overflow-hidden border-t border-white/5 bg-black/30 py-1 font-mono text-[11px]" aria-hidden="true">
          <div className="ott-marquee flex w-max gap-8 whitespace-nowrap">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex gap-8">
                <span className="text-emerald-300">▲ ACCESSIBLE {ticker.accessible}</span>
                <span className="text-sky-300">◆ FREE IN INDIA {ticker.free}</span>
                <span className="text-yellow-300">★ IMDb 8.0+ {ticker.top}</span>
                <span className="text-fuchsia-300">⏱ ON-SUB BACKLOG {fmtDuration(ticker.backlog)}</span>
                {ticker.leaders.map((mv) => (
                  <span key={mv.id} className="text-slate-300">{mv.title} <span className="text-emerald-400">{mv.imdb_rating.toFixed(1)} ▲</span></span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        {/* HUD */}
        <Rise>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Watch statistics">
            <HudStat label="Movies Watched" value={stats.count} sub={`of ${movies.length} in catalog`} tone="cyan" />
            <HudStat label="Cumulative Watch Time" value={stats.minutes} format={fmtDuration} sub={`${stats.minutes.toLocaleString('en-IN')} min logged`} tone="fuchsia" />
            <HudStat label="Avg. Rating Given" value={stats.avg} sub="out of 5 ★" tone="amber" />
            <HudStat label="Accessible Now" value={ticker.accessible} sub="on your subs or free" tone="emerald" />
          </section>
        </Rise>

        <Rise delay={0.05}><ProfilePanel movies={movies} log={log} /></Rise>

        <Rise delay={0.1}>
          <NextMoviePicker
            genresList={genresList}
            recs={recs}
            pickGenres={pickGenres}
            maxRuntime={maxRuntime}
            accessOnly={accessOnly}
            pickedId={pickedId}
            criteriaActive={criteriaActive}
            onToggleGenre={toggleGenre}
            onRuntime={changeRuntime}
            onAccessOnly={changeAccessOnly}
            onClear={clearPicker}
            onSurprise={surprise}
            onSkip={notInTheMood}
            skippedCount={skipped.size}
            onResetSkipped={resetSkipped}
            onOpen={setSelectedId}
            onMarkWatched={toggleWatched}
          />
        </Rise>

        {/* Smart filter bar */}
        <Rise delay={0.15}>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-md">
            <button type="button" aria-pressed={onMySubs} onClick={() => setOnMySubs((v) => !v)} className={toggleBtn(onMySubs, 'border-emerald-400 bg-emerald-400/15 text-emerald-200 shadow-[0_0_14px_-3px_rgba(52,211,153,.8)]')}>
              🟢 Included in My Subs
            </button>
            <button type="button" aria-pressed={freeOnly} onClick={() => setFreeOnly((v) => !v)} className={toggleBtn(freeOnly, 'border-sky-400 bg-sky-400/15 text-sky-200 shadow-[0_0_14px_-3px_rgba(56,189,248,.8)]')}>
              🟦 Free to Watch in India
            </button>
            <button type="button" aria-pressed={imdb8} onClick={() => setImdb8((v) => !v)} className={toggleBtn(imdb8, 'border-yellow-400 bg-yellow-400/15 text-yellow-200 shadow-[0_0_14px_-3px_rgba(250,204,21,.8)]')}>
              🌟 IMDb 8.0+
            </button>
            <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
            <div className="relative min-w-[180px] flex-1">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles or genres…"
                aria-label="Search movies"
                className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-cyan-400/60"
              />
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">⌕</span>
            </div>
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              aria-label="Filter by genre"
              className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-400/60"
            >
              <option value="">All genres</option>
              {genresList.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            {(query || genreFilter || imdb8 || freeOnly || onMySubs) && (
              <button
                onClick={() => { setQuery(''); setGenreFilter(''); setImdb8(false); setFreeOnly(false); setOnMySubs(false); }}
                className="font-mono text-xs text-slate-500 hover:text-slate-200"
              >
                RESET · {visibleMovies.length}/{movies.length}
              </button>
            )}
          </div>
          {imdb8 && !movies.some((mv) => mv.imdb_rating) && (
            <p className="mt-1.5 text-[11px] text-amber-300/80">This catalog has no IMDb ratings yet — run sync_india_movies.py to add them.</p>
          )}
        </Rise>

        <Rise delay={0.2}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section aria-label="Movie constellation">
              <h2 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Constellation discovery graph</h2>
              <Constellation movies={graphMovies} accessMap={accessMap} log={log} visibleIds={visibleIds} onSelect={setSelectedId} recRank={recRank} focusIds={focusIds} sim={similarity} />
            </section>

            <section aria-label="Catalog">
              <h2 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Catalog <span className="text-slate-600">({visibleMovies.length}/{movies.length})</span>
              </h2>
              <div className="grid max-h-[640px] gap-2 overflow-y-auto pr-1">
                {visibleMovies.length === 0 && (
                  <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                    No matches. Add a subscription or relax the filters.
                  </p>
                )}
                {visibleMovies.slice(0, limit).map((mv) => (
                  <MovieCard
                    key={mv.id}
                    movie={mv}
                    access={accessMap.get(mv.id)}
                    entry={log[mv.id]}
                    onToggleWatched={toggleWatched}
                    onRate={rate}
                    onOpen={setSelectedId}
                  />
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
          ? 'This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data provided by JustWatch.' + (movies.some((x) => x.imdb_rating) ? ' IMDb ratings from IMDb\'s non-commercial datasets.' : '')
          : 'Demo data — illustrative availability and approximate IMDb ratings, not live.'}
      </footer>

      <AnimatePresence>
        {selected && (
          <DetailDrawer
            key={selected.id}
            movie={selected}
            access={accessMap.get(selected.id)}
            entry={log[selected.id]}
            signal={similarity.get(selected.id)}
            onClose={closeDrawer}
            onToggleWatched={toggleWatched}
            onRate={rate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── HUD primitives ───────────────────────── */

const Rise = ({ delay = 0, children }) => (
  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.45, ease: 'easeOut' }}>
    {children}
  </motion.div>
);

/** Animated number: tweens from the previous value to the new one. */
function useCountUp(target) {
  const [v, setV] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const ctrl = animate(prev.current, target, { duration: 0.6, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) });
    prev.current = target;
    return () => ctrl.stop();
  }, [target]);
  return v;
}

const HUD_TONES = {
  cyan: ['text-cyan-300', 'from-cyan-400/60', 'shadow-[0_0_30px_-12px_rgba(34,211,238,.9)]'],
  fuchsia: ['text-fuchsia-300', 'from-fuchsia-400/60', 'shadow-[0_0_30px_-12px_rgba(232,121,249,.9)]'],
  amber: ['text-amber-300', 'from-amber-400/60', 'shadow-[0_0_30px_-12px_rgba(251,191,36,.9)]'],
  emerald: ['text-emerald-300', 'from-emerald-400/60', 'shadow-[0_0_30px_-12px_rgba(52,211,153,.9)]'],
};

const HudStat = memo(function HudStat({ label, value, format, sub, tone = 'cyan' }) {
  const numeric = typeof value === 'number';
  const n = useCountUp(numeric ? value : 0);
  const [text, line, glow] = HUD_TONES[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md ${glow}`}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${line} to-transparent`} />
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-bold tabular-nums ${text}`}>{numeric ? (format ? format(n) : n) : value}</p>
      <p className="mt-0.5 font-mono text-[10px] text-slate-500">{sub}</p>
    </div>
  );
});

/* ───────────────────────── Next-movie picker ───────────────────────── */

const NextMoviePicker = memo(function NextMoviePicker({
  genresList, recs, pickGenres, maxRuntime, accessOnly, pickedId, criteriaActive,
  onToggleGenre, onRuntime, onAccessOnly, onClear, onSurprise, onSkip, skippedCount, onResetSkipped, onOpen, onMarkWatched,
}) {
  const top = recs.slice(0, 3);
  const picked = pickedId ? recs.find((r) => r.movie.id === pickedId) : null;
  const chip = (on) =>
    `rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 text-zinc-400 hover:border-white/30 hover:text-zinc-200'}`;

  return (
    <section aria-label="Pick my next movie" className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.06] to-transparent p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-amber-200">🎯 Pick my next movie</h2>
        <div className="flex items-center gap-2">
          {criteriaActive && <button onClick={onClear} className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline">Clear</button>}
          <button
            onClick={onSurprise}
            disabled={!recs.length}
            className="rounded-full bg-amber-400 px-3.5 py-1 text-xs font-semibold text-zinc-950 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🎲 Surprise me
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Genres">
        <span className="mr-1 text-[11px] uppercase tracking-wider text-zinc-500">Mood / genres</span>
        {genresList.map((g) => (
          <button key={g} type="button" aria-pressed={pickGenres.has(g)} onClick={() => onToggleGenre(g)} className={chip(pickGenres.has(g))}>
            {g}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] uppercase tracking-wider text-zinc-500">Time I have</span>
        {RUNTIME_OPTIONS.map((o) => (
          <button key={o.value} type="button" aria-pressed={maxRuntime === o.value} onClick={() => onRuntime(o.value)} className={chip(maxRuntime === o.value)}>
            {o.label}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer select-none items-center gap-1.5 text-xs text-zinc-300">
          <input type="checkbox" checked={accessOnly} onChange={(e) => onAccessOnly(e.target.checked)} className="h-3.5 w-3.5 accent-amber-400" />
          Only what I can watch now
        </label>
      </div>

      {picked && (
        <div className="ott-slide mt-4 flex items-center gap-4 rounded-xl border border-amber-400/50 bg-amber-400/10 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picked.movie.poster} alt="" className="h-24 w-16 rounded-md object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">Tonight&apos;s pick · {picked.pct}% match</p>
            <p className="truncate text-lg font-bold text-white">{picked.movie.title}</p>
            <p className="text-xs text-zinc-400">{fmtDuration(picked.movie.runtime)} · {picked.reasons.join(' · ')}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <button onClick={() => onOpen(picked.movie.id)} className="rounded-md bg-white/10 px-3 py-1 text-xs text-zinc-100 hover:bg-white/20">Where to watch</button>
            <button onClick={onSkip} className="rounded-md border border-white/15 px-3 py-1 text-xs text-zinc-300 hover:border-amber-400 hover:text-amber-200">😒 Not in the mood</button>
            <button onClick={() => onMarkWatched(picked.movie.id)} className="rounded-md bg-cyan-500 px-3 py-1 text-xs font-medium text-white hover:bg-cyan-400">I watched it ✓</button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {top.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500 md:col-span-3">
            No unwatched movie fits. Loosen the genres or runtime, add a subscription, or untick “Only what I can watch now”.
          </p>
        )}
        {top.map((r, i) => (
          <button
            key={r.movie.id}
            onClick={() => onOpen(r.movie.id)}
            className={`rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 ${i === 0 ? 'border-amber-400/50 bg-amber-400/[0.07]' : 'border-white/10 bg-white/5 backdrop-blur-md'}`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-zinc-100">#{i + 1} {r.movie.title}</span>
              <span className="text-xs font-bold text-amber-300">{r.pct}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded bg-white/10">
              <div className="h-full rounded bg-amber-400 transition-all duration-500" style={{ width: `${r.pct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-400">{fmtDuration(r.movie.runtime)} · {r.reasons.join(' · ')}</p>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        {recs.length > 3 && <>+ {recs.length - 3} more candidates (faded in the constellation). </>}
        {skippedCount > 0 && (
          <>Skipped {skippedCount}. <button onClick={onResetSkipped} className="underline hover:text-zinc-300">Bring them back</button></>
        )}
      </p>
    </section>
  );
});

/* ───────────────────────── Profile: favourite genres ───────────────────────── */

const ProfilePanel = memo(function ProfilePanel({ movies, log }) {
  const { fav, loved } = useMemo(() => {
    const c = {}; const l = [];
    for (const mv of movies) {
      const e = log[mv.id];
      if (!e?.watched || (e.rating || 0) < 4) continue;
      l.push({ mv, r: e.rating });
      for (const g of mv.genres) c[g] = (c[g] || 0) + 1;
    }
    return {
      fav: Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5),
      loved: l.sort((a, b) => b.r - a.r).slice(0, 4),
    };
  }, [movies, log]);
  const max = fav[0]?.[1] || 1;

  return (
    <section aria-label="Your taste profile" className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Your taste · from 4★ and 5★ ratings</h2>
      {fav.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Rate a few movies 4★ or 5★ and your favourite genres will appear here.</p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-1.5">
            {fav.map(([g, n]) => (
              <div key={g} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 text-zinc-300">{g}</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-white/5">
                  <div className="h-full rounded bg-gradient-to-r from-cyan-500 to-violet-400 transition-all duration-700" style={{ width: `${(n / max) * 100}%` }} />
                </div>
                <span className="w-5 text-right tabular-nums text-zinc-400">{n}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap content-start gap-1.5">
            {loved.map(({ mv, r }) => (
              <span key={mv.id} className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200 ring-1 ring-amber-400/20">{mv.title} · {r}★</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
});



/* ═════════════════════════ STAGE 1: ONBOARDING ═════════════════════════ */

const Screen = ({ children }) => (
  <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-slate-950 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,.16),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(217,70,239,.16),transparent_50%)] px-4 py-6 text-slate-200 antialiased before:pointer-events-none before:absolute before:inset-0 before:[background-image:linear-gradient(rgba(34,211,238,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.05)_1px,transparent_1px)] before:[background-size:40px_40px]">
    <div className="relative z-10 flex w-full flex-1 flex-col items-center">{children}</div>
  </div>
);

/** Catalog: live API route → static file from sync_india_movies.py → built-in demo data. */
function useCatalog() {
  const [state, setState] = useState({ movies: MOCK_MOVIES, source: 'demo', ready: false });
  useEffect(() => {
    const ctrl = new AbortController();
    const load = async (url) => {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      const list = Array.isArray(data) ? data : data.movies;
      if (!Array.isArray(list) || list.length < 6) throw new Error('too few movies');
      return list;
    };
    load('/api/movies')
      .catch(() => load('/india_movies.json'))
      .then((list) => ({ movies: list.map((mv, i) => ({ ...mv, poster: mv.poster || poster(mv.title, (i * 47) % 360) })), source: 'tmdb', ready: true }))
      .catch(() => ({ movies: MOCK_MOVIES, source: 'demo', ready: true }))
      .then((st) => { if (!ctrl.signal.aborted) setState(st); });
    return () => ctrl.abort();
  }, []);
  return state;
}

/**
 * Genre-diverse onboarding deck.
 * A live catalog is sorted by popularity, so slice(0, 25) would be mostly Action/Drama. Instead we
 * greedily pick from the 150 most popular titles, scoring each candidate by
 *   45% popularity (rank in the file)  +  45% genre novelty  +  10% language novelty
 * where novelty = how rarely its genres / language are already in the deck. A soft cap (30% of the deck
 * per genre) stops any one genre from dominating. Deterministic; same catalog → same deck.
 */
function pickDiverseDeck(movies, size = DECK_SIZE, poolSize = 150) {
  const seen = new Set();
  const pool = movies.slice(0, poolSize).filter((mv) => {
    const key = mv.title.toLowerCase();
    if (seen.has(key)) return false; // drop duplicate titles (remakes sharing a name)
    seen.add(key);
    return true;
  });
  if (pool.length <= size) return pool;

  const cap = Math.ceil(size * 0.3);
  const genreCount = {}, langCount = {};
  const left = pool.map((mv, i) => ({ mv, pop: 1 - i / pool.length }));
  const deck = [];

  while (deck.length < size && left.length) {
    let best = 0, bestScore = -Infinity;
    for (let i = 0; i < left.length; i++) {
      const { mv, pop } = left[i];
      const novelty = mv.genres.reduce((t, g) => t + 1 / (1 + (genreCount[g] || 0)), 0) / mv.genres.length;
      const langNovelty = 1 / (1 + (langCount[mv.language || '?'] || 0));
      const overCap = mv.genres.some((g) => (genreCount[g] || 0) >= cap) ? 1 : 0;
      const score = 0.45 * pop + 0.45 * novelty + 0.1 * langNovelty - overCap;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    const [{ mv }] = left.splice(best, 1);
    mv.genres.forEach((g) => { genreCount[g] = (genreCount[g] || 0) + 1; });
    langCount[mv.language || '?'] = (langCount[mv.language || '?'] || 0) + 1;
    deck.push(mv);
  }
  return deck;
}

/* ── Step A: streaming setup ── */
function SubsStep({ subs, onToggle, onNext }) {
  return (
    <Screen>
      <div className="flex w-full max-w-xl flex-1 flex-col justify-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">STEP 01 // SUBSCRIPTION MATRIX</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Link your streaming stack</h1>
        <p className="mt-2 text-sm text-zinc-400">Pick the Indian streaming services you pay for. We&apos;ll flag what&apos;s already included — and what&apos;s free.</p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {PLATFORMS.map((p, i) => {
            const on = subs.has(p);
            return (
              <motion.button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(p)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.94 }}
                className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${
                  on ? 'border-cyan-400 bg-cyan-500/25 text-cyan-50 shadow-[0_0_18px_-4px_rgba(34,211,238,.8)]' : 'border-white/10 bg-white/5 backdrop-blur-md text-zinc-400 hover:border-white/30 hover:text-zinc-100'
                }`}
              >
                {on ? '✓ ' : ''}{p}
              </motion.button>
            );
          })}
        </div>
        <button
          onClick={onNext}
          className="mt-10 self-start rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-400"
        >
          {subs.size ? `Continue with ${subs.size} service${subs.size > 1 ? 's' : ''} →` : 'I only watch free content →'}
        </button>
      </div>
    </Screen>
  );
}

/* ── Rating prompt (shown after a swipe right) ── */
function RatingPrompt({ movie, onRate, onCancel }) {
  const [hover, setHover] = useState(0);
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onCancel();
      else if (/^[1-5]$/.test(e.key)) onRate(Number(e.key));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onRate, onCancel]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        role="dialog" aria-modal="true" aria-label={`Rate ${movie.title}`}
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-xs rounded-2xl border border-cyan-400/30 bg-white/10 p-6 text-center shadow-[0_0_60px_-10px_rgba(34,211,238,.6)] backdrop-blur-xl"
      >
        <p className="text-xs uppercase tracking-widest text-zinc-500">You watched</p>
        <h2 className="mt-1 text-lg font-bold text-white">{movie.title}</h2>
        <p className="mt-3 text-sm text-zinc-400">How was it?</p>
        <div className="mt-3 flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
              onMouseEnter={() => setHover(n)}
              onClick={() => onRate(n)}
              className={n <= hover ? 'text-amber-400' : 'text-zinc-600'}
            >
              <Star filled={n <= hover} className="!h-9 !w-9" />
            </motion.button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-zinc-600">Tap a star (or press 1–5) · Esc to cancel</p>
      </motion.div>
    </motion.div>
  );
}

/* ── One swipeable card ── */
const cardVariants = {
  enter: { scale: 0.95, opacity: 0 },
  center: { scale: 1, opacity: 1 },
  exit: (d) => ({ x: d === 'right' ? 460 : -460, opacity: 0, transition: { duration: 0.28 } }),
};

function SwipeCard({ movie, access, dir, onSwipe }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const yes = useTransform(x, [20, 120], [0, 1]);
  const no = useTransform(x, [-120, -20], [1, 0]);

  return (
    <motion.div
      custom={dir} variants={cardVariants} initial="enter" animate="center" exit="exit"
      drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.85}
      style={{ x, rotate }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110 || info.velocity.x > 500) onSwipe('right');
        else if (info.offset.x < -110 || info.velocity.x < -500) onSwipe('left');
      }}
      whileDrag={{ cursor: 'grabbing' }}
      className="absolute inset-0 cursor-grab select-none overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={movie.poster} alt={`${movie.title} poster`} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <motion.div style={{ opacity: yes }} className="absolute left-4 top-5 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-black tracking-widest text-emerald-400">WATCHED</motion.div>
      <motion.div style={{ opacity: no }} className="absolute right-4 top-5 rotate-12 rounded-lg border-4 border-rose-400 px-3 py-1 text-2xl font-black tracking-widest text-rose-400">NOT SEEN</motion.div>
      <div className="absolute inset-x-0 bottom-0 space-y-2 p-5">
        <h2 className="text-2xl font-bold leading-tight text-white">{movie.title}</h2>
        <p className="text-sm text-zinc-300">{fmtDuration(movie.runtime)} · {movie.genres.join(' · ')}</p>
        <ImdbBadge movie={movie} />
        <Badges access={access} />
      </div>
    </motion.div>
  );
}

/* ── Step B: 25-card deck ── */
function SwipeStep({ deck, subs, log, setLog, onDone, onBack }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState('left');
  const [pending, setPending] = useState(null); // movie awaiting a rating
  const total = deck.length;
  const finished = index >= total;
  const current = deck[index];

  const skip = useCallback(() => {
    if (finished || pending) return;
    setDir('left');
    setIndex((i) => i + 1);
  }, [finished, pending]);

  const askRating = useCallback(() => {
    if (finished || pending) return;
    setPending(current);
  }, [finished, pending, current]);

  const confirmRating = useCallback((stars) => {
    setLog((prev) => ({ ...prev, [pending.id]: { watched: true, rating: stars } }));
    setPending(null);
    setDir('right');
    setIndex((i) => i + 1);
  }, [pending, setLog]);

  const cancelRating = useCallback(() => setPending(null), []);

  const undo = useCallback(() => {
    if (index === 0 || pending) return;
    const prev = deck[index - 1];
    setLog((l) => { const { [prev.id]: _drop, ...rest } = l; return rest; });
    setDir('left');
    setIndex((i) => i - 1);
  }, [index, pending, deck, setLog]);

  const onSwipe = useCallback((d) => (d === 'right' ? askRating() : skip()), [askRating, skip]);

  useEffect(() => {
    const h = (e) => {
      if (pending) return; // the prompt handles its own keys
      if (e.key === 'ArrowLeft') skip();
      else if (e.key === 'ArrowRight') askRating();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [pending, skip, askRating]);

  const watched = deck.filter((mv) => log[mv.id]?.watched);
  const minutes = watched.reduce((t, mv) => t + mv.runtime, 0);

  return (
    <Screen>
      <div className="flex w-full max-w-sm flex-1 flex-col">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <button onClick={onBack} className="hover:text-zinc-200">← Services</button>
          <span className="font-semibold uppercase tracking-[0.2em] text-cyan-300">STEP 02 // CALIBRATION DECK</span>
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">{finished ? `All ${total} done` : `Card ${index + 1} of ${total}`}</span>
            <span>{watched.length} watched · {fmtDuration(minutes)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index}>
            <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400" animate={{ width: `${(index / total) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
          </div>
        </div>

        {!finished ? (
          <>
            <p className="mt-4 text-center text-sm text-zinc-400">Seen it? Swipe right and rate it. Haven&apos;t? Swipe left.</p>
            <div className="relative mx-auto mt-3 h-[460px] w-full">
              {/* depth cards behind the active one */}
              {deck.slice(index + 1, index + 3).map((mv, i) => (
                <div
                  key={mv.id}
                  className="absolute inset-0 rounded-3xl border border-white/10 bg-zinc-900"
                  style={{ transform: `translateY(${(i + 1) * 10}px) scale(${1 - (i + 1) * 0.04})`, opacity: 0.7 - i * 0.25, zIndex: -i - 1 }}
                />
              ))}
              <AnimatePresence custom={dir} mode="popLayout">
                <SwipeCard key={current.id} movie={current} access={getAccess(current, subs)} dir={dir} onSwipe={onSwipe} />
              </AnimatePresence>
            </div>

            <div className="mt-8 flex items-center justify-center gap-4">
              <motion.button whileTap={{ scale: 0.92 }} onClick={skip} className="rounded-full border border-rose-400/40 bg-rose-500/10 px-6 py-3 text-sm font-semibold text-rose-300 hover:bg-rose-500/20">❌ Haven&apos;t Seen</motion.button>
              <button onClick={undo} disabled={index === 0} aria-label="Undo last card" className="rounded-full border border-white/10 px-3 py-3 text-sm text-zinc-400 hover:text-zinc-100 disabled:opacity-30">↩</button>
              <motion.button whileTap={{ scale: 0.92 }} onClick={askRating} className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20">⭐ Watched</motion.button>
            </div>
            <p className="mt-3 text-center text-[11px] text-zinc-600">Tip: ← / → keys work too</p>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 rounded-3xl border border-cyan-400/30 bg-cyan-500/10 p-6 text-center">
            <p className="text-xs uppercase tracking-widest text-cyan-300">CALIBRATION COMPLETE</p>
            <p className="mt-2 text-4xl font-bold text-white">{watched.length}</p>
            <p className="text-sm text-zinc-400">movies watched · {fmtDuration(minutes)} of your life</p>
            <button onClick={onDone} className="mt-6 rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400">Unlock my dashboard →</button>
            <button onClick={undo} className="mt-3 block w-full text-xs text-zinc-500 hover:text-zinc-300">↩ Undo last card</button>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {pending && <RatingPrompt key="rate" movie={pending} onRate={confirmRating} onCancel={cancelRating} />}
      </AnimatePresence>
    </Screen>
  );
}

/* ═════════════════════════ ROOT ═════════════════════════ */

export default function IndiaCinemaTracker() {
  const { movies, source, ready } = useCatalog();
  const [stage, setStage] = useState('loading'); // loading → subs → swipe → dash
  const [subs, setSubs] = useState(() => new Set());
  const [log, setLog] = useState({}); // { [id]: { watched: true, rating: 1-5 } }
  const hydrated = useRef(false);

  // Restore profile once the catalog is known (client only → no SSR mismatch)
  useEffect(() => {
    if (!ready || hydrated.current) return;
    let next = 'subs';
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) {
        if (Array.isArray(saved.subs)) setSubs(new Set(saved.subs));
        // Ratings are keyed by movie id; demo and live catalogs use different ids, so only reuse a matching profile.
        if (saved.source === source) {
          if (saved.log && typeof saved.log === 'object') setLog(saved.log);
          if (saved.onboarded) next = 'dash';
        }
      }
    } catch { /* storage unavailable */ }
    hydrated.current = true;
    setStage(next);
  }, [ready, source]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ subs: [...subs], log, source, onboarded: stage === 'dash' }));
    } catch { /* ignore */ }
  }, [subs, log, stage, source]);

  const toggleSub = useCallback((p) => {
    setSubs((prev) => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  }, []);
  const startSwipe = useCallback(() => { setLog({}); setStage('swipe'); }, []);
  const deck = useMemo(() => pickDiverseDeck(movies), [movies]);

  let view;
  if (stage === 'loading') view = <Screen><div className="my-auto font-mono text-sm text-cyan-300/70">INITIALISING TERMINAL…</div></Screen>;
  else if (stage === 'subs') view = <SubsStep subs={subs} onToggle={toggleSub} onNext={startSwipe} />;
  else if (stage === 'swipe') view = <SwipeStep deck={deck} subs={subs} log={log} setLog={setLog} onDone={() => setStage('dash')} onBack={() => setStage('subs')} />;
  else view = <Dashboard movies={movies} source={source} subs={subs} setSubs={setSubs} log={log} setLog={setLog} onRetake={() => setStage('subs')} />;

  // opacity-only transition: no transform/filter, so position:fixed drawers inside keep working
  return (
    <AnimatePresence mode="wait">
      <motion.div key={stage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
        {view}
      </motion.div>
    </AnimatePresence>
  );
}
