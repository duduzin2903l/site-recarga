import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const UTMIFY_ORDERS_URL = "https://api.utmify.com.br/api-credentials/orders";

export const UTMIFY_TRACKING_KEYS = [
  "src",
  "sck",
  "utm_source",
  "utm_campaign",
  "utm_medium",
  "utm_content",
  "utm_term",
] as const;

export type UtmifyTrackingKey = (typeof UTMIFY_TRACKING_KEYS)[number];
export type UtmifyTrackingParameters = Record<UtmifyTrackingKey, string | null>;
export type UtmifyOrderStatus = "waiting_payment" | "paid" | "refused" | "refunded" | "chargedback";

export type UtmifyOrderInput = {
  orderId: string;
  platform: string;
  amount: number;
  status: UtmifyOrderStatus;
  createdAt: string | Date;
  approvedDate?: string | Date | null;
  refundedAt?: string | Date | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerDocument?: string;
  customerIp?: string;
  trackingParameters?: unknown;
};

export type SharpifyWebhookContext = {
  createdAt: string;
  phone: string;
  document: string;
  trackingParameters: UtmifyTrackingParameters;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const cleanDigits = (value: unknown): string => String(value || "").replace(/\D/g, "");

const cleanText = (value: unknown, maxLength = 500): string | null => {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || null;
};

export function normalizeUtmifyTracking(value: unknown): UtmifyTrackingParameters {
  const source = isRecord(value) ? value : {};
  const normalized = {} as UtmifyTrackingParameters;

  for (const key of UTMIFY_TRACKING_KEYS) {
    normalized[key] = cleanText(source[key]);
  }

  return normalized;
}

export function formatUtmifyDate(value: string | Date): string {
  const parsed = value instanceof Date ? value : new Date(value);
  const valid = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return valid.toISOString().replace("T", " ").slice(0, 19);
}

function anonymousEmail(orderId: string): string {
  const suffix = createHash("sha256").update(orderId).digest("hex").slice(0, 20);
  return `pedido.${suffix}@site-recarga.invalid`;
}

export async function sendUtmifyOrder(apiToken: string, input: UtmifyOrderInput): Promise<void> {
  if (!apiToken.trim()) throw new Error("UTMIFY_API_TOKEN não configurado");

  const amountInCents = Math.max(1, Math.round(input.amount * 100));
  const phone = cleanDigits(input.customerPhone);
  const document = cleanDigits(input.customerDocument);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(UTMIFY_ORDERS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": apiToken,
      },
      body: JSON.stringify({
        orderId: input.orderId,
        platform: input.platform,
        paymentMethod: "pix",
        status: input.status,
        createdAt: formatUtmifyDate(input.createdAt),
        approvedDate:
          input.status === "paid" && input.approvedDate
            ? formatUtmifyDate(input.approvedDate)
            : null,
        refundedAt: input.refundedAt ? formatUtmifyDate(input.refundedAt) : null,
        customer: {
          name: cleanText(input.customerName, 150) || "Cliente TIM",
          email: cleanText(input.customerEmail, 254) || anonymousEmail(input.orderId),
          phone: phone || null,
          document: document || null,
          country: "BR",
          ...(cleanText(input.customerIp, 64) ? { ip: cleanText(input.customerIp, 64) } : {}),
        },
        products: [
          {
            id: "recarga-tim",
            name: "Recarga TIM",
            planId: null,
            planName: null,
            quantity: 1,
            priceInCents: amountInCents,
          },
        ],
        trackingParameters: normalizeUtmifyTracking(input.trackingParameters),
        commission: {
          totalPriceInCents: amountInCents,
          gatewayFeeInCents: 0,
          userCommissionInCents: amountInCents,
          currency: "BRL",
        },
        isTest: false,
      }),
      signal: controller.signal,
    });

    const responseBody = await response.text();
    if (!response.ok) {
      throw Object.assign(new Error(`UTMify respondeu HTTP ${response.status}`), {
        details: responseBody.slice(0, 1_000),
      });
    }
  } finally {
    clearTimeout(timeout);
  }
}

function webhookEncryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function sealSharpifyWebhookContext(value: SharpifyWebhookContext, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", webhookEncryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function openSharpifyWebhookContext(
  encoded: string,
  secret: string,
): SharpifyWebhookContext | null {
  try {
    const packed = Buffer.from(encoded, "base64url");
    if (packed.length < 29) return null;

    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", webhookEncryptionKey(secret), iv);
    decipher.setAuthTag(tag);
    const decoded = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (!isRecord(parsed)) return null;

    return {
      createdAt: cleanText(parsed.createdAt, 100) || new Date().toISOString(),
      phone: cleanDigits(parsed.phone),
      document: cleanDigits(parsed.document),
      trackingParameters: normalizeUtmifyTracking(parsed.trackingParameters),
    };
  } catch {
    return null;
  }
}
