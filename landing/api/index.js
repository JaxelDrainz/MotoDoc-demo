import { createApp } from '../server/app.js';

let appPromise;

export default async function handler(req, res) {
  const path = req.query?.path;
  if (typeof path !== 'string' || !/^[a-zA-Z0-9/_.-]+$/.test(path) || path.includes('..')) {
    return res.status(400).json({ error:'Invalid API path.' });
  }
  try {
    appPromise ||= createApp({
      production:true,
      appOrigin:`https://${req.headers.host}`,
    }).then(result => result.app);
    const app = await appPromise;
    // Keep the caller's own query string (search terms and so on); only the rewrite's path parameter is dropped.
    const query = new URLSearchParams(Object.entries(req.query).filter(([name]) => name !== 'path').flatMap(([name, value]) => [].concat(value).map(item => [name, String(item)]))).toString();
    req.url = `/api/${path}${query ? `?${query}` : ''}`;
    return app(req, res);
  } catch (error) {
    appPromise = undefined;
    console.error('MotoDoc API startup failed:', error.code || error.name);
    return res.status(503).json({ error:'MotoDoc is temporarily unavailable.' });
  }
}
