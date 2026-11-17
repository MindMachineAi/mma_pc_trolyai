// Lớp trừu tượng nhà cung cấp AI.
// Muốn đổi DeepSeek → OpenAI/Gemini/Ollama: viết 1 file mới implement `AiProvider`,
// sau đó sửa `getAiProvider()`. UI và business logic KHÔNG cần thay đổi.
export type AiRole = "system" | "user";

export type AiMessage = { role: AiRole; content: string };

export type AiJsonRequest = {
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
};

export type AiUsage = {
  promptTokens: number;
  completionTokens: number;
};

export type AiJsonResult = {
  text: string;
  model: string;
  usage: AiUsage;
};

export interface AiProvider {
  /** Tên hiển thị, lưu vào cột Insight.model */
  readonly name: string;
  /** Gọi model ở chế độ JSON output và trả về chuỗi JSON thô. */
  completeJson(request: AiJsonRequest): Promise<AiJsonResult>;
}
