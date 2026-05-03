import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from './useIsMobile';

let mediaMatches = false;
let mediaListeners = new Set<(e: MediaQueryListEvent) => void>();

function emitMediaChange(matches: boolean) {
  mediaMatches = matches;
  const event = { matches } as MediaQueryListEvent;
  for (const listener of mediaListeners) {
    listener(event);
  }
}

function Probe() {
  const isMobile = useIsMobile(900);
  return <div data-testid="mobile-state">{String(isMobile)}</div>;
}

beforeEach(() => {
  mediaMatches = false;
  mediaListeners = new Set<(e: MediaQueryListEvent) => void>();

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((_query: string) => {
      const mql = {
        media: _query,
        onchange: null,
        addEventListener: (_type: 'change', listener: (e: MediaQueryListEvent) => void) => {
          mediaListeners.add(listener);
        },
        removeEventListener: (_type: 'change', listener: (e: MediaQueryListEvent) => void) => {
          mediaListeners.delete(listener);
        },
        addListener: (listener: (e: MediaQueryListEvent) => void) => {
          mediaListeners.add(listener);
        },
        removeListener: (listener: (e: MediaQueryListEvent) => void) => {
          mediaListeners.delete(listener);
        },
        dispatchEvent: () => true,
      } as unknown as MediaQueryList;
      Object.defineProperty(mql, 'matches', {
        get: () => mediaMatches,
      });
      return mql;
    }),
  });
});

describe('useIsMobile', () => {
  it('returns false when media query does not match', () => {
    render(<Probe />);
    expect(screen.getByTestId('mobile-state').textContent).toBe('false');
  });

  it('returns true when media query matches at mount', () => {
    mediaMatches = true;
    render(<Probe />);
    expect(screen.getByTestId('mobile-state').textContent).toBe('true');
  });

  it('reacts to media query changes', () => {
    render(<Probe />);
    expect(screen.getByTestId('mobile-state').textContent).toBe('false');

    act(() => emitMediaChange(true));
    expect(screen.getByTestId('mobile-state').textContent).toBe('true');

    act(() => emitMediaChange(false));
    expect(screen.getByTestId('mobile-state').textContent).toBe('false');
  });
});
