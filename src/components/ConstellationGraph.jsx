// Interactive D3 force-directed "constellation".
//  • star size    = IMDb rating (+ your rating once watched)
//  • brightness   = similarity to your 4–5★ taste (from useMovieRecommender)
//  • proximity    = a radial force pulls the stars you'd love toward the centre and pushes dissimilar ones outward;
//                   after every rating the layout is re-settled from the previous positions and the stars glide there
//  • links        = shared genre (cyan) or same director (magenta)
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Poster } from './Poster.jsx';
import { Badges, ImdbBadge } from './shared.jsx';
import { fmtDuration } from '../lib/format.js';
import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation, forceX, forceY } from 'd3';

const W = 820;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const R = Math.min(W, H) * 0.46;

const sharedGenres = (a, b) => a.genres.filter((g) => b.genres.includes(g));
const dirsOf = (mv) => (mv.director ? mv.director.split(',').map((x) => x.trim()) : []);

/** Star size: IMDb quality (3.5–12.5 unwatched) and, once watched, your own rating (5★ → ~25). */
export function nodeRadius(entry, sim = 0.5, imdb = null) {
  const q = imdb ? Math.min(1, Math.max(0, (imdb - 5) / 4)) : 0.5; // IMDb 5 → 0 … 9 → 1
  if (!entry?.watched) return 3.5 + q * 4 + sim * 5;
  const r = entry.rating || 0;
  return r === 0 ? 8 + q * 2 : 8 + r * 3 + q * 2;
}

function buildLinks(movies) {
  const ls = [];
  for (let i = 0; i < movies.length; i++) {
    for (let j = i + 1; j < movies.length; j++) {
      const g = sharedGenres(movies[i], movies[j]).length;
      const d = dirsOf(movies[i]).some((x) => dirsOf(movies[j]).includes(x));
      if (g || d) ls.push({ source: movies[i].id, target: movies[j].id, shared: g + (d ? 2 : 0), director: d });
    }
  }
  return ls;
}

/** Settle the layout. `prev` (Map id → {x,y}) warm-starts it so a new rating MOVES stars instead of reshuffling them. */
function computeLayout(movies, links, similarity, log, prev) {
  const ns = movies.map((mv, i) => {
    const p = prev?.get(mv.id);
    const a = i * 2.399963; // golden-angle spiral → deterministic first layout
    const r = 18 * Math.sqrt(i + 1);
    return { id: mv.id, x: p ? p.x : CX + r * Math.cos(a), y: p ? p.y : CY + r * Math.sin(a) };
  });
  // Target orbit: loved (4–5★) at the core, other watched mid-way, unwatched by dissimilarity (similar → inner rings)
  const orbit = (n) => {
    const e = log[n.id];
    if (e?.watched) return (e.rating || 0) >= 4 ? R * 0.12 : R * 0.38;
    return R * (0.24 + 0.76 * (1 - (similarity.get(n.id) ?? 0.5)));
  };
  const simu = forceSimulation(ns)
    .force('link', forceLink(links.map((l) => ({ ...l }))).id((d) => d.id).distance((d) => Math.max(45, 130 - d.shared * 20)).strength((d) => Math.min(0.2, 0.05 * d.shared)))
    .force('charge', forceManyBody().strength(-260))
    .force('collide', forceCollide(30))
    .force('radial', forceRadial(orbit, CX, CY).strength(0.55))
    .force('x', forceX(CX).strength(0.02))
    .force('y', forceY(CY).strength(0.03))
    .alpha(prev ? 0.6 : 1)
    .stop();
  for (let i = 0; i < (prev ? 200 : 350); i++) simu.tick();

  // Fit to the canvas by scaling about the FIXED centre (never re-centre by bounding box: that would
  // distort the taste rings and put loved stars off-centre).
  const padX = 70, padY = 55;
  const maxDx = Math.max(1, ...ns.map((n) => Math.abs(n.x - CX)));
  const maxDy = Math.max(1, ...ns.map((n) => Math.abs(n.y - CY)));
  const sx = (W / 2 - padX) / maxDx;
  const sy = (H / 2 - padY) / maxDy;
  return new Map(ns.map((n) => [n.id, { x: CX + (n.x - CX) * sx, y: CY + (n.y - CY) * sy }]));
}

