import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PC Trợ Lý AI — Giám sát & bảo trì laptop",
  description:
    "Dashboard giám sát nhiều laptop: CPU, RAM, ổ cứng, pin, nhiệt độ. Cảnh báo sớm và đề xuất bảo trì bằng AI.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <body className="min-h-screen text-slate-200 antialiased">{children}</body>
    </html>
  );
}
