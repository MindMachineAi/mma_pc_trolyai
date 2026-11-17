import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AnalyzeButton } from "@/components/analyze-button";
import { Panel, ToneBadge } from "@/components/ui";
import { formatDateTime, severityTone, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export type Recommendation = {
  title?: string;
  why?: string;
  impact?: string;
  actionType?: string;
  risk?: string;
};

function parseRecommendations(value: Prisma.JsonValue): Recommendation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Prisma.JsonObject =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    )
    .map((item) => ({
      title: typeof item.title === "string" ? item.title : undefined,
      why: typeof item.why === "string" ? item.why : undefined,
      impact: typeof item.impact === "string" ? item.impact : undefined,
      actionType: typeof item.actionType === "string" ? item.actionType : undefined,
      risk: typeof item.risk === "string" ? item.risk : undefined,
    }));
}

export default async function InsightsPage() {
  const [insights, events] = await Promise.all([
    prisma.insight.findMany({
      orderBy: { ts: "desc" },
      take: 20,
      include: { device: { select: { id: true, name: true, status: true } } },
    }),
    prisma.event.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { device: { select: { id: true, name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Trung tâm cảnh báo</p>
          <h1 className="h1 mt-1">Cảnh báo &amp; đề xuất AI</h1>
          <p className="muted mt-1">
            Cảnh báo do rules engine tạo tức thời; đề xuất do AI tổng hợp (chỉ gửi số liệu tổng hợp,
            không gửi dữ liệu cá nhân).
          </p>
        </div>
        <AnalyzeButton />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="h2">Cảnh báo đang mở ({events.length})</h2>
          <div className="mt-3 space-y-2">
            {events.length === 0 ? (
              <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">
                Không có cảnh báo nào. Máy đang ở trạng thái tốt.
              </p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ToneBadge tone={severityTone(event.severity)}>{event.severity}</ToneBadge>
                    <Link
                      href={`/devices/${event.device.id}`}
                      className="text-sm font-medium text-slate-200 hover:text-cyan-300"
                    >
                      {event.device.name}
                    </Link>
                    <span className="mono text-[11px] text-slate-500">{event.code}</span>
                    <span className="text-[11px] text-slate-500">· {timeAgo(event.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{event.message}</p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="h2">Đề xuất AI gần nhất</h2>
          <div className="mt-3 space-y-3">
            {insights.length === 0 ? (
              <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">
                Chưa có đề xuất. Bấm “Phân tích bằng AI” để tạo đề xuất đầu tiên.
              </p>
            ) : (
              insights.map((insight) => {
                const recommendations = parseRecommendations(insight.recommendations);
                return (
                  <article key={insight.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <ToneBadge tone={severityTone(insight.severity)}>{insight.severity}</ToneBadge>
                      <Link
                        href={`/devices/${insight.device.id}`}
                        className="text-sm font-medium text-slate-200 hover:text-cyan-300"
                      >
                        {insight.device.name}
                      </Link>
                      {typeof insight.healthScore === "number" ? (
                        <span className="mono text-[11px] text-slate-500">AI score {insight.healthScore}</span>
                      ) : null}
                      <span className="text-[11px] text-slate-500">{formatDateTime(insight.ts)}</span>
                      <span className="mono text-[10px] uppercase tracking-wide text-slate-600">
                        {insight.model}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{insight.summary}</p>

                    {recommendations.length > 0 ? (
                      <ol className="mt-3 space-y-2">
                        {recommendations.map((item, index) => (
                          <li
                            key={`${insight.id}-${index}`}
                            className="rounded-md border border-white/5 bg-ink-950/60 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-500/15 text-[11px] font-semibold text-cyan-300">
                                {index + 1}
                              </span>
                              <span className="text-sm font-medium text-slate-200">{item.title}</span>
                              {item.actionType ? (
                                <span className="mono rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                                  {item.actionType}
                                </span>
                              ) : null}
                              {item.risk ? (
                                <ToneBadge
                                  tone={
                                    item.risk === "high" ? "bad" : item.risk === "medium" ? "warn" : "good"
                                  }
                                >
                                  risk: {item.risk}
                                </ToneBadge>
                              ) : null}
                            </div>
                            {item.why ? (
                              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{item.why}</p>
                            ) : null}
                            {item.impact ? (
                              <p className="mt-1 text-[11px] text-slate-500">Tác động: {item.impact}</p>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
