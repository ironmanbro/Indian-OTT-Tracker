/**
 * Content-based recommender: TF-IDF feature vectors + cosine similarity. Pure functions (no React).
 *
 * Features per movie (each keeps multi-word values as ONE token, e.g. "Kiran Rao", not "kiran" + "rao"):
 *   genre ×3 · theme (TMDB keywords / hand-tagged) ×1.5 · director ×2 · language ×0.5
 * Weights are multiplied by IDF, so rare shared signals (a director, a niche theme) count for more
 * than ubiquitous ones ("Drama").
 *
 * Taste profile = Σ coef · vector, over the movies you rated:
 *   5★ → +2 · 4★ → +1 · 3★ → 0 · 2★ → −0.5 · 1★ → −1     (so ratings of 4–5★ drive it; low ratings push away)
 * Each movie is then scored by cosine(profile, movie). With no 4–5★ rating yet the engine stays neutral.
 */
export const FIELD_WEIGHT = { genre: 3, theme: 1.5, director: 2, language: 0.5 };

const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, '_');

/** movie → Map(featureKey → field weight). featureKey = "field:value". */
export function featuresOf(mv) {
  const f = new Map();
  const add = (field, value) => {
    if (value) f.set(`${field}:${norm(value)}`, FIELD_WEIGHT[field]);
  };
  (mv.genres || []).forEach((g) => add('genre', g));
  (mv.themes || []).forEach((t) => add('theme', t));
  String(mv.director || '').split(',').forEach((d) => add('director', d));
  add('language', mv.language);
  return f;
}

/** Display label for a feature key. */
const labelCache = new Map();
function labelOf(key, mv) {
  if (labelCache.has(key)) return labelCache.get(key);
  const [field, value] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  let label = value.replace(/_/g, ' ');
  if (field === 'genre') label = (mv.genres || []).find((g) => norm(g) === value) || label;
  if (field === 'director') label = `dir. ${(mv.director || '').split(',').map((x) => x.trim()).find((d) => norm(d) === value) || label}`;
  if (field === 'language') label = `${label} cinema`;
  labelCache.set(key, label);
  return label;
}

/** Build the catalog index once per catalog: IDF + L2-normalised TF-IDF vectors. */
export function buildIndex(movies) {
  const n = movies.length;
  const df = new Map();
  const raw = movies.map((mv) => {
    const f = featuresOf(mv);
    f.forEach((_, k) => df.set(k, (df.get(k) || 0) + 1));
    return f;
  });
  const idf = (k) => Math.log((1 + n) / (1 + df.get(k))) + 1; // smoothed, like scikit-learn
  const vectors = new Map();
  const labels = new Map();
  movies.forEach((mv, i) => {
    const v = new Map();
    let sq = 0;
    raw[i].forEach((w, k) => {
      const x = w * idf(k);
      v.set(k, x);
      sq += x * x;
      if (!labels.has(k)) labels.set(k, labelOf(k, mv));
    });
    const len = Math.sqrt(sq) || 1;
    v.forEach((x, k) => v.set(k, x / len));
    vectors.set(mv.id, v);
  });
  return { vectors, labels };
}

const dot = (a, b) => {
  let s = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  small.forEach((x, k) => { const y = big.get(k); if (y) s += x * y; });
  return s;
};
const len = (a) => { let s = 0; a.forEach((x) => { s += x * x; }); return Math.sqrt(s); };

const coefFor = (rating) => (rating >= 4 ? rating - 3 : rating >= 1 && rating <= 2 ? -0.5 * (3 - rating) : 0);

/** Σ coef·vector over rated movies. Returns null when there's no 4–5★ signal yet. */
export function buildProfile(index, log) {
  const profile = new Map();
  let positive = 0;
  for (const [id, entry] of Object.entries(log || {})) {
    const v = index.vectors.get(id);
    const c = entry?.watched ? coefFor(entry.rating || 0) : 0;
    if (!v || !c) continue;
    if (c > 0) positive += 1;
    v.forEach((x, k) => profile.set(k, (profile.get(k) || 0) + c * x));
  }
  return positive ? profile : null;
}

/**
 * Score the whole catalog against the user's taste.
 * Returns:
 *   similarity  Map(id → 0..1)   brightness / proximity driver (watched 4–5★ = 1, neutral 0.5 when no profile yet)
 *   ranked      [{movie, score, raw, why}]  UNWATCHED movies, best first
 *   topFeatures [{key,label,weight}]        what the engine learned you like (weight 0..1)
 *   whyFor(id)  → up to 3 feature labels that drive a movie's score
 */
export function scoreCatalog(index, movies, log) {
  const profile = buildProfile(index, log);
  const similarity = new Map();
  if (!profile) {
    movies.forEach((mv) => similarity.set(mv.id, 0.5));
    return { similarity, ranked: [], topFeatures: [], whyFor: () => [], hasProfile: false };
  }
  const plen = len(profile) || 1;
  const raw = new Map(movies.map((mv) => [mv.id, dot(profile, index.vectors.get(mv.id)) / plen]));
  const unwatched = movies.filter((mv) => !log[mv.id]?.watched);
  const maxRaw = Math.max(1e-9, ...unwatched.map((mv) => raw.get(mv.id)));

  const whyFor = (id) => {
    const v = index.vectors.get(id);
    if (!v) return [];
    return [...v.entries()]
      .map(([k, x]) => [k, x * (profile.get(k) || 0)])
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => index.labels.get(k));
  };

  for (const mv of movies) {
    const e = log[mv.id];
    const s = e?.watched && (e.rating || 0) >= 4 ? 1 : Math.min(1, Math.max(0, raw.get(mv.id) / maxRaw));
    similarity.set(mv.id, s);
  }
  const ranked = unwatched
    .map((mv) => ({ movie: mv, score: similarity.get(mv.id), raw: raw.get(mv.id), why: whyFor(mv.id) }))
    .sort((a, b) => b.raw - a.raw);

  const maxW = Math.max(...profile.values(), 1e-9);
  const topFeatures = [...profile.entries()]
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, w]) => ({ key, label: index.labels.get(key), weight: w / maxW }));
  return { similarity, ranked, topFeatures, whyFor, hasProfile: true };
}
