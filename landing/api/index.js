import { createApp } from '../server/app.js';

let appPromise;

export default async function handler(req, res) {
  const path = req.query?.path;
  if (typeof path !== 'string' || !/^[a-zA-Z0-9/_-]+$/.test(path)) {
    return res.status(400).json({ error:'Invalid API path.' });
  }
  try {
    appPromise ||= createApp({
      production:true,
      appOrigin:`https://${req.headers.host}`,
    }).then(result => result.app);
    const app = await appPromise;
    req.url = `/api/${path}`;
    return app(req, res);
  } catch (error) {
    appPromise = undefined;
    console.error('MotoDoc API startup failed:', error.code || error.name);
    return res.status(503).json({ error:'MotoDoc is temporarily unavailable.' });
  }
}
