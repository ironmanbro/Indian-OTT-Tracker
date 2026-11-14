/**
 * Cloudflare Worker (static assets + API) → GET /api/movies
 * Everything else is served from ./dist by the assets binding.
 * Live India catalog from TMDB (popular titles streaming in IN, with providers, runtime, genres,
 * director and imdb_id). The key stays server-side: set TMDB_API_KEY as a Worker secret.
 *
 * - If the key is missing or TMDB fails, returns 503 and the app falls back to /india_movies.json,
 *   then to the built-in demo data.
 * - Cached at the edge for 24h. ≈26 subrequests per cold call (2 discover pages + 24 details),
 *   safely under the Workers free-plan limit of 50.
 * - IMDb ratings are NOT joined here (they come from scripts/sync_india_movies.py → public/india_movies.json).
 */
const BASE = 'https://api.themoviedb.org/3';
const REGION = 'IN';
const COUNT = 24;

// TMDB provider names → the app's pill names. Unmatched names pass through unchanged.
const PILL_RULES = [
  [/^netflix/i, 'Netflix'],
  [/prime video/i, 'Amazon Prime Video'],
  [/hotstar/i, 'JioHotstar'],
  [/zee ?5/i, 'Zee5'],
  [/sony ?liv/i, 'SonyLIV'],
  [/jio ?cinema/i, 'JioCinema'],
];
export const normalizeProvider = (name) => (PILL_RULES.find(([re]) => re.test(name)) || [])[1] || name;
const uniq = (a) => [...new Set(a)];

async function tmdb(env, path, params = {}) {
  const key = env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY is not set');
  const url = new URL(BASE + path);
  const headers = { accept: 'application/json' };
  if (key.length > 60) headers.Authorization = `Bearer ${key}`; // v4 read token (JWT)
  else url.searchParams.set('api_key', key); // v3 key
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`); // path only — never leak the key
  return res.json();
}

export function toMovie(d) {
  const rp = d['watch/providers']?.results?.[REGION] || {};
  const names = (arr = []) => arr.map((p) => normalizeProvider(p.provider_name));
  return {
    id: String(d.id),
    title: d.title,
    genres: (d.genres || []).map((g) => g.name),
    runtime: d.runtime || 0,
    platforms: {
      flatrate: uniq(names(rp.flatrate)),
      free: uniq([...names(rp.free), ...names(rp.ads)]), // "free" and "free with ads" both count as free
    },
    poster: d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : null,
    year: d.release_date ? Number(d.release_date.slice(0, 4)) : null,
    language: d.original_language || null,
    themes: (d.keywords?.keywords || []).map((k) => k.name.trim().toLowerCase().replace(/\s+/g, '-')).slice(0, 8),
    director: (d.credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name).join(', ').slice(0, 80) || null,
    imdb_id: d.imdb_id || null,
  };
}

async function fetchCatalog(env) {
  const pages = await Promise.all(
    [1, 2].map((page) =>
      tmdb(env, '/discover/movie', {
        watch_region: REGION,
        with_watch_monetization_types: 'flatrate|free|ads',
        sort_by: 'popularity.desc',
        'vote_count.gte': 200,
        language: 'en-US',
        page,
      }),
    ),
  );
  const ids = uniq(pages.flatMap((p) => p.results.map((r) => r.id))).slice(0, COUNT);
  const details = await Promise.all(
    ids.map((id) => tmdb(env, `/movie/${id}`, { append_to_response: 'watch/providers,credits,keywords', language: 'en-US' }).catch(() => null)),
  );
  return details
    .filter(Boolean)
    .map(toMovie)
    .filter((m) => m.runtime > 0 && m.genres.length && (m.platforms.flatrate.length || m.platforms.free.length));
}

async function handleMovies(request, env, ctx) {
  const edge = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(new URL('/api/movies', request.url).toString());
  if (edge) {
    const hit = await edge.match(cacheKey);
    if (hit) return hit;
  }
  try {
    const movies = await fetchCatalog(env);
    const res = Response.json({ movies }, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
    if (edge && ctx) ctx.waitUntil(edge.put(cacheKey, res.clone()));
    return res;
  } catch {
    return Response.json({ error: 'catalog_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/movies' && request.method === 'GET') return handleMovies(request, env, ctx);
    return env.ASSETS.fetch(request); // static site (dist/); unknown paths → real 404
  },
};
