// Onboarding step 1: streaming subscription matrix.
import { motion } from 'framer-motion';
import { Screen } from './shared.jsx';
import { PLATFORMS } from '../lib/constants.js';

/* ── Step A: streaming setup ── */
export function SubsStep({ subs, onToggle, onNext }) {
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

export default SubsStep;
