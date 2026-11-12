import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  serverExternalPackages: ['pg'],
  experimental: { cpus: process.platform === 'win32' ? 1 : undefined },
};
export default config;
