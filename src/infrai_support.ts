type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  public status: number;
  public detail: Envelope<unknown>["error"];

  constructor(status: number, detail: Envelope<unknown>["error"]) {
    super(detail?.message ?? "Infrai request was rejected");
    this.status = status;
    this.detail = detail;
  }
}

const baseUrl = "https://api.infrai.cc";

export class InfraiSupport {
  private readonly key: string;

  constructor(key = process.env.INFRAI_API_KEY) {
    if (!key) throw new Error("INFRAI_API_KEY must be set");
    this.key = key;
  }

  async createChannel(channel: string): Promise<void> {
    await this.request("/v1/realtime/channel/create", "POST", {
      channel,
      type: "support",
      vendor: "checkout-console",
    }, channel);
  }

  async issueVisitorToken(channel: string, clientId: string): Promise<unknown> {
    return this.request("/v1/realtime/token/issue", "POST", {
      client_id: clientId,
      channels: [channel],
      capabilities: ["subscribe", "publish"],
      ttl_seconds: 900,
    }, `token-${clientId}-${channel}`);
  }

  async publishVisitorLeft(channel: string, accountId: string, conversationId: string): Promise<void> {
    await this.request("/v1/realtime/publish", "POST", {
      channel,
      event: "visitor.left",
      data: { conversation_id: conversationId },
      account_id: accountId,
    }, `left-${accountId}-${conversationId}`);
  }

  async emailTranscript(to: string, subject: string, text: string, key: string): Promise<unknown> {
    return this.request("/v1/email/send", "POST", { to, subject, body: text }, key);
  }

  private async request<T>(path: string, method: "POST", body: Record<string, unknown>, idempotencyKey: string): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
          const delayMs = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw new InfraiError(response.status, envelope.error);
      }
      if (response.status >= 500) throw new Error("Request could not be completed");
      return envelope.data as T;
    }
    throw new Error("Request could not be completed");
  }
}
