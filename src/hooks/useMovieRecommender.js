import { useEffect, useMemo, useState } from 'react';
import { buildIndex, scoreCatalog } from '../lib/recommender.js';
import { LOG_EVENT, STORAGE_KEY } from '../lib/constants.js';

/** Reads the saved watch log ({ [movieId]: { watched, rating } }) from localStorage. Safe on the server / when blocked. */
export function readStoredLog(key = STORAGE_KEY) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || 'null');
    return saved && typeof saved.log === 'object' && saved.log ? saved.log : {};
  } catch {
    return {};
  }
}

/**
 * useMovieRecommender(movies, liveLog?)
 *
 * - Without `liveLog` the hook reads the user's swiped/rated movies from localStorage itself and stays in sync
 *   (same-tab saves via the LOG_EVENT the app fires, other tabs via the `storage` event).
 * - Pass the in-memory log as `liveLog` (as the dashboard does) to skip the storage round-trip.
 *
 * Returns { similarity, ranked, topFeatures, whyFor, hasProfile } — see scoreCatalog() in lib/recommender.js.
 *   similarity  Map(id → 0..1)  → node brightness + cluster proximity in the constellation graph
 *   ranked      unwatched movies, most similar to your 4–5★ taste first
 */
export function useMovieRecommender(movies, liveLog) {
  const [stored, setStored] = useState(() => (liveLog ? {} : readStoredLog()));

  useEffect(() => {
    if (liveLog) return undefined;
    const refresh = () => setStored(readStoredLog());
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener(LOG_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(LOG_EVENT, refresh);
    };
  }, [liveLog]);

  const log = liveLog || stored;
  const index = useMemo(() => buildIndex(movies), [movies]); // once per catalog
  return useMemo(() => scoreCatalog(index, movies, log), [index, movies, log]); // on every rating change
}
