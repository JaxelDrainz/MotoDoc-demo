import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Every card in the landing page, authentication, and account area. The driver dashboard
// (../dashboard-next) has the same effect in its own components/PixelFill.tsx.
const CARDS = '.feature,.appointment-card,.auth-card,.dash-page-header,.dash-stats article,.dash-tile,.dash-list,.dash-empty,.dash-overview-note';
const CELL = 16;
const DURATION_MS = 450;
const GREENS = ['#8AC9AC', '#A7F3D0'];

/** Pale pixel squares that grow from the card's bottom-left corner to its top-right until they fill it. */
function PixelFill({ active }) {
  const canvas = useRef(null), target = useRef(0), animate = useRef(() => {});

  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d');
    if (!element || !context) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0, height = 0, progress = 0, frame = 0, last = 0;

    const paint = () => {
      const columns = Math.ceil(width / CELL), rows = Math.ceil(height / CELL), front = progress * (columns + rows);
      context.clearRect(0, 0, width, height);
      for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const diagonal = column + row;
        if (diagonal >= front) continue;
        // Pale, slightly uneven tints keep the text above readable; the leading edge is a touch stronger.
        const leading = progress < 1 && front - diagonal < 3;
        context.globalAlpha = 0.16 + ((column * 7 + row * 13) % 5) * 0.035 + (leading ? 0.22 : 0);
        context.fillStyle = GREENS[leading ? 0 : 1];
        context.fillRect(column * CELL, height - (row + 1) * CELL, CELL, CELL);
      }
    };
    const tick = now => {
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
    animate.current();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); animate.current = () => {}; };
  }, []);

  useEffect(() => { target.current = active ? 1 : 0; animate.current(); }, [active]);

  return <canvas ref={canvas} aria-hidden="true" className="pixel-fill" />;
}

/**
 * Mounted once for the whole app. Hover, keyboard focus, or a tap (which toggles) on any card
 * switches its fill on; the canvas is added to that card through a portal, behind its content.
 */
export function PixelCards() {
  const [cards, setCards] = useState([]);
  const ids = useRef(new WeakMap()), nextId = useRef(0);

  useEffect(() => {
    const card = node => node instanceof Element ? node.closest(CARDS) : null;
    const set = (element, active) => setCards(list => {
      const current = list.find(item => item.element === element)?.active ?? false;
      return [...list.filter(item => item.element !== element && item.element.isConnected), { element, active: typeof active === 'function' ? active(current) : active }];
    });
    const entered = event => { const element = card(event.target); if (element && !element.contains(event.relatedTarget)) set(element, true); };
    const left = event => { const element = card(event.target); if (element && !element.contains(event.relatedTarget)) set(element, false); };
    const over = event => { if (event.pointerType === 'mouse') entered(event); };
    const out = event => { if (event.pointerType === 'mouse') left(event); };
    const down = event => { const element = event.pointerType !== 'mouse' && card(event.target); if (element) set(element, value => !value); };
    const listeners = [['pointerover', over], ['pointerout', out], ['pointerdown', down], ['focusin', entered], ['focusout', left]];
    listeners.forEach(([type, listener]) => document.addEventListener(type, listener));
    return () => listeners.forEach(([type, listener]) => document.removeEventListener(type, listener));
  }, []);

  return cards.map(({ element, active }) => {
    if (!ids.current.has(element)) ids.current.set(element, nextId.current++);
    return createPortal(<PixelFill active={active} />, element, ids.current.get(element));
  });
}
