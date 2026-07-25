/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // The app serves plain <img> tags only — disabling the unused
  // /_next/image optimizer removes the endpoint (and the sharp/libvips
  // attack surface flagged by npm audit) from the running server.
  images: { unoptimized: true },
};

export default nextConfig;
