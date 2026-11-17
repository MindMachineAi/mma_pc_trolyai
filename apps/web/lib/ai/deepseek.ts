// DeepSeek API — chuẩn OpenAI (https://api.deepseek.com).
// Tài liệu JSON Output: cần response_format = { type: "json_object" }, prompt phải có chữ "json",
// đặt max_tokens hợp lý, và PHẢI xử lý trường hợp content rỗng (model trả toàn khoảng trắng) → retry.
import type { AiJsonRequest, AiJsonResult, AiProvider } from "@/lib/ai/provider";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-flash";
const MAX_ATTEMPTS = 2;

type ChatCompletionResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class DeepSeekProvider implements AiProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
    private readonly model: string = DEFAULT_MODEL,
  ) {
    this.name = `deepseek:${model}`;
  }

  async completeJson(request: AiJsonRequest): Promise<AiJsonResult> {
    const url = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const body = {
      model: this.model,
      messages: request.messages,
      response_format: { type: "json_object" },
      max_tokens: request.maxTokens ?? 1400,
      temperature: request.temperature ?? 0.2,
      stream: false,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          // Vercel Hobby giới hạn 10s → giữ timeout thấp hơn để có thời gian trả lỗi đẹp.
          signal: AbortSignal.timeout(9000),
        });

        if (!response.ok) {
          const raw = await response.text();
          throw new Error(`DeepSeek HTTP ${response.status}: ${raw.slice(0, 300)}`);
        }

        const data = (await response.json()) as ChatCompletionResponse;
        const text = (data.choices?.[0]?.message?.content ?? "").trim();

        if (text.length > 0) {
          return {
            text,
            model: data.model ?? this.model,
            usage: {
              promptTokens: data.usage?.prompt_tokens ?? 0,
              completionTokens: data.usage?.completion_tokens ?? 0,
            },
          };
        }

        lastError = new Error("DeepSeek trả content rỗng (có thể bị cắt bởi max_tokens)");
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Lỗi xác thực/quota thì retry vô nghĩa
        if (/HTTP (401|402|403|429)/.test(lastError.message)) break;
      }
    }

    throw lastError ?? new Error("Gọi DeepSeek thất bại");
  }
}
