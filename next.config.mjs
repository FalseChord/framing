/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enables Docker deployment (see docs/NAS_SETUP.md) — bundles a
  // self-contained server into .next/standalone.
  output: "standalone",
};
export default nextConfig;
