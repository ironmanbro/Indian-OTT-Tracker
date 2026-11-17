import { useEffect, useState } from 'react';
import mock from '../data/india_movies_mock.json';
import { withPosters } from '../lib/poster.js';

export const MOCK_MOVIES = withPosters(mock);

/** Catalog loader: /india_movies.json (built catalog, IMDb ratings) → /api/movies (live TMDB, 24 titles) → bundled mock data. */
export function useCatalog() {
  const [state, setState] = useState({ movies: MOCK_MOVIES, source: 'demo', ready: false, attribution: '', availability: true });

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async (url) => {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      const list = Array.isArray(data) ? data : data.movies;
      if (!Array.isArray(list) || list.length < 6) throw new Error('too few movies');
      return { list, attribution: data.attribution || '', availability: data.availability !== false };
    };
    // the big static catalog first (hundreds/thousands of titles); the 24-title live API is only a fallback
    load('/india_movies.json')
      .catch(() => load('/api/movies'))
      .then(({ list, attribution, availability }) => ({ movies: withPosters(list), source: 'tmdb', ready: true, attribution, availability }))
      .catch(() => ({ movies: MOCK_MOVIES, source: 'demo', ready: true, attribution: '', availability: true }))
      .then((st) => { if (!ctrl.signal.aborted) setState(st); });
    return () => ctrl.abort();
  }, []);

  return state;
}
