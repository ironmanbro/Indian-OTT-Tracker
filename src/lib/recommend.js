// "Pick my next movie" ranking. Taste comes from the TF-IDF engine (useMovieRecommender), not from raw genre counts.
export const RUNTIME_OPTIONS = [
  { label: 'Any length', value: 0 },
  { label: '≤ 2h', value: 120 },
  { label: '≤ 2h 30m', value: 150 },
  { label: '≤ 3h', value: 180 },
];

/**
 * score = 40% chosen-genre match + 25% taste similarity + 20% accessibility + 15% IMDb quality   (all 0..1)
 *  - taste similarity: similarity.get(id) from the recommender (0.5 = neutral until you've rated something 4–5★)
 *  - accessibility: on your subs = 1, free = 0.9, else 0
 *  - IMDb quality: rating mapped 5→0 … 9→1; neutral 0.5 when the movie has no rating
 * Hard filters: not watched / skipped, runtime cap, (optional) watchable now, ≥1 chosen genre.
 */
export function recommend(movies, log, accessMap, { genres, maxRuntime, accessOnly, skipped, similarity, whyFor }) {
  const out = [];
  for (const mv of movies) {
    if (log[mv.id]?.watched || skipped.has(mv.id)) continue;
    if (maxRuntime && mv.runtime > maxRuntime) continue;
    const acc = accessMap.get(mv.id);
    if (accessOnly && !acc.accessible) continue;
    const matched = mv.genres.filter((g) => genres.has(g));
    if (genres.size && !matched.length) continue;

    const genreScore = genres.size ? matched.length / Math.min(genres.size, mv.genres.length) : 0.5;
    const taste = similarity?.get(mv.id) ?? 0.5;
    const accessScore = acc.isIncluded ? 1 : acc.isFree ? 0.9 : 0;
    const quality = mv.imdb_rating ? Math.min(1, Math.max(0, (mv.imdb_rating - 5) / 4)) : 0.5;
    const score = 0.4 * genreScore + 0.25 * taste + 0.2 * accessScore + 0.15 * quality;

    const reasons = [];
    if (matched.length) reasons.push(`Matches ${matched.join(' + ')}`);
    const why = whyFor ? whyFor(mv.id) : [];
    if (why.length) reasons.push(`Like your 4–5★: ${why.slice(0, 2).join(', ')}`);
    if (mv.imdb_rating >= 7.5) reasons.push(`IMDb ${mv.imdb_rating.toFixed(1)}`);
    if (acc.isIncluded) reasons.push(`On your ${acc.included[0]}`);
    else if (acc.isFree) reasons.push(`Free on ${acc.free[0]}`);
    else if (acc.requires.length) reasons.push(`Needs ${acc.requires[0]} sub`);

    out.push({ movie: mv, score, pct: Math.round(score * 100), reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.movie.runtime - b.movie.runtime);
}
