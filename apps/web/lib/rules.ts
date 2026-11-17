// Rules engine: phát hiện bất thường TẤT ĐỊNH (không tốn phí, chạy mỗi lần ingest).
// AI chỉ được gọi sau lớp này, khi thật sự cần giải thích/đề xuất.
import type { IngestMetrics } from "@/lib/validators";

export const THRESHOLDS = {
  diskCritical: 90,
  diskWarn: 80,
  memCritical: 90,
  memWarn: 80,
  cpuWarn: 90,
  tempWarn: 85,
  tempCritical: 95,
  batteryWearWarn: 30,
  batteryWearCritical: 50,
  diskFreeCriticalGb: 8,
} as const;

export type Severity = "INFO" | "WARN" | "CRITICAL";

export type RuleEvent = {
  code: string;
  severity: Severity;
  message: string;
  details?: Record<string, unknown>;
};

type MetricLike = Pick<
  IngestMetrics,
  "cpuPct" | "memPct" | "diskPct" | "diskFreeGb" | "tempCpu" | "batteryPct" | "batteryWear"
>;

/**
 * @param current  số liệu vừa nhận
 * @param history  các mẫu gần nhất (mới nhất trước) để phát hiện xu hướng
 */
export function evaluateRules(current: MetricLike, history: MetricLike[] = []): RuleEvent[] {
  const events: RuleEvent[] = [];
  const diskPct = current.diskPct;
  const memPct = current.memPct;
  const cpuPct = current.cpuPct;

  if (diskPct >= THRESHOLDS.diskCritical) {
    events.push({
      code: "DISK_CRITICAL",
      severity: "CRITICAL",
      message: `Ổ hệ thống đã dùng ${diskPct.toFixed(1)}% (chỉ còn ${current.diskFreeGb.toFixed(1)} GB). Nguy cơ Windows cập nhật lỗi hoặc treo.`,
      details: { diskPct, diskFreeGb: current.diskFreeGb },
    });
  } else if (diskPct >= THRESHOLDS.diskWarn) {
    events.push({
      code: "DISK_LOW",
      severity: "WARN",
      message: `Ổ hệ thống đã dùng ${diskPct.toFixed(1)}% — nên dọn dẹp để giữ trên 20% trống.`,
      details: { diskPct },
    });
  }

  if (current.diskFreeGb < THRESHOLDS.diskFreeCriticalGb) {
    events.push({
      code: "DISK_FREE_CRITICAL",
      severity: "CRITICAL",
      message: `Chỉ còn ${current.diskFreeGb.toFixed(1)} GB trống trên ổ hệ thống (< ${THRESHOLDS.diskFreeCriticalGb} GB).`,
      details: { diskFreeGb: current.diskFreeGb },
    });
  }

  if (memPct >= THRESHOLDS.memCritical) {
    events.push({
      code: "MEM_CRITICAL",
      severity: "CRITICAL",
      message: `RAM đang dùng ${memPct.toFixed(1)}% — máy có thể bị treo/giật.`,
      details: { memPct },
    });
  } else if (memPct >= THRESHOLDS.memWarn) {
    events.push({
      code: "MEM_HIGH",
      severity: "WARN",
      message: `RAM đang dùng ${memPct.toFixed(1)}%.`,
      details: { memPct },
    });
  }

  // CPU cao kéo dài: >= ngưỡng ở ít nhất 3/4 mẫu gần nhất
  const cpuSamples = [cpuPct, ...history.slice(0, 3).map((m) => m.cpuPct)];
  const cpuHighCount = cpuSamples.filter((v) => v >= THRESHOLDS.cpuWarn).length;
  if (cpuHighCount >= 3) {
    events.push({
      code: "CPU_SUSTAINED_HIGH",
      severity: "WARN",
      message: `CPU duy trì trên ${THRESHOLDS.cpuWarn}% ở ${cpuHighCount}/${cpuSamples.length} mẫu gần nhất — có thể có tiến trình chiếm tài nguyên hoặc tản nhiệt kém.`,
      details: { samples: cpuSamples.map((v) => Math.round(v * 10) / 10) },
    });
  }

  if (typeof current.tempCpu === "number" && current.tempCpu > 0) {
    if (current.tempCpu >= THRESHOLDS.tempCritical) {
      events.push({
        code: "TEMP_CRITICAL",
        severity: "CRITICAL",
        message: `Nhiệt độ CPU ${current.tempCpu.toFixed(0)}°C — quá cao, nên tắt tác vụ nặng và vệ sinh tản nhiệt.`,
        details: { tempCpu: current.tempCpu },
      });
    } else if (current.tempCpu >= THRESHOLDS.tempWarn) {
      events.push({
        code: "TEMP_HIGH",
        severity: "WARN",
        message: `Nhiệt độ CPU ${current.tempCpu.toFixed(0)}°C — cao hơn mức an toàn khuyến nghị.`,
        details: { tempCpu: current.tempCpu },
      });
    }
  }

  if (typeof current.batteryWear === "number") {
    if (current.batteryWear >= THRESHOLDS.batteryWearCritical) {
      events.push({
        code: "BATTERY_DEGRADED_CRITICAL",
        severity: "CRITICAL",
        message: `Pin đã chai ${current.batteryWear.toFixed(0)}% — thời lượng pin sụt mạnh, nên cân nhắc thay pin.`,
        details: { batteryWear: current.batteryWear },
      });
    } else if (current.batteryWear >= THRESHOLDS.batteryWearWarn) {
      events.push({
        code: "BATTERY_DEGRADED",
        severity: "WARN",
        message: `Pin đã chai ${current.batteryWear.toFixed(0)}% so với dung lượng thiết kế.`,
        details: { batteryWear: current.batteryWear },
      });
    }
  }

  // Xu hướng đầy ổ: tăng >= 1.5 điểm % trong ~30 phút gần nhất
  const oldest = history[history.length - 1];
  if (oldest && history.length >= 3) {
    const growth = diskPct - oldest.diskPct;
    if (growth >= 1.5) {
      events.push({
        code: "DISK_GROWING_FAST",
        severity: "INFO",
        message: `Dung lượng ổ tăng ${growth.toFixed(1)}% trong khoảng ${history.length} mẫu gần nhất — kiểm tra tiến trình ghi file lớn (log, cache, tải về).`,
        details: { growth, samples: history.length },
      });
    }
  }

  return events;
}
