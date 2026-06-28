import { useEffect, useState } from 'react';

const supportsMatchMedia = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const sharedMql = supportsMatchMedia()
  ? window.matchMedia('(max-width: 900px)')
  : null;

export function useIsMobile(maxWidth = 900): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (!supportsMatchMedia()) return false;
    const mql = maxWidth === 900 && sharedMql
      ? sharedMql
      : window.matchMedia(`(max-width: ${maxWidth}px)`);
    return mql.matches;
  });

  useEffect(() => {
    if (!supportsMatchMedia()) return;
    const mql = maxWidth === 900 && sharedMql
      ? sharedMql
      : window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mql.matches);
    update();

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }

    mql.addListener(update);
    return () => mql.removeListener(update);
  }, [maxWidth]);

  return isMobile;
}
