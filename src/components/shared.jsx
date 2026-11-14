// Small shared UI: stars, IMDb chip, OTT availability tags, full-screen wrapper.
import { memo } from 'react';

export const Star = ({ filled, className = '' }) => (
  <svg viewBox="0 0 20 20" className={`h-4 w-4 ${className}`} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
    <path d="M10 1.8l2.4 5.2 5.6.7-4.2 3.8 1.2 5.6L10 14.4 5 17.1l1.2-5.6L2 7.7l5.6-.7L10 1.8z" strokeLinejoin="round" />
  </svg>
);

export const StarRating = memo(function StarRating({ value, onChange, size = '' }) {
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

/** IMDb rating chip — renders nothing when the catalog has no rating (e.g. demo data). */
export const ImdbBadge = memo(function ImdbBadge({ movie, className = '' }) {
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

export const Badges = memo(function Badges({ access }) {
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

export const Screen = ({ children }) => (
  <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-slate-950 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,.16),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(217,70,239,.16),transparent_50%)] px-4 py-6 text-slate-200 antialiased before:pointer-events-none before:absolute before:inset-0 before:[background-image:linear-gradient(rgba(34,211,238,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.05)_1px,transparent_1px)] before:[background-size:40px_40px]">
    <div className="relative z-10 flex w-full flex-1 flex-col items-center">{children}</div>
  </div>
);
