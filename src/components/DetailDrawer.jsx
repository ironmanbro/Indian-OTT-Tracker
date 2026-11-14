// "Title terminal" drawer: IMDb gauge, stats, streaming pathways (deep-links), watch log.
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { StarRating } from './shared.jsx';
import { providerLink } from '../lib/constants.js';
import { fmtDuration } from '../lib/format.js';

export function DetailDrawer({ movie, access, entry, signal, onClose, onToggleWatched, onRate }) {
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

export default DetailDrawer;