/** Glide from the previous positions to the new target (skips animation for reduced-motion users). */
function useTweenedPositions(target) {
  const [pos, setPos] = useState(target);
  const current = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = current.current;
    const t0 = performance.now();
    const D = reduce ? 0 : 750;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
    const step = (now) => {
      const k = D ? Math.min(1, (now - t0) / D) : 1;
      const e = ease(k);
      const m = new Map();
      target.forEach((to, id) => {
        const f = from.get(id) || to;
        m.set(id, { x: f.x + (to.x - f.x) * e, y: f.y + (to.y - f.y) * e });
      });
      current.current = m;
      setPos(m);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return pos;
}

export const ConstellationGraph = memo(function ConstellationGraph({ movies, accessMap, log, visibleIds, onSelect, recRank, focusIds, similarity }) {
  const [hover, setHover] = useState(null);

  const field = useMemo(() => { // faint background star-field (deterministic)
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 70 }, () => ({ x: rnd() * W, y: rnd() * H, r: 0.4 + rnd() * 1.1, o: 0.15 + rnd() * 0.5 }));
  }, []);

  const links = useMemo(() => buildLinks(movies), [movies]);
  const lastLayout = useRef(null);
  const target = useMemo(() => {
    const t = computeLayout(movies, links, similarity, log, lastLayout.current);
    lastLayout.current = t;
    return t;
  }, [movies, links, similarity, log]);
  const pos = useTweenedPositions(target);
  const byId = useMemo(() => new Map(movies.map((m) => [m.id, m])), [movies]);

  // Hover / keyboard-focus tooltip: poster thumbnail + key facts, anchored to the star (flips below near the top edge)
  const tip = hover && byId.get(hover) && pos.get(hover) ? { mv: byId.get(hover), p: pos.get(hover) } : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_center,#0b1b3a_0%,#020617_72%)] shadow-[0_0_50px_-20px_rgba(34,211,238,.45)] before:pointer-events-none before:absolute before:inset-0 before:[background-image:linear-gradient(rgba(34,211,238,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.05)_1px,transparent_1px)] before:[background-size:34px_34px]">
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

        {/* Taste rings: the closer to the centre, the closer to what you love */}
        <g aria-hidden="true" fill="none" stroke="#22d3ee" strokeOpacity="0.07" strokeDasharray="3 6">
          {[0.35, 0.65, 1].map((k) => <ellipse key={k} cx={CX} cy={CY} rx={(W / 2 - 70) * k} ry={(H / 2 - 55) * k} />)}
        </g>

        <g filter="url(#edgeGlow)">
          {links.map((l) => {
            const a = pos.get(l.source);
            const b = pos.get(l.target);
            if (!a || !b) return null;
            const active = hover && (hover === l.source || hover === l.target);
            const vis = visibleIds.has(l.source) && visibleIds.has(l.target);
            return (
              <line
                key={`${l.source}-${l.target}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={active ? '#ecfeff' : l.director ? '#e879f9' : '#22d3ee'}
                strokeWidth={active ? 1.8 : 0.5 + l.shared * 0.3}
                strokeOpacity={active ? 0.95 : vis ? (l.director ? 0.4 : 0.2) : 0.04}
              />
            );
          })}
        </g>

        <g>
          {movies.map((mv, i) => {
            const p = pos.get(mv.id);
            if (!p) return null;
            const entry = log[mv.id];
            const acc = accessMap.get(mv.id);
            const s = similarity.get(mv.id) ?? 0.5;
            const r = nodeRadius(entry, s, mv.imdb_rating);
            const rating = entry?.rating || 0;
            const color = acc.accessible ? '#34d399' : '#94a3b8';
            const visible = visibleIds.has(mv.id);
            const unwatched = !entry?.watched;
            const glowing = rating >= 4 || (unwatched && s >= 0.8); // taste match lights a star up
            const label = mv.title.length > 20 ? `${mv.title.slice(0, 19)}…` : mv.title;
            return (
              <g
                key={mv.id}
                transform={`translate(${p.x},${p.y})`}
                opacity={visible && (!focusIds || focusIds.has(mv.id)) ? 1 : 0.15}
                style={{ transition: 'opacity .3s', cursor: 'pointer', pointerEvents: visible ? 'auto' : 'none' }}
                onMouseEnter={() => setHover(mv.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(mv.id)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect(mv.id)}
                tabIndex={0}
                role="button"
                aria-label={`${mv.title}${mv.imdb_rating ? `, IMDb ${mv.imdb_rating}` : ''}${rating ? `, rated ${rating} stars` : unwatched ? `, ${Math.round(s * 100)} percent taste match` : ''}`}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(mv.id)}
              >
                <circle r={Math.max(r + 10, 18)} fill="transparent" />
                {recRank.has(mv.id) && (
                  <g pointerEvents="none">
                    <circle r={r + 10} fill="none" stroke="#fbbf24" strokeWidth={recRank.get(mv.id) === 0 ? 2.5 : 1.5} strokeDasharray={recRank.get(mv.id) === 0 ? undefined : '4 3'} className={recRank.get(mv.id) === 0 ? 'ott-pulse' : ''} />
                    <text y={-r - 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fbbf24">#{recRank.get(mv.id) + 1}</text>
                  </g>
                )}
                {rating === 5 && <circle r={r + 6} fill="none" stroke={color} strokeOpacity="0.45" className="ott-pulse" />}
                <circle
                  r={r}
                  fill={color}
                  fillOpacity={unwatched ? 0.2 + 0.75 * s : 0.95} // brightness = taste similarity
                  filter={glowing ? 'url(#glow)' : undefined}
                  stroke={hover === mv.id ? '#fff' : color}
                  strokeOpacity={hover === mv.id ? 1 : 0.5}
                  strokeWidth={hover === mv.id ? 2 : 1}
                  className={unwatched && !glowing ? 'ott-twinkle' : ''}
                  style={{ animationDelay: `${(i % 6) * 0.5}s` }}
                />
                {rating > 0 && <path d={`M0 ${-r - 6} L2 -2 L${r + 6} 0 L2 2 L0 ${r + 6} L-2 2 L${-r - 6} 0 L-2 -2 Z`} fill={color} fillOpacity={0.35 + rating * 0.1} />}
                <text y={r + 15} textAnchor="middle" className="select-none fill-slate-300" fontSize="10.5" fillOpacity={unwatched ? 0.45 + 0.55 * s : 1} style={{ paintOrder: 'stroke', fontFamily: 'ui-monospace, monospace' }} stroke="#020617" strokeWidth="3">
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <AnimatePresence>
        {tip && (
          <div
            key="tip-anchor"
            className="pointer-events-none absolute z-20"
            style={{
              left: `${Math.min(86, Math.max(14, (tip.p.x / W) * 100))}%`,
              top: `${(tip.p.y / H) * 100}%`,
              transform: tip.p.y < H * 0.42 ? 'translate(-50%, 22px)' : 'translate(-50%, calc(-100% - 22px))',
            }}
          >
            <motion.div
              key={tip.mv.id}
              initial={{ opacity: 0, scale: 0.94, y: tip.p.y < H * 0.42 ? -6 : 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              role="tooltip"
              className="flex w-64 gap-2.5 rounded-xl border border-cyan-400/30 bg-slate-950/90 p-2.5 shadow-[0_0_30px_-8px_rgba(34,211,238,.6)] backdrop-blur-xl"
            >
              <Poster movie={tip.mv} size="sm" eager className="h-[96px] w-16 shrink-0 rounded-md ring-1 ring-white/10" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold text-white">{tip.mv.title}</p>
                <p className="font-mono text-[10px] text-slate-400">
                  {tip.mv.year ? `${tip.mv.year} · ` : ''}{fmtDuration(tip.mv.runtime)}
                </p>
                <ImdbBadge movie={tip.mv} />
                <Badges access={accessMap.get(tip.mv.id)} />
                <p className="font-mono text-[10px] text-cyan-300/80">
                  {log[tip.mv.id]?.watched
                    ? `Your rating: ${'★'.repeat(log[tip.mv.id].rating || 0) || 'not rated'}`
                    : `${Math.round((similarity.get(tip.mv.id) ?? 0.5) * 100)}% taste match · click for details`}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-slate-400">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />on sub / free</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-400" />needs another sub</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full border border-amber-400" />recommended</span>
        <span><i className="mr-1 inline-block h-0.5 w-3 bg-cyan-400" />genre</span>
        <span><i className="mr-1 inline-block h-0.5 w-3 bg-fuchsia-400" />director</span>
        <span>size = IMDb + your rating · brightness &amp; closeness to centre = taste match</span>
      </div>
    </div>
  );
});

export default ConstellationGraph;
