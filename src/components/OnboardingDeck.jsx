// Onboarding step 2: Tinder-style swipe deck (drag, buttons or ← → keys) + star-rating prompt.
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { Badges, ImdbBadge, Screen, Star } from './shared.jsx';
import { getAccess } from '../lib/access.js';
import { fmtDuration } from '../lib/format.js';

/* ── Rating prompt (shown after a swipe right) ── */
export function RatingPrompt({ movie, onRate, onCancel }) {
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
export const cardVariants = {
  enter: { scale: 0.95, opacity: 0 },
  center: { scale: 1, opacity: 1 },
  exit: (d) => ({ x: d === 'right' ? 460 : -460, opacity: 0, transition: { duration: 0.28 } }),
};

export function SwipeCard({ movie, access, dir, onSwipe }) {
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
export function OnboardingDeck({ deck, subs, log, setLog, onDone, onBack }) {
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

export default OnboardingDeck;
