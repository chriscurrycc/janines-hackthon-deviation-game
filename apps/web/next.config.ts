import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Self-host friendly: emit a minimal standalone server (official Docker recommendation).
  output: 'standalone',
  // Monorepo: trace files from the workspace root so standalone bundles workspace deps.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Compile the TS-source workspace package (Turborepo "internal packages" pattern).
  transpilePackages: ['@deviation/shared'],
  // Allow LAN devices to use the dev server (HMR + dev assets) when testing multiplayer.
  allowedDevOrigins: ['192.168.100.180'],
}

export default nextConfig
