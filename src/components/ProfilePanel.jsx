// Favourite genres derived from 4★ and 5★ ratings.
import { memo, useMemo } from 'react';

export const ProfilePanel = memo(function ProfilePanel({ movies, log, learned = [] }) {
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
      {learned.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Engine learned</span>
          {learned.slice(0, 6).map((f) => (
            <span key={f.key} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-200" style={{ opacity: 0.55 + 0.45 * f.weight }}>
              {f.label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
});



/* ═════════════════════════ STAGE 1: ONBOARDING ═════════════════════════ */

export default ProfilePanel;
