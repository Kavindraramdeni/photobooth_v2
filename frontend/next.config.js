/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev, isServer }) => {
    // Fix 1: Tell webpack to treat ORT .mjs files as ES modules (not CommonJS)
    // This prevents the "import.meta cannot be used outside of module code" error
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules\/onnxruntime-web/,
      type: 'javascript/auto',
    });

    // Fix 2: Also tell Terser to parse them as modules in production client builds
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
