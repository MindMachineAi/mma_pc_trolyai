/** @type {import('next').NextConfig} */
const nextConfig = {
  // Kiểm tra type do `pnpm typecheck` (tsc --noEmit) và CI đảm nhiệm — bỏ khỏi
  // `next build` để build nhanh, ổn định (tránh bước type-check nội bộ treo trên Windows).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Không lộ header "X-Powered-By: Next.js".
  poweredByHeader: false,
};

export default nextConfig;
