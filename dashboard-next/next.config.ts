import type { NextConfig } from 'next';
import { BASE_PATH } from './lib/paths';

const landingOrigin = process.env.LANDING_ORIGIN || 'http://localhost:4173';

const development: NextConfig = {
  async redirects() {
    // The session cookie and /api live on the landing origin, which proxies /dashboard here.
    // Opening this dev server directly would have neither, so send the browser there.
    return ['localhost:4180', '127\\.0\\.0\\.1:4180'].flatMap(host => ['/', `${BASE_PATH}/:path*`].map(source => ({
      source, has: [{ type: 'header' as const, key: 'host', value: host }],
      destination: `${landingOrigin}${BASE_PATH}`, basePath: false as const, permanent: false,
    })));
  },
};

// The dashboard is one client-rendered page, so a production build is plain static files in out/.
// The root build copies them into the landing app's output, which serves them at /dashboard.
const production: NextConfig = { output: 'export', images: { unoptimized: true } };

const config: NextConfig = { basePath: BASE_PATH, ...(process.env.NODE_ENV === 'development' ? development : production) };

export default config;
