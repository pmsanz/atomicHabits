import axios from "axios";

export interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OllamaOptions {
  temperature?: number;
  num_ctx?: number;
}

export class OllamaClient {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = (baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
    this.model = model ?? process.env.OLLAMA_MODEL ?? "qwen:0.6b";
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 3000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  getModel(): string {
    return this.model;
  }

  async chat(messages: OllamaMessage[], options?: OllamaOptions): Promise<string> {
    const response = await axios.post(
      `${this.baseUrl}/api/chat`,
      {
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_ctx: options?.num_ctx ?? 4096,
        },
      },
      { timeout: 60000 }
    );

    return response.data.message?.content ?? "";
  }
}

export const ollamaClient = new OllamaClient();
