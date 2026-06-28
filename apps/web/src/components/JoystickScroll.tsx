import { useCallback, useRef } from 'react';

interface Props {
  onScroll: (delta: number) => void;
  onRelease?: () => void;
}

const THROTTLE_MS = 50;
const SCROLL_SPEED = 3; // lines per 10px drag

export function JoystickScroll({ onScroll, onRelease }: Props) {
  const dragging = useRef(false);
  const lastY = useRef(0);
  const lastScrollTime = useRef(0);
  const knobOffset = useRef(0);
  const knobRef = useRef<HTMLDivElement>(null);

  const updateKnob = useCallback((offset: number) => {
    knobOffset.current = offset;
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(-50%, ${offset}px)`;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragging.current = true;
    lastY.current = e.touches[0].clientY;
    updateKnob(0);
  }, [updateKnob]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    const now = Date.now();
    if (now - lastScrollTime.current < THROTTLE_MS) return;
    lastScrollTime.current = now;

    const currentY = e.touches[0].clientY;
    const dy = lastY.current - currentY; // positive = drag up → scroll up
    lastY.current = currentY;

    // Visual feedback: accumulate offset, clamp to knob range
    const newOffset = Math.max(-20, Math.min(20, knobOffset.current + dy));
    updateKnob(newOffset);

    // Map drag distance to scroll lines
    const lines = Math.round(dy / 10 * SCROLL_SPEED);
    if (lines !== 0) {
      onScroll(lines);
    }
  }, [onScroll, updateKnob]);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;
    updateKnob(0);
    onRelease?.();
  }, [onRelease, updateKnob]);

  const handleTouchCancel = useCallback(() => {
    dragging.current = false;
    updateKnob(0);
    onRelease?.();
  }, [onRelease, updateKnob]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {/* Track */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '4px',
          height: '70%',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '2px',
        }}
      />
      {/* Knob */}
      <div
        ref={knobRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '28px',
          height: '28px',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '50%',
          transition: 'background 0.15s',
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
