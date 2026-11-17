import { redirect } from "next/navigation";
import { LogOut, MonitorSmartphone } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { NavLinks } from "@/components/nav-links";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col lg:flex-row">
      <aside className="sticky top-0 z-20 border-b border-white/5 bg-ink-950/80 px-4 py-4 backdrop-blur lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <div className="flex items-center justify-between gap-3 lg:block">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <MonitorSmartphone className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-white">PC Trợ Lý AI</p>
              <p className="text-[11px] text-slate-500">multi-device ops</p>
            </div>
          </div>
        </div>

        <div className="mt-5 lg:mt-7">
          <p className="eyebrow mb-2 hidden lg:block">Điều hướng</p>
          <NavLinks />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/5 pt-4 lg:absolute lg:bottom-6 lg:left-4 lg:right-4 lg:mt-0">
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-300">{session.email}</p>
            <p className="text-[11px] text-slate-500">admin</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="btn-ghost px-2.5 py-1.5" title="Đăng xuất">
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </aside>

      <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
