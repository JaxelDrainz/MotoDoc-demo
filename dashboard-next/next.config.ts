import type { NextConfig } from 'next';
import { BASE_PATH } from './lib/paths';

const landingOrigin = process.env.LANDING_ORIGIN || 'http://localhost:4173';

const development: NextConfig = {
  async redirects() {
    return ['localhost:4180', '127\\.0\\.0\\.1:4180'].flatMap((host) =>
      ['/', `${BASE_PATH}/:path*`].map((source) => ({
        source,
        has: [{ type: 'header' as const, key: 'host', value: host }],
        destination: `${landingOrigin}${BASE_PATH}`,
        basePath: false as const,
        permanent: false,
      })),
    );
  },
};

const production: NextConfig = { output: 'export', images: { unoptimized: true } };

const config: NextConfig = {
  turbopack: { root: __dirname },
  basePath: BASE_PATH,
  ...(process.env.NODE_ENV === 'development' ? development : production),
};

export default config;
