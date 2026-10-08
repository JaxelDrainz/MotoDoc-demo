import { key } from './catalog.js';

const text = html => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 80);

/**
 * Finds a photo of a specific model: the lead image of its Wikipedia article, hosted on Wikimedia Commons.
 * Those photos are freely licensed but must be credited, so the author, licence and source page come back too.
 */
export function wikimediaImages({ fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const query = async params => {
    const response = await fetchImpl(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', ...params })}`, {
      headers: { 'User-Agent': 'MotoDoc/1.0 (vehicle catalogue; info@motodoc.app)' }, signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error('image lookup failed');
    return (await response.json()).query || {};
  };
  return async (make, model) => {
    const found = await query({ generator: 'search', gsrsearch: `${make} ${model}`, gsrlimit: '4', prop: 'pageimages|info', piprop: 'thumbnail|name', pithumbsize: '960', inprop: 'url' });
    // Only an article about this make counts; a logo or an unrelated top hit is worse than no photo.
    const page = (found.pages || []).sort((a, b) => a.index - b.index)
      .find(candidate => candidate.thumbnail && !/\.svg$/i.test(candidate.pageimage) && key(candidate.title).includes(key(make)) && key(candidate.title) !== key(make));
    if (!page) return null;
    const file = (await query({ titles: `File:${page.pageimage}`, prop: 'imageinfo', iiprop: 'extmetadata|url' })).pages?.[0]?.imageinfo?.[0];
    return {
      image_url: page.thumbnail.source,
      image_source: file?.descriptionurl || page.fullurl,
      image_credit: text(file?.extmetadata?.Artist?.value) || 'Wikimedia Commons',
      image_license: text(file?.extmetadata?.LicenseShortName?.value),
    };
  };
}
