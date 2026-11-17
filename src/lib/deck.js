// Genre-diverse selection used by the onboarding deck and the constellation graph.
import { DECK_SIZE } from './constants.js';

/**
 * Genre-diverse onboarding deck.
 * A live catalog is sorted by popularity, so slice(0, 25) would be mostly Action/Drama. Instead we
 * greedily pick from the 150 most popular titles, scoring each candidate by
 *   40% popularity (rank in the file)  +  40% genre novelty  +  20% language novelty (mixes Hollywood + Bollywood)
 * where novelty = how rarely its genres / language are already in the deck. A soft cap (30% of the deck
 * per genre) stops any one genre from dominating. Deterministic; same catalog → same deck.
 */
export function pickDiverseDeck(movies, size = DECK_SIZE, poolSize = 150) {
  const seen = new Set();
  const pool = movies.slice(0, poolSize).filter((mv) => {
    const key = mv.title.toLowerCase();
    if (seen.has(key)) return false; // drop duplicate titles (remakes sharing a name)
    seen.add(key);
    return true;
  });
  if (pool.length <= size) return pool;

  const cap = Math.ceil(size * 0.3);
  const genreCount = {}, langCount = {};
  const left = pool.map((mv, i) => ({ mv, pop: 1 - i / pool.length }));
  const deck = [];

  while (deck.length < size && left.length) {
    let best = 0, bestScore = -Infinity;
    for (let i = 0; i < left.length; i++) {
      const { mv, pop } = left[i];
      const novelty = mv.genres.reduce((t, g) => t + 1 / (1 + (genreCount[g] || 0)), 0) / mv.genres.length;
      const langNovelty = 1 / (1 + (langCount[mv.language || '?'] || 0));
      const overCap = mv.genres.some((g) => (genreCount[g] || 0) >= cap) ? 1 : 0;
      const score = 0.4 * pop + 0.4 * novelty + 0.2 * langNovelty - overCap;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    const [{ mv }] = left.splice(best, 1);
    mv.genres.forEach((g) => { genreCount[g] = (genreCount[g] || 0) + 1; });
    langCount[mv.language || '?'] = (langCount[mv.language || '?'] || 0) + 1;
    deck.push(mv);
  }
  return deck;
}
