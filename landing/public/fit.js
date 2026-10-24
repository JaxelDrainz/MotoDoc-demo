(() => {
  const MAX_LEVEL = 4;
  const slack = 1;

  const shown = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.position !== 'absolute' &&
      style.position !== 'fixed'
    );
  };

  const extent = (el) => {
    const rect = el.getBoundingClientRect();
    if (getComputedStyle(el).overflowX !== 'visible') return rect;
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    if (!text.width) return rect;
    return {
      left: Math.min(rect.left, text.left),
      right: Math.max(rect.right, text.right),
      top: Math.min(rect.top, text.top),
      bottom: Math.max(rect.bottom, text.bottom),
    };
  };

  const fits = (row) => {
    if (row.scrollWidth > row.clientWidth + slack) return false;
    const edge = row.getBoundingClientRect();
    const boxes = [...row.children].filter(shown).map(extent);
    for (const box of boxes)
      if (box.left < edge.left - slack || box.right > edge.right + slack) return false;
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (
          a.left < b.right - slack &&
          b.left < a.right - slack &&
          a.top < b.bottom - slack &&
          b.top < a.bottom - slack
        )
          return false;
      }
    return true;
  };

  const fit = (row) => {
    row.removeAttribute('data-fit-level');
    let level = 0;
    while (level < MAX_LEVEL && !fits(row)) {
      level += 1;
      row.setAttribute('data-fit-level', Array.from({ length: level }, (_, i) => i + 1).join(' '));
    }
  };

  const watched = new WeakSet();
  const sizes = new ResizeObserver(() => schedule());
  let queued = false;

  const run = () => {
    queued = false;
    document.querySelectorAll('[data-fit]').forEach((row) => {
      if (!watched.has(row)) {
        watched.add(row);
        sizes.observe(row);
      }
      fit(row);
    });
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  addEventListener('resize', schedule);
  addEventListener('orientationchange', schedule);
  addEventListener('motodoc-lang', schedule);
  document.fonts?.ready.then(schedule);
  document.fonts?.addEventListener?.('loadingdone', schedule);
  schedule();
})();
