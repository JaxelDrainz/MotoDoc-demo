'use client';

import { useEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react';

const CELL = 16;
const DURATION_MS = 450;
const GREENS = ['#064E3B', '#226B55', '#478A72', '#6BA98F', '#8AC9AC', '#A7F3D0'];

/** Hover, keyboard focus, or a tap (which toggles) switches a card's pixel fill on. */
export function usePixelFill() {
  const [active, setActive] = useState(false);
  return {
    active,
    handlers: {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => { if (event.pointerType === 'mouse') setActive(true); },
      onPointerLeave: (event: PointerEvent<HTMLElement>) => { if (event.pointerType === 'mouse') setActive(false); },
      onPointerDown: (event: PointerEvent<HTMLElement>) => { if (event.pointerType !== 'mouse') setActive(value => !value); },
      onFocus: () => setActive(true),
      onBlur: (event: FocusEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(false); },
    },
  };
}

/**
 * The stepped pixel motif, drawn behind a card's content. When active it grows from the
 * bottom-left corner to the top-right until it fills the card. With `corner`, the dark
 * six-step triangle stays in the corner at rest, as on the vehicle card.
 */
export default function PixelFill({ active, corner = false }: { active: boolean; corner?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef(0);
  const animate = useRef(() => {});

  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d');
    if (!element || !context) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0, height = 0, progress = target.current, frame = 0, last = 0;

    const paint = () => {
      const columns = Math.ceil(width / CELL), rows = Math.ceil(height / CELL), front = progress * (columns + rows);
      context.clearRect(0, 0, width, height);
      for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const diagonal = column + row, inCorner = corner && diagonal <= 5;
        if (!inCorner && diagonal >= front) continue;
        if (inCorner) {
          context.globalAlpha = 0.35 + (5 - row) * 0.13;
          context.fillStyle = GREENS[Math.min(5, diagonal)];
        } else {
          // Pale, slightly uneven tints keep the text above readable; the leading edge is a touch stronger.
          const leading = progress < 1 && front - diagonal < 3;
          context.globalAlpha = 0.16 + ((column * 7 + row * 13) % 5) * 0.035 + (leading ? 0.22 : 0);
          context.fillStyle = leading ? GREENS[4] : GREENS[5];
        }
        context.fillRect(column * CELL, height - (row + 1) * CELL, CELL, CELL);
      }
    };
    const tick = (now: number) => {
      // Timed rather than per frame, so it takes the same time on any display and finishes even if frames are skipped.
      const step = reducedMotion.matches ? 1 : Math.min(1, (now - last) / DURATION_MS), distance = target.current - progress;
      last = now;
      progress = Math.abs(distance) <= step ? target.current : progress + Math.sign(distance) * step;
      paint();
      frame = progress === target.current ? 0 : requestAnimationFrame(tick);
    };
    animate.current = () => { if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); } };

    const observer = new ResizeObserver(() => {
      const scale = window.devicePixelRatio || 1;
      width = element.clientWidth; height = element.clientHeight;
      element.width = Math.round(width * scale); element.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      paint();
    });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); animate.current = () => {}; };
  }, [corner]);

  useEffect(() => { target.current = active ? 1 : 0; animate.current(); }, [active]);

  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
