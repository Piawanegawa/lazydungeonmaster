import { Notice, requestUrl } from "obsidian";

export class OpenRouterClient {
  constructor({ baseUrl, apiKey }) {
    this.baseUrl = baseUrl?.replace(/\/$/, "") || "";
    this.apiKey = apiKey || "";
  }

  async createChatCompletion({ model, messages }) {
    if (!this.apiKey) {
      const message = "OpenRouter API key is not set.";
      console.error(`[OpenRouter] ${message}`);
      new Notice(message);
      throw new Error(message);
    }

    const url = `${this.baseUrl}/chat/completions`;
    try {
      const response = await requestUrl({
        url,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
        }),
      });

      if (response.status < 200 || response.status >= 300) {
        const snippet = (response.text || "").slice(0, 200) || "No response body";
        const message = `OpenRouter error ${response.status}: ${snippet}`;
        console.error(`[OpenRouter] ${message}`);
        new Notice(message);
        throw new Error(message);
      }

      return response.json ?? JSON.parse(response.text || "{}");
    } catch (error) {
      const message = `OpenRouter request failed: ${error?.message || error}`;
      console.error(`[OpenRouter] ${message}`, error);
      new Notice(message);
      throw error;
    }
  }
}
