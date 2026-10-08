import type { NextConfig } from 'next';
import { BASE_PATH } from './lib/paths';

const landingOrigin = process.env.LANDING_ORIGIN || 'http://localhost:4173';

const config: NextConfig = {
  basePath: BASE_PATH,
  async redirects() {
    if (process.env.NODE_ENV !== 'development') return [];
    // The session cookie and /api live on the landing origin, which proxies /dashboard here.
    // Opening this dev server directly would have neither, so send the browser there.
    return ['localhost:4180', '127\.0\.0\.1:4180'].flatMap(host => ['/', `${BASE_PATH}/:path*`].map(source => ({
      source, has: [{ type: 'header' as const, key: 'host', value: host }],
      destination: `${landingOrigin}${BASE_PATH}`, basePath: false as const, permanent: false,
    })));
  },
};

export default config;
