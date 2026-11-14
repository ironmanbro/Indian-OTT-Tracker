// TMDB poster CDN helpers. Posters are served at  https://image.tmdb.org/t/p/w500/<poster_path>
export const TMDB_IMG = 'https://image.tmdb.org/t/p';
export const POSTER_SIZE = 'w500';

export const tmdbPoster = (path, size = POSTER_SIZE) =>
  path ? `${TMDB_IMG}/${size}${path.startsWith('/') ? path : `/${path}`}` : null;

const TMDB_URL = /^(https:\/\/image\.tmdb\.org\/t\/p\/)(?:w\d+|original)(\/.+)$/;

/** Best poster URL for a movie: `poster_path` → w500 CDN URL; legacy TMDB URLs (w342, …) are upgraded to w500;
 *  other absolute URLs are kept; anything else → null (the <Poster/> fallback graphic takes over). */
export function posterOf(mv) {
  if (mv.poster_path) return tmdbPoster(mv.poster_path);
  const p = mv.poster;
  if (typeof p !== 'string' || !/^https?:\/\//.test(p)) return null;
  const m = p.match(TMDB_URL);
  return m ? `${m[1]}${POSTER_SIZE}${m[2]}` : p;
}

/** Stable 0–359 hue derived from the title (colours the fallback graphic). */
export const hueOf = (title = '') => {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
  return h;
};

/** Normalise a catalog: resolve poster URLs and make sure every movie has a hue. */
export const withPosters = (list) => list.map((mv) => ({ ...mv, poster: posterOf(mv), hue: mv.hue ?? hueOf(mv.title) }));
