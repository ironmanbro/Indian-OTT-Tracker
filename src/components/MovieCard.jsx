// Catalog card: poster + IMDb overlay, genres, OTT availability tags, watched/rating controls.
import { memo } from 'react';
import { Badges, StarRating } from './shared.jsx';
import { fmtDuration } from '../lib/format.js';

export const MovieCard = memo(function MovieCard({ movie, access, entry, onToggleWatched, onRate, onOpen }) {
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

export default MovieCard;
