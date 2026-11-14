// Shared constants + provider deep-links.

export const PLATFORMS = ['Netflix', 'Amazon Prime Video', 'JioHotstar', 'Zee5', 'SonyLIV', 'JioCinema'];

export const STORAGE_KEY = 'cineterminal-in-v1';

export const DECK_SIZE = 25;

// Search deep-links per provider (TMDB's API only gives a JustWatch page per region, not per-app URLs).
// NOTE: these URL patterns are best-effort and unverified — confirm them before launch.
export const PLATFORM_SEARCH = {
  Netflix: (q) => `https://www.netflix.com/search?q=${q}`,
  'Amazon Prime Video': (q) => `https://www.primevideo.com/search/?phrase=${q}`,
  JioHotstar: (q) => `https://www.hotstar.com/in/search?q=${q}`,
  Zee5: (q) => `https://www.zee5.com/search?q=${q}`,
  SonyLIV: (q) => `https://www.sonyliv.com/search?searchTerm=${q}`,
  JioCinema: (q) => `https://www.jiocinema.com/search/${q}`,
  YouTube: (q) => `https://www.youtube.com/results?search_query=${q}`,
  'MX Player': (q) => `https://www.mxplayer.in/search?q=${q}`,
};

export const providerLink = (provider, title) =>
  PLATFORM_SEARCH[provider]
    ? PLATFORM_SEARCH[provider](encodeURIComponent(title))
    : `https://www.google.com/search?q=${encodeURIComponent(`watch ${title} on ${provider}`)}`;

/* ───────────────────────── Helpers ───────────────────────── */

export const GRAPH_MAX = 60; // cap on stars in the graph: edges grow O(n²), so a 1,000-movie file must not all go in
export const LOG_EVENT = 'cineterminal:log'; // fired after the watch log is saved, so other readers of localStorage refresh
