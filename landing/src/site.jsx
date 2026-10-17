import { useSyncExternalStore } from 'react';
import { siteDefaults, mergeSite } from './siteCore.js';
import './site.css';

const KEY = 'motodoc-site';
const listeners = new Set();

function cached() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

let current = mergeSite(siteDefaults, cached()?.site);
let lang = document.documentElement.lang === 'fi' ? 'fi' : 'en';
const localize = () =>
  lang === 'fi'
    ? { ...current, content: mergeSite(current.content, current.translations?.fi?.content) }
    : current;
let snapshot = localize();
window.addEventListener('motodoc-lang', (event) => {
  lang = event.detail === 'fi' ? 'fi' : 'en';
  snapshot = localize();
  listeners.forEach((listener) => listener());
});
queueMicrotask(() => applyStyle(cached()?.style));

export function applyStyle(style) {
  if (!style) return;
  let tag = document.getElementById('motodoc-site-style');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'motodoc-site-style';
  }
  document.head.append(tag);
  tag.textContent = style.css;
  const root = document.documentElement;
  [...root.classList]
    .filter((name) => name.startsWith('md-no-'))
    .forEach((name) => root.classList.remove(name));
  root.classList.add(...style.classes);
  if (style.classes.includes('md-no-darkmode')) root.dataset.theme = 'light';
}

export function setSite(next, style) {
  current = mergeSite(siteDefaults, next);
  snapshot = localize();
  applyStyle(style);
  listeners.forEach((listener) => listener());
}

export function rememberSite(site, style) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ site, style }));
  } catch {}
}

export const previewing = new URLSearchParams(location.search).has('motodoc-preview');

export function loadSite() {
  if (previewing) return Promise.resolve();
  return fetch('/api/site', { cache: 'no-cache' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data) return;
      rememberSite(data.site, data.style);
      setSite(data.site, data.style);
    })
    .catch(() => {});
}

if (previewing && window.parent !== window)
  window.addEventListener('message', (event) => {
    if (event.origin === location.origin && event.data?.type === 'motodoc-preview')
      setSite(event.data.site, event.data.style);
  });

export function useSite() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}

export const siteFlag = (name) => !document.documentElement.classList.contains(name);

export function Lines({ text }) {
  return String(text)
    .split('\n')
    .flatMap((part, index) => (index ? [<br key={index} />, part] : [part]));
}

function inline(text, keyBase) {
  const parts = [];
  const pattern = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\(((?:\/|mailto:|https:\/\/)[^)\s]*)\)/g;
  let last = 0,
    match,
    index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const key = `${keyBase}-${index++}`;
    if (match[1]) parts.push(<strong key={key}>{match[1]}</strong>);
    else if (match[2]) parts.push(<code key={key}>{match[2]}</code>);
    else
      parts.push(
        <a
          key={key}
          href={match[4]}
          {...(match[4].startsWith('https://') ? { target: '_blank', rel: 'noreferrer' } : {})}
        >
          {match[3]}
        </a>,
      );
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function RichText({ text }) {
  const blocks = [];
  let list = null;
  String(text)
    .split('\n')
    .forEach((raw, index) => {
      const line = raw.trim();
      if (line.startsWith('- ')) {
        if (!list) {
          list = [];
          blocks.push(<ul key={`l${index}`}>{list}</ul>);
        }
        list.push(<li key={index}>{inline(line.slice(2), index)}</li>);
        return;
      }
      list = null;
      if (!line) return;
      if (line.startsWith('## ')) blocks.push(<h2 key={index}>{line.slice(3)}</h2>);
      else blocks.push(<p key={index}>{inline(line, index)}</p>);
    });
  return blocks;
}
