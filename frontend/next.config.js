/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev, isServer }) => {
    // Vercel production builds can choke on ESM-only vendor artifacts (e.g. `import.meta`
    // in `.mjs` files copied to `static/media`) when Terser parses them as non-modules.
    // Force module-aware parsing for Terser in client production builds.
    if (!dev && !isServer && Array.isArray(config.optimization?.minimizer)) {
      config.optimization.minimizer.forEach((plugin) => {
        if (plugin?.constructor?.name !== 'TerserPlugin') return;
        plugin.options ??= {};
        plugin.options.terserOptions ??= {};
        plugin.options.terserOptions.module = true;
        plugin.options.terserOptions.parse = {
          ...(plugin.options.terserOptions.parse || {}),
          module: true,
        };
      });
    }

    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.cloudflare.com' },
      { protocol: 'https', hostname: '*' },
    ],
  },
  // PWA headers for offline support
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
