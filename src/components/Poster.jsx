// <Poster/>: TMDB poster with a graceful fallback.
// A dark gradient + title typography is always rendered underneath; the <img> fades in over it when it loads.
// If there is no poster URL, or the image fails to load, the fallback graphic simply stays visible.
import { memo, useEffect, useState } from 'react';

const TITLE_SIZE = { sm: 'text-[9px]', md: 'text-sm', lg: 'text-3xl' };

export const Poster = memo(function Poster({ movie, className = '', size = 'md', eager = false, align = 'end' }) {
  const src = movie.poster;
  const [status, setStatus] = useState(src ? 'loading' : 'error'); // loading | loaded | error
  useEffect(() => setStatus(src ? 'loading' : 'error'), [src]);

  const hue = movie.hue ?? 0;
  const showImg = src && status !== 'error';
  return (
    <div
      className={`relative overflow-hidden bg-slate-900 ${className}`}
      data-poster={status}
      role={showImg ? undefined : 'img'}
      aria-label={showImg ? undefined : `${movie.title} (poster unavailable)`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 flex flex-col p-[9%] ${align === 'center' ? 'items-center justify-center text-center' : 'justify-end'}`}
        style={{ background: `radial-gradient(120% 80% at 15% 0%, hsl(${hue} 70% 34% / .55), transparent 60%), linear-gradient(165deg, hsl(${hue} 45% 18%), hsl(${(hue + 40) % 360} 40% 6%))` }}
      >
        <span className={`h-px bg-white/30 ${align === 'center' ? 'mb-4 w-12' : 'mb-[7%] w-1/3'}`} />
        <span className={`line-clamp-4 break-words font-black uppercase leading-[1.05] tracking-tight text-white/90 ${TITLE_SIZE[size] || TITLE_SIZE.md}`}>{movie.title}</span>
        {movie.year && align !== 'center' ? <span className="mt-1 font-mono text-[9px] text-white/50">{movie.year}</span> : null}
      </div>
      {showImg && (
        <img
          src={src}
          alt={`${movie.title} poster`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
});

export default Poster;
