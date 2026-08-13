/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    // Uploaded product photos are served from the database through this
    // same origin, so no remotePatterns are needed.
    formats: ["image/webp"],
  },
};

export default nextConfig;
