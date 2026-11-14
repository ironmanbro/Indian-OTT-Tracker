import { useEffect, useState } from 'react';
import mock from '../data/india_movies_mock.json';
import { withPosters } from '../lib/poster.js';

export const MOCK_MOVIES = withPosters(mock);

/** Catalog loader: /api/movies (live TMDB) → /india_movies.json (synced file, with IMDb ratings) → bundled mock data. */
export function useCatalog() {
  const [state, setState] = useState({ movies: MOCK_MOVIES, source: 'demo', ready: false });

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async (url) => {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      const list = Array.isArray(data) ? data : data.movies;
      if (!Array.isArray(list) || list.length < 6) throw new Error('too few movies');
      return list;
    };
    load('/api/movies')
      .catch(() => load('/india_movies.json'))
      .then((list) => ({ movies: withPosters(list), source: 'tmdb', ready: true }))
      .catch(() => ({ movies: MOCK_MOVIES, source: 'demo', ready: true }))
      .then((st) => { if (!ctrl.signal.aborted) setState(st); });
    return () => ctrl.abort();
  }, []);

  return state;
}
