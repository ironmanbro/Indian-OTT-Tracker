// "Pick my next movie": genre/time filters, ranked picks, Surprise me / Not in the mood.
import { memo } from 'react';
import { Poster } from './Poster.jsx';
import { fmtDuration } from '../lib/format.js';
import { RUNTIME_OPTIONS } from '../lib/recommend.js';

export const NextMoviePicker = memo(function NextMoviePicker({
  genresList, recs, pickGenres, maxRuntime, accessOnly, pickedId, criteriaActive, availability = true,
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
        <label className={`ml-auto select-none items-center gap-1.5 text-xs text-zinc-300 cursor-pointer ${availability ? 'flex' : 'hidden'}`}>
          <input type="checkbox" checked={accessOnly} onChange={(e) => onAccessOnly(e.target.checked)} className="h-3.5 w-3.5 accent-amber-400" />
          Only what I can watch now
        </label>
      </div>

      {picked && (
        <div className="ott-slide mt-4 flex items-center gap-4 rounded-xl border border-amber-400/50 bg-amber-400/10 p-3">
          <Poster movie={picked.movie} size="sm" className="h-28 w-[75px] shrink-0 rounded-md" />
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

export default NextMoviePicker;
