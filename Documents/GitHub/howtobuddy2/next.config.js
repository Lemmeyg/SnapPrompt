/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  distDir: '.next',
  experimental: {
    instrumentationHook: true,
  },
  images: {
    domains: ['localhost'],
  },
  // Ensure proper handling of static assets
  webpack: (config) => {
    // Optimize string serialization
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      splitChunks: {
        ...config.optimization?.splitChunks,
        chunks: 'all',
        maxSize: 100000, // 100kb
      },
    };

    // Handle video files
    config.module.rules.push({
      test: /\.(mp4|webm)$/,
      use: {
        loader: 'file-loader',
        options: {
          publicPath: '/_next/static/videos/',
          outputPath: 'static/videos/',
        },
      },
    });

    return config;
  },
  // Add proper error handling
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  // Ensure proper module resolution
  modularizeImports: {
    '@/components': {
      transform: '@/components/{{member}}',
    },
    '@/lib': {
      transform: '@/lib/{{member}}',
    },
  },
};

module.exports = nextConfig; 