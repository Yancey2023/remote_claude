import { useEffect, useMemo, useState } from 'react';

function supportsMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

export function useIsMobile(maxWidth = 900): boolean {
  const query = useMemo(() => `(max-width: ${maxWidth}px)`, [maxWidth]);
  const [isMobile, setIsMobile] = useState(() => {
    if (!supportsMatchMedia()) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!supportsMatchMedia()) return;
    const mql = window.matchMedia(query);
    const update = () => setIsMobile(mql.matches);
    update();

    const listener = () => update();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', listener);
      return () => mql.removeEventListener('change', listener);
    }

    mql.addListener(listener);
    return () => mql.removeListener(listener);
  }, [query]);

  return isMobile;
}
