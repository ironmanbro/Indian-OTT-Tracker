// Inline-SVG placeholder poster (no network needed) for movies without artwork.

// Inline SVG placeholder poster (no network needed)
export const poster = (title, hue) => {
  const t = title.length > 22 ? title.slice(0, 21) + '…' : title;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},70%,35%)'/><stop offset='1' stop-color='hsl(${(hue + 50) % 360},60%,10%)'/></linearGradient></defs><rect width='300' height='450' fill='url(#g)'/><text x='150' y='235' fill='white' fill-opacity='.9' font-family='sans-serif' font-size='24' font-weight='700' text-anchor='middle'>${t.replace(/&/g, '&amp;')}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/** Give every movie without artwork a placeholder poster (hue from the data, else spread by index). */
export const withPosters = (list) => list.map((mv, i) => ({ ...mv, poster: mv.poster || poster(mv.title, mv.hue ?? (i * 47) % 360) }));
