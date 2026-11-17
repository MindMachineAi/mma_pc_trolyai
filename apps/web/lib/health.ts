// Điểm sức khỏe 0–100 — tính TẤT ĐỊNH (không phụ thuộc AI) để dashboard luôn có số liệu.
// Mỗi thành phần được chấm 0–100 rồi nhân trọng số.

export type HealthPart = {
  key: string;
  label: string;
  weight: number;
  score: number;
  note: string;
};

export type HealthResult = {
  score: number;
  parts: HealthPart[];
};

type HealthInput = {
  cpuPct: number;
  memPct: number;
  diskPct: number;
  diskFreeGb: number;
  tempCpu?: number | null;
  batteryWear?: number | null;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

/** Điểm càng cao càng tốt; `badAt` là giá trị mà điểm = 0. */
function scaleDown(value: number, goodAt: number, badAt: number): number {
  if (value <= goodAt) return 100;
  if (value >= badAt) return 0;
  const ratio = (value - goodAt) / (badAt - goodAt);
  return clamp(Math.round((1 - ratio) * 100));
}

export function computeHealth(input: HealthInput): HealthResult {
  const diskScore = scaleDown(input.diskPct, 60, 96);
  const memScore = scaleDown(input.memPct, 55, 95);
  const cpuScore = scaleDown(input.cpuPct, 45, 95);

  const hasTemp = typeof input.tempCpu === "number" && input.tempCpu > 0;
  const tempScore = hasTemp ? scaleDown(input.tempCpu as number, 60, 98) : 70;

  const hasBattery = typeof input.batteryWear === "number";
  const batteryScore = hasBattery ? clamp(100 - Math.round((input.batteryWear as number) * 1.4)) : 80;

  const parts: HealthPart[] = [
    {
      key: "disk",
      label: "Dung lượng ổ",
      weight: 0.28,
      score: diskScore,
      note: `Đã dùng ${input.diskPct.toFixed(1)}% (còn ${input.diskFreeGb.toFixed(1)} GB)`,
    },
    {
      key: "mem",
      label: "Bộ nhớ RAM",
      weight: 0.2,
      score: memScore,
      note: `Đang dùng ${input.memPct.toFixed(1)}%`,
    },
    {
      key: "cpu",
      label: "Tải CPU",
      weight: 0.14,
      score: cpuScore,
      note: `Hiện tại ${input.cpuPct.toFixed(1)}%`,
    },
    {
      key: "temp",
      label: "Nhiệt độ",
      weight: 0.19,
      score: tempScore,
      note: hasTemp ? `${(input.tempCpu as number).toFixed(0)}°C` : "Không đọc được cảm biến (bình thường trên một số máy)",
    },
    {
      key: "battery",
      label: "Sức khỏe pin",
      weight: 0.19,
      score: batteryScore,
      note: hasBattery ? `Chai ${(input.batteryWear as number).toFixed(0)}%` : "Không có dữ liệu pin",
    },
  ];

  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const weighted = parts.reduce((sum, part) => sum + part.score * part.weight, 0);
  const score = Math.round(weighted / totalWeight);

  return { score: clamp(score), parts };
}

export function healthLabel(score: number): string {
  if (score >= 85) return "Rất tốt";
  if (score >= 70) return "Tốt";
  if (score >= 55) return "Cần chú ý";
  if (score >= 40) return "Kém";
  return "Nguy hiểm";
}
