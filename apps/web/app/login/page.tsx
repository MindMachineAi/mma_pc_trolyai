import { ShieldCheck } from "lucide-react";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Email hoặc mật khẩu không đúng.",
  config: "Server chưa cấu hình ADMIN_EMAIL / ADMIN_PASSWORD. Xem .env.example.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params.error ? (ERRORS[params.error] ?? "Đăng nhập thất bại.") : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <p className="text-lg font-semibold text-white">PC Trợ Lý AI</p>
          <p className="text-xs text-slate-400">Giám sát &amp; bảo trì laptop</p>
        </div>
      </div>

      <div className="panel panel-pad">
        <h1 className="text-xl font-semibold text-white">Đăng nhập quản trị</h1>
        <p className="muted mt-1">Chỉ tài khoản admin của bạn mới xem được dữ liệu thiết bị.</p>

        <form action={loginAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-400">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="input"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-slate-400">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              className="input"
              placeholder="••••••••"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {errorMessage}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full">
            Đăng nhập
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-500">
        Secrets không bao giờ nằm trong mã nguồn — xem <span className="mono">SECURITY.md</span>.
      </p>
    </div>
  );
}
