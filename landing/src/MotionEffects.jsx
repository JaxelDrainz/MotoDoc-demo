import { useEffect } from 'react';
import './motion.css';

// Observe only new content. Saving data must not replay the whole page entrance.
const revealSelector = '.section-heading,.feature,.benefit,.garage-intro,.perk,.steps li,.closing-inner,.context-photo,.dash-tile,.dash-row';
export function MotionEffects() {
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let stop = () => {};
    function start() {
      stop();
      if (preference.matches) return;
      const tracked = new Set();
      const observer = new IntersectionObserver(entries => {
        entries.forEach(({target,isIntersecting}) => {
          if (!isIntersecting) return;
          target.classList.add('motion-visible');
          observer.unobserve(target);
        });
      }, {threshold:0.08,rootMargin:'0px 0px -24px 0px'});
      const prepare = node => {
        if (!(node instanceof Element)) return;
        const candidates = [...node.querySelectorAll(revealSelector)];
        if (node.matches(revealSelector)) candidates.unshift(node);
        candidates.forEach(el => {
          if (tracked.has(el)) return;
          tracked.add(el);
          const siblings = [...el.parentElement.children].filter(child=>child.matches(revealSelector));
          el.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(el),4)*65}ms`);
          el.classList.add('motion-ready');
          observer.observe(el);
        });
      };
      prepare(document.getElementById('root'));
      const mutations = new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(prepare)));
      mutations.observe(document.getElementById('root'),{childList:true,subtree:true});
      let frame=0;
      const progress = () => {
        if(frame)return;
        frame=requestAnimationFrame(()=>{
          const range=document.documentElement.scrollHeight-innerHeight;
          document.documentElement.style.setProperty('--reading-progress',String(range>0?scrollY/range:0));
          frame=0;
        });
      };
      window.addEventListener('scroll',progress,{passive:true});
      progress();
      stop=()=>{
        observer.disconnect();mutations.disconnect();window.removeEventListener('scroll',progress);cancelAnimationFrame(frame);
        tracked.forEach(el=>{el.classList.remove('motion-ready','motion-visible');el.style.removeProperty('--reveal-delay');});
      };
    }
    start();preference.addEventListener('change',start);
    return()=>{stop();preference.removeEventListener('change',start);};
  },[]);
  return null;
}
