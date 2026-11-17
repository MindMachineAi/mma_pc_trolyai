// Chọn provider theo env — mặc định DeepSeek. Chỉ chạy ở server.
import { DeepSeekProvider } from "@/lib/ai/deepseek";
import type { AiProvider } from "@/lib/ai/provider";

export function getAiProvider(): AiProvider {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY chưa được cấu hình — không thể phân tích bằng AI.");
  }
  return new DeepSeekProvider(
    apiKey,
    process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    process.env.DEEPSEEK_MODEL ?? "deepseek-flash",
  );
}
