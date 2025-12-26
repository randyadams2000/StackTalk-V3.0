/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicitly pass server-side env vars to runtime (required for Amplify SSR)
  serverRuntimeConfig: {
    ELEVEN_API_KEY: process.env.ELEVEN_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    APP_REGION: process.env.APP_REGION,
    APP_ACCESS_KEY: process.env.APP_ACCESS_KEY,
    APP_SECRET_ACCESS_KEY: process.env.APP_SECRET_ACCESS_KEY,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    domains: ['substackcdn.com', 'substack-post-media.s3.amazonaws.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'substackcdn.com',
        pathname: '/image/fetch/**',
      },
      {
        protocol: 'https',
        hostname: 'substack-post-media.s3.amazonaws.com',
        pathname: '/public/images/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

export default nextConfig