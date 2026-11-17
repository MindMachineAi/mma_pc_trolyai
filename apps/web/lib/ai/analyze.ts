// Dựng ngữ cảnh + prompt + kiểm tra output AI.
// Nguyên tắc riêng tư: CHỈ gửi số liệu tổng hợp — không gửi tên file, đường dẫn, serial, email.
import { z } from "zod";
import { getAiProvider } from "@/lib/ai/index";
import { ALLOWED_COMMANDS } from "@/lib/validators";
import type { HealthResult } from "@/lib/health";

export const aiRecommendationSchema = z.object({
  title: z.string().min(3).max(120),
  why: z.string().min(5).max(600),
  actionType: z.string().max(40).optional(),
  impact: z.string().max(200).optional(),
  risk: z.enum(["low", "medium", "high"]).default("low"),
});

export const aiInsightSchema = z.object({
  summary: z.string().min(10).max(1200),
  severity: z.enum(["INFO", "WARN", "CRITICAL"]),
  healthScore: z.number().int().min(0).max(100),
  recommendations: z.array(aiRecommendationSchema).max(6).default([]),
});

export type AiInsight = z.infer<typeof aiInsightSchema>;

export type AnalyzeInput = {
  device: {
    name: string;
    hostname?: string | null;
    osName?: string | null;
    cpuModel?: string | null;
    ramGb?: number | null;
    status: string;
  };
  metrics: Array<{
    ts: string;
    cpuPct: number;
    memPct: number;
    diskPct: number;
    diskFreeGb: number;
    tempCpu?: number | null;
    batteryPct?: number | null;
    batteryWear?: number | null;
    uptimeSec: number;
  }>;
  events: Array<{ severity: string; code: string; message: string; createdAt: string }>;
  health: HealthResult;
};

const SYSTEM_PROMPT = `Bạn là kỹ sư bảo trì laptop Windows nhiều năm kinh nghiệm, làm việc cho người dùng Việt Nam.
Nhiệm vụ: đọc số liệu telemetry và danh sách cảnh báo, rồi chẩn đoán ngắn gọn và đề xuất phương án xử lý có ưu tiên.

QUY TẮC BẮT BUỘC:
1. Trả về DUY NHẤT một object json hợp lệ, không markdown, không giải thích ngoài json.
2. Viết tiếng Việt, câu ngắn, cụ thể, tránh chung chung.
3. Tối đa 4 đề xuất, sắp xếp theo mức ưu tiên giảm dần. Mỗi đề xuất phải nêu lý do dựa trên SỐ LIỆU được cung cấp.
4. Nếu có thể, đặt "actionType" bằng đúng một trong các giá trị sau (chỉ khi phù hợp): ${ALLOWED_COMMANDS.join(", ")}. Không bịa giá trị khác.
5. "risk" chỉ nhận: low | medium | high. Việc xóa dữ liệu hoặc can thiệp hệ thống luôn là medium trở lên.
6. Không bịa số liệu không có trong dữ liệu vào. Nếu thiếu dữ liệu (ví dụ nhiệt độ), nói rõ là chưa đo được.
7. healthScore là điểm 0-100 bạn đánh giá độc lập, có thể lệch nhẹ so với điểm hệ thống.

Định dạng json mẫu:
{
  "summary": "Chuỗi 2-4 câu tóm tắt tình trạng và nguyên nhân nghi ngờ.",
  "severity": "INFO",
  "healthScore": 72,
  "recommendations": [
    {
      "title": "Dọn file tạm hệ thống",
      "why": "Ổ C: đã dùng 91% và tăng 2% trong 30 phút gần nhất.",
      "actionType": "clean_temp",
      "impact": "Có thể giải phóng 3-8 GB",
      "risk": "low"
    }
  ]
}`;

export function buildContext(input: AnalyzeInput) {
  const samples = input.metrics.slice(0, 12);
  return {
    thiet_bi: {
      ten: input.device.name,
      hostname: input.device.hostname ?? null,
      he_dieu_hanh: input.device.osName ?? null,
      cpu: input.device.cpuModel ?? null,
      ram_gb: input.device.ramGb ?? null,
      trang_thai: input.device.status,
    },
    diem_suc_khoe_he_thong: {
      tong: input.health.score,
      thanh_phan: input.health.parts.map((part) => ({
        ten: part.label,
        diem: part.score,
        ghi_chu: part.note,
      })),
    },
    mau_gan_nhat: samples, // mới nhất trước
    canh_bao_dang_mo: input.events.slice(0, 15),
  };
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```[a-zA-Z]*\s*/, "").replace(/```$/, "").trim();
}

export async function analyzeDevice(input: AnalyzeInput): Promise<{
  draft: AiInsight;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
}> {
  const provider = getAiProvider();
  const context = buildContext(input);

  const result = await provider.completeJson({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Dữ liệu telemetry (json) của laptop cần đánh giá:\n${JSON.stringify(context)}`,
      },
    ],
    maxTokens: 1200,
    temperature: 0.2,
  });

  const parsed = JSON.parse(stripCodeFence(result.text)) as unknown;
  const draft = aiInsightSchema.parse(parsed);

  // Chỉ giữ actionType thuộc allowlist — tránh AI "sáng tạo" ra lệnh nguy hiểm.
  const safeRecommendations = draft.recommendations.map((item) => {
    if (!item.actionType) return item;
    const allowed = (ALLOWED_COMMANDS as readonly string[]).includes(item.actionType);
    return allowed ? item : { ...item, actionType: undefined };
  });

  return {
    draft: { ...draft, recommendations: safeRecommendations },
    model: result.model,
    usage: result.usage,
  };
}
