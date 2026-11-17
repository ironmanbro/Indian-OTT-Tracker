// CineTerminal IN — root: catalog loading, saved profile, and the stage machine  loading → subs → swipe → dash.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Screen } from './components/shared.jsx';
import SubsStep from './components/SubsStep.jsx';
import OnboardingDeck from './components/OnboardingDeck.jsx';
import Dashboard from './components/Dashboard.jsx';
import { useCatalog } from './hooks/useCatalog.js';
import { LOG_EVENT, STORAGE_KEY } from './lib/constants.js';
import { pickDiverseDeck } from './lib/deck.js';

export default function App() {
  const { movies, source, ready, attribution, availability } = useCatalog();
  const [stage, setStage] = useState('loading'); // loading → subs → swipe → dash
  const [subs, setSubs] = useState(() => new Set());
  const [log, setLog] = useState({}); // { [movieId]: { watched: true, rating: 1-5 } }
  const hydrated = useRef(false);

  // Restore the saved profile once the catalog is known (client only → no SSR mismatch)
  useEffect(() => {
    if (!ready || hydrated.current) return;
    let next = 'subs';
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) {
        if (Array.isArray(saved.subs)) setSubs(new Set(saved.subs));
        // Ratings are keyed by movie id; mock and live catalogs use different ids, so only reuse a matching profile.
        if (saved.source === source) {
          if (saved.log && typeof saved.log === 'object') setLog(saved.log);
          if (saved.onboarded) next = 'dash';
        }
      }
    } catch { /* storage unavailable */ }
    hydrated.current = true;
    setStage(next);
  }, [ready, source]);

  // Persist; tell other readers of the log (e.g. a standalone useMovieRecommender) to refresh
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ subs: [...subs], log, source, onboarded: stage === 'dash' }));
      window.dispatchEvent(new Event(LOG_EVENT));
    } catch { /* ignore */ }
  }, [subs, log, stage, source]);

  const toggleSub = useCallback((p) => setSubs((prev) => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; }), []);
  const startSwipe = useCallback(() => { setLog({}); setStage('swipe'); }, []);
  const deck = useMemo(() => pickDiverseDeck(movies), [movies]);

  let view;
  if (stage === 'loading') view = <Screen><div className="my-auto font-mono text-sm text-cyan-300/70">INITIALISING TERMINAL…</div></Screen>;
  else if (stage === 'subs') view = <SubsStep subs={subs} onToggle={toggleSub} onNext={startSwipe} />;
  else if (stage === 'swipe') view = <OnboardingDeck deck={deck} subs={subs} log={log} setLog={setLog} onDone={() => setStage('dash')} onBack={() => setStage('subs')} />;
  else view = <Dashboard movies={movies} source={source} attribution={attribution} availability={availability} subs={subs} setSubs={setSubs} log={log} setLog={setLog} onRetake={() => setStage('subs')} />;

  // opacity-only transition: no transform/filter, so position:fixed drawers inside keep working
  return (
    <AnimatePresence mode="wait">
      <motion.div key={stage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
        {view}
      </motion.div>
    </AnimatePresence>
  );
}
