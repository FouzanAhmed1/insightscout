/** @type {import('next').NextConfig} */
const nextConfig = {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const backendUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return {
      // beforeFiles rewrites run before Next.js routing, preserving trailing slashes
      beforeFiles: [
        {
          source: "/api/:path*/",
          destination: `${backendUrl}/api/:path*/`,
        },
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
