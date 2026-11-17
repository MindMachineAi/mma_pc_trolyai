/** @type {import('next').NextConfig} */
const nextConfig = {
  // Kiểm tra type do `pnpm typecheck` (tsc --noEmit) và CI đảm nhiệm — tắt trong
  // `next build` để build nhanh hơn (đã xác minh tsc sạch: 0 lỗi).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Không lộ header "X-Powered-By: Next.js".
  poweredByHeader: false,
};

export default nextConfig;
