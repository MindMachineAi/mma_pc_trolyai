// Schema Zod dùng chung cho mọi API — validate payload TRƯỚC khi chạm DB.
import { z } from "zod";

export const topProcessSchema = z.object({
  name: z.string().min(1).max(64),
  cpu: z.number().min(0).max(10000),
  memMb: z.number().min(0).max(4_000_000),
});

export const ingestSchema = z.object({
  agentVersion: z.string().max(32).optional(),
  system: z
    .object({
      // Agent Python gửi null khi không đọc được → phải cho phép nullable
      hostname: z.string().max(128).nullable().optional(),
      osName: z.string().max(160).nullable().optional(),
      cpuModel: z.string().max(160).nullable().optional(),
      gpuModel: z.string().max(160).nullable().optional(),
      ramGb: z.number().min(0).max(4096).nullable().optional(),
    })
    .optional(),
  metrics: z.object({
    cpuPct: z.number().min(0).max(100),
    memPct: z.number().min(0).max(100),
    diskPct: z.number().min(0).max(100),
    diskFreeGb: z.number().min(0).max(100_000),
    tempCpu: z.number().min(-30).max(150).nullable().optional(),
    batteryPct: z.number().min(0).max(100).nullable().optional(),
    batteryWear: z.number().min(0).max(100).nullable().optional(),
    netUpKbps: z.number().min(0).nullable().optional(),
    netDownKbps: z.number().min(0).nullable().optional(),
    uptimeSec: z.number().int().min(0),
    procCount: z.number().int().min(0).max(200_000).nullable().optional(),
    topProcesses: z.array(topProcessSchema).max(10).optional(),
  }),
});

export type IngestPayload = z.infer<typeof ingestSchema>;
export type IngestMetrics = IngestPayload["metrics"];

export const createDeviceSchema = z.object({
  name: z.string().min(2, "Tên thiết bị tối thiểu 2 ký tự").max(60),
  ownerLabel: z.string().max(60).optional(),
});

export const ALLOWED_COMMANDS = [
  "clean_temp",
  "flush_dns",
  "battery_report",
  "trim",
  "sfc_scan",
] as const;

export type AllowedCommand = (typeof ALLOWED_COMMANDS)[number];

export const createCommandSchema = z.object({
  deviceId: z.string().min(5).max(64),
  type: z.enum(ALLOWED_COMMANDS),
  params: z.record(z.unknown()).optional(),
});

export const commandResultSchema = z.object({
  commandId: z.string().min(5).max(64),
  status: z.enum(["DONE", "FAILED"]),
  result: z.record(z.unknown()).optional(),
  error: z.string().max(2000).optional(),
});

export const analyzeQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5).optional(),
});
