// Dashboard "HUD": top bar + subscription matrix, ticker, watch-time accumulator tiles, and the smart filter bar
// (Included in My Subs · Free to Watch in India · IMDb 8.0+). OTT availability tags live in shared.jsx (<Badges/>).
import { memo, useEffect, useRef, useState } from 'react';
import { animate, motion } from 'framer-motion';
import { Clock, Film, RotateCcw, Search, Star, Tv } from 'lucide-react';
import { PLATFORMS } from '../lib/constants.js';
import { fmtDuration } from '../lib/format.js';

/** Fade/rise entrance (opacity + transform only, so fixed-position drawers inside keep working). */
export const Rise = ({ delay = 0, children }) => (
  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.45, ease: 'easeOut' }}>
    {children}
  </motion.div>
);

/** Animated number: tweens from the previous value to the new one. */
export function useCountUp(target) {
  const [v, setV] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const ctrl = animate(prev.current, target, { duration: 0.6, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) });
    prev.current = target;
    return () => ctrl.stop();
  }, [target]);
  return v;
}

const TONES = {
  cyan: ['text-cyan-300', 'from-cyan-400/60', 'shadow-[0_0_30px_-12px_rgba(34,211,238,.9)]'],
  fuchsia: ['text-fuchsia-300', 'from-fuchsia-400/60', 'shadow-[0_0_30px_-12px_rgba(232,121,249,.9)]'],
  amber: ['text-amber-300', 'from-amber-400/60', 'shadow-[0_0_30px_-12px_rgba(251,191,36,.9)]'],
  emerald: ['text-emerald-300', 'from-emerald-400/60', 'shadow-[0_0_30px_-12px_rgba(52,211,153,.9)]'],
};

export const HudStat = memo(function HudStat({ label, value, format, sub, tone = 'cyan', icon: Icon }) {
  const numeric = typeof value === 'number';
  const n = useCountUp(numeric ? value : 0);
  const [text, line, glow] = TONES[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md ${glow}`}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${line} to-transparent`} />
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        {Icon && <Icon size={14} className={text} aria-hidden="true" />}
      </div>
      <p className={`mt-1 font-mono text-3xl font-bold tabular-nums ${text}`}>{numeric ? (format ? format(n) : n) : value}</p>
      <p className="mt-0.5 font-mono text-[10px] text-slate-500">{sub}</p>
    </div>
  );
});

/** Watch-time accumulator + stats: movies watched, cumulative time (e.g. "142h 30m"), average rating, accessible now. */
export function HudStats({ stats, total, accessible, availability = true }) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Watch statistics">
      <HudStat label="Movies Watched" value={stats.count} sub={`of ${total} in catalog`} tone="cyan" icon={Film} />
      <HudStat label="Cumulative Watch Time" value={stats.minutes} format={fmtDuration} sub={`${stats.minutes.toLocaleString('en-IN')} min logged`} tone="fuchsia" icon={Clock} />
      <HudStat label="Avg. Rating Given" value={stats.avg} sub="out of 5 ★" tone="amber" icon={Star} />
      {availability
        ? <HudStat label="Accessible Now" value={accessible} sub="on your subs or free" tone="emerald" icon={Tv} />
        : <HudStat label="Still To Watch" value={Math.max(0, total - stats.count)} sub="movies not yet logged" tone="emerald" icon={Tv} />}
    </section>
  );
}

const toggleBtn = (on, tone) =>
  `rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur-md transition-all duration-200 ${
    on ? tone : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/30 hover:text-slate-200'
  }`;

