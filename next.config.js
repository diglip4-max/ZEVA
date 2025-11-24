/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    enableFeedbackButton: false, // 🔥 This disables the floating "N" button
  },
  images: {
    domains: [
      "localhost",             // for local development
      "zeva360.com",     // for production
      "images.unsplash.com",   // for Unsplash images
    ],
  },
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true, // ✅ Build won’t fail because of ESLint warnings/errors
  },
};

module.exports = nextConfig;
