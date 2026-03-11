import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — must be server-only (excluded from client bundle)
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