function Ticker({ ticker, availability = true }) {
  return (
    <div className="overflow-hidden border-t border-white/5 bg-black/30 py-1 font-mono text-[11px]" aria-hidden="true">
      <div className="ott-marquee flex w-max gap-8 whitespace-nowrap">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex gap-8">
            {availability && <span className="text-emerald-300">▲ ACCESSIBLE {ticker.accessible}</span>}
            {availability && <span className="text-sky-300">◆ FREE IN INDIA {ticker.free}</span>}
            <span className="text-yellow-300">★ IMDb 8.0+ {ticker.top}</span>
            {availability && <span className="text-fuchsia-300">⏱ ON-SUB BACKLOG {fmtDuration(ticker.backlog)}</span>}
            {ticker.leaders.map((mv) => (
              <span key={mv.id} className="text-slate-300">{mv.title} <span className="text-emerald-400">{mv.imdb_rating.toFixed(1)} ▲</span></span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Sticky top bar: brand, LIVE/DEMO badge, subscription matrix, ticker. */
export function DashboardHeader({ source, subs, onToggleSub, onRetake, ticker, availability = true }) {
  return (
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
          <button type="button" onClick={onRetake} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-500 transition-colors hover:border-white/30 hover:text-slate-200">
            <RotateCcw size={12} aria-hidden="true" /> Redo setup
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
                onClick={() => onToggleSub(p)}
                className={toggleBtn(on, 'border-cyan-400 bg-cyan-400/15 text-cyan-100 shadow-[0_0_14px_-2px_rgba(34,211,238,.7)]')}
              >
                {on ? '✓ ' : ''}{p}
              </button>
            );
          })}
        </div>
      </div>
      <Ticker ticker={ticker} availability={availability} />
    </header>
  );
}

const SORT_LABELS = { popular: 'Most popular', rating: 'Highest IMDb', newest: 'Newest first', oldest: 'Oldest first', shortest: 'Shortest first', title: 'A → Z' };

/** Smart filter bar. `f` = { onMySubs, freeOnly, imdb8, query, genre, industry, sort, hideWatched } and `set` = setters (see Dashboard). */
export function FilterBar({ f, set, genresList, shown, total, hasRatings, availability = true, industries = {} }) {
  const active = f.query || f.genre || f.imdb8 || f.freeOnly || f.onMySubs || f.industry || f.hideWatched;
  const chip = (label, value) => (
    <button key={label} type="button" aria-pressed={f.industry === value} onClick={() => set.industry(value)}
      className={toggleBtn(f.industry === value, 'border-fuchsia-400 bg-fuchsia-400/15 text-fuchsia-100 shadow-[0_0_14px_-3px_rgba(232,121,249,.8)]')}>
      {label}{value && industries[value] ? <span className="ml-1 font-mono text-[10px] opacity-60">{industries[value]}</span> : null}
    </button>
  );
  const field = 'rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-400/60';
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-md">
        {Object.keys(industries).length > 1 && (
          <>
            {chip('All', '')}
            {chip('🎬 Hollywood', 'Hollywood')}
            {chip('🇮🇳 Bollywood', 'Bollywood')}
            <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
          </>
        )}
        {availability && (
          <>
            <button type="button" aria-pressed={f.onMySubs} onClick={() => set.onMySubs((v) => !v)} className={toggleBtn(f.onMySubs, 'border-emerald-400 bg-emerald-400/15 text-emerald-200 shadow-[0_0_14px_-3px_rgba(52,211,153,.8)]')}>
              🟢 Included in My Subs
            </button>
            <button type="button" aria-pressed={f.freeOnly} onClick={() => set.freeOnly((v) => !v)} className={toggleBtn(f.freeOnly, 'border-sky-400 bg-sky-400/15 text-sky-200 shadow-[0_0_14px_-3px_rgba(56,189,248,.8)]')}>
              🟦 Free to Watch in India
            </button>
          </>
        )}
        <button type="button" aria-pressed={f.imdb8} onClick={() => set.imdb8((v) => !v)} className={toggleBtn(f.imdb8, 'border-yellow-400 bg-yellow-400/15 text-yellow-200 shadow-[0_0_14px_-3px_rgba(250,204,21,.8)]')}>
          🌟 IMDb 8.0+
        </button>
        <button type="button" aria-pressed={f.hideWatched} onClick={() => set.hideWatched((v) => !v)} className={toggleBtn(f.hideWatched, 'border-cyan-400 bg-cyan-400/15 text-cyan-100')}>
          👁 Hide watched
        </button>
        <div className="relative min-w-[200px] flex-1 basis-full sm:basis-auto">
          <input
            type="search"
            value={f.query}
            onChange={(e) => set.query(e.target.value)}
            placeholder="Search title, genre, director or year…"
            aria-label="Search movies"
            className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-cyan-400/60"
          />
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        </div>
        <select value={f.genre} onChange={(e) => set.genre(e.target.value)} aria-label="Filter by genre" className={field}>
          <option value="">All genres</option>
          {genresList.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={f.sort} onChange={(e) => set.sort(e.target.value)} aria-label="Sort movies" className={field}>
          {Object.entries(SORT_LABELS).map(([k, v]) => <option key={k} value={k}>Sort: {v}</option>)}
        </select>
        {active && (
          <button onClick={set.reset} className="font-mono text-xs text-slate-500 hover:text-slate-200">
            RESET · {shown}/{total}
          </button>
        )}
      </div>
      {f.imdb8 && !hasRatings && (
        <p className="mt-1.5 text-[11px] text-amber-300/80">This catalog has no IMDb ratings yet — run scripts/sync_india_movies.py to add them.</p>
      )}
    </>
  );
}
