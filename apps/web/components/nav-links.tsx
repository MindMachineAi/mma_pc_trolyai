"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, AlertTriangle, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/insights", label: "Cảnh báo & AI", icon: AlertTriangle },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link key={link.href} href={link.href} className={cn("nav-link", active && "nav-link-active")}>
            <Icon className="h-4 w-4" aria-hidden />
            {link.label}
          </Link>
        );
      })}
      <span className="nav-link cursor-default opacity-50">
        <Activity className="h-4 w-4" aria-hidden />
        Bảo trì (P4)
      </span>
    </nav>
  );
}
