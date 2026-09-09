/**
 * Camada de gateways de PIX.
 * Nenhum segredo é lido aqui — as credenciais chegam por parâmetro,
 * lidas de process.env dentro dos handlers de servidor.
 */

export type GatewayId = "sharpify" | "blackcat" | "laranjinha";

export interface PixResult {
  transactionId: string;
  pixCode: string;
  qrCodeBase64: string;
  externalLink: string;
  expiresAt: string | null;
}

export interface PixStatusResult {
  status: "PENDING" | "PAID" | "CANCELLED";
  rawStatus: string;
}

export interface CreatePixInput {
  amount: number;
  phone: string;
  customerName?: string;
  customerEmail?: string;
  customerDocument?: string;
}

export interface SharpifyCredentials {
  clientId: string;
  clientSecret: string;
  webhookUrl?: string;
}

export function normalizeGateway(value: string | undefined): GatewayId {
  const v = String(value || "").toLowerCase();
  if (v === "blackcat") return "blackcat";
  if (v === "laranjinha" || v === "laranjinhapay") return "laranjinha";
  return "sharpify";
}

/* ------------------------------- Sharpify ------------------------------- */

const SHARPIFY_BASE = "https://sharpify-pay.com";

export function deriveSharpifyClientId(clientSecret: string): string {
  const match = /^SHARPIFY_CLIENT_SECRET_([^_]+)_/.exec(clientSecret);
  return match ? `SHARPIFY_CLIENT_ID_${match[1]}` : "";
}

export async function sharpifyCreatePix(
  creds: SharpifyCredentials,
  input: CreatePixInput,
): Promise<PixResult> {
  const cleanPhone = String(input.phone || "").replace(/\D/g, "");
  const name = cleanPhone ? `Recarga TIM ${cleanPhone}` : `Recarga TIM ${Date.now()}`;

  const webhook = creds.webhookUrl
    ? {
        webhook: {
          callbackURL: creds.webhookUrl,
        },
      }
    : {};

  const res = await fetch(`${SHARPIFY_BASE}/api/v1/gateway/payment/create-paymnet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sharpify-client-id": creds.clientId,
      "x-sharpify-client-secret": creds.clientSecret,
    },
    body: JSON.stringify({
      name,
      description: `Recarga TIM - R$ ${input.amount.toFixed(2)}`,
      amount: input.amount,
      gatewayMethod: "PIX",
      ...webhook,
    }),
  });
  const data = await res.json().catch(() => ({}) as any);
  if (!res.ok) {
    throw Object.assign(new Error("Erro ao criar pagamento PIX"), { details: data });
  }

  const paymentLink = data?.data?.data || data?.data || {};
  const gatewayData = paymentLink?.payment?.gateway?.data || {};
  return {
    transactionId: paymentLink?.id || "",
    pixCode: gatewayData.code || "",
    qrCodeBase64: gatewayData.qrCode || "",
    externalLink: gatewayData.paymentLink || "",
    expiresAt: paymentLink?.payment?.gateway?.expirationDate || null,
  };
}

export async function sharpifyCheckStatus(
  creds: SharpifyCredentials,
  transactionId: string,
): Promise<PixStatusResult> {
  const url = `${SHARPIFY_BASE}/api/v1/gateway/payment/get-payment?paymentLinkId=${encodeURIComponent(transactionId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-sharpify-client-id": creds.clientId,
      "x-sharpify-client-secret": creds.clientSecret,
    },
  });
  const data = await res.json().catch(() => ({}) as any);
  if (!res.ok) {
    throw Object.assign(new Error("Erro ao verificar status"), { details: data });
  }
  const paymentLink = data?.data?.data || data?.data || data?.paymentLink || {};
  const rawStatus = String(paymentLink?.status || "").toUpperCase();
  return {
    status: rawStatus === "APPROVED" ? "PAID" : rawStatus === "CANCELLED" ? "CANCELLED" : "PENDING",
    rawStatus,
  };
}

/* ------------------------------- BlackCat ------------------------------- */

const BLACKCAT_BASE = "https://api.blackcatoficial.com";

function pick(obj: any, keys: string[]): string {
  for (const key of keys) {
    const value = key.split(".").reduce<any>((acc, k) => (acc == null ? acc : acc[k]), obj);
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

export async function blackcatCreatePix(apiKey: string, input: CreatePixInput): Promise<PixResult> {
  const cleanPhone = String(input.phone || "").replace(/\D/g, "");
  const document = String(input.customerDocument || "").replace(/\D/g, "");

  const res = await fetch(`${BLACKCAT_BASE}/api/sales/create-sale`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      amount: Math.round(input.amount * 100),
      currency: "BRL",
      paymentMethod: "pix",
      items: [
        {
          title: `Recarga TIM${cleanPhone ? ` ${cleanPhone}` : ""}`,
          quantity: 1,
          tangible: false,
        },
      ],
      customer: {
        name: input.customerName || `Cliente ${cleanPhone || "TIM"}`,
        email: input.customerEmail || `cliente${cleanPhone || Date.now()}@email.com`,
        phone: cleanPhone || "11999999999",
        document: { number: document || "12345678909", type: "cpf" },
      },
      pix: { expiresInDays: 1 },
      externalRef: `TIM-${Date.now()}`,
    }),
  });
  const data = await res.json().catch(() => ({}) as any);
  if (!res.ok) {
    throw Object.assign(new Error("Erro ao criar pagamento PIX"), { details: data });
  }

  const sale = data?.data || data?.sale || data;
  return {
    transactionId: pick(sale, ["id", "saleId", "transactionId", "hash"]),
    pixCode: pick(sale, [
      "pix.qrcode",
      "pix.qrCode",
      "pix.code",
      "pix.payload",
      "qrcode",
      "qrCode",
      "pixCode",
    ]),
    qrCodeBase64: pick(sale, ["pix.qrCodeBase64", "pix.qrcodeBase64", "qrCodeBase64"]),
    externalLink: pick(sale, ["pix.paymentLink", "paymentUrl", "checkoutUrl"]),
    expiresAt: pick(sale, ["pix.expiresAt", "pix.expirationDate", "expiresAt"]) || null,
  };
}

export async function blackcatCheckStatus(
  apiKey: string,
  transactionId: string,
): Promise<PixStatusResult> {
  const res = await fetch(`${BLACKCAT_BASE}/api/sales/${encodeURIComponent(transactionId)}`, {
    method: "GET",
    headers: { "X-API-Key": apiKey },
  });
  const data = await res.json().catch(() => ({}) as any);
  if (!res.ok) {
    throw Object.assign(new Error("Erro ao verificar status"), { details: data });
  }
  const sale = data?.data || data?.sale || data;
  const rawStatus = String(sale?.status || sale?.paymentStatus || "").toUpperCase();
  const paid = ["PAID", "APPROVED", "COMPLETED", "PAID_OUT"].includes(rawStatus);
  const cancelled = [
    "CANCELLED",
    "CANCELED",
    "REFUSED",
    "REFUNDED",
    "CHARGEBACK",
    "EXPIRED",
  ].includes(rawStatus);
  return {
    status: paid ? "PAID" : cancelled ? "CANCELLED" : "PENDING",
    rawStatus,
  };
}

/* ----------------------------- Laranjinha Pay ---------------------------- */

function laranjinhaBase(baseUrl?: string): string {
  return String(
    baseUrl || "https://mqvdjjbkjglaimbnpcer.supabase.co/functions/v1/api-proxy",
  ).replace(/\/+$/, "");
}

export async function laranjinhaCreatePix(
  creds: { secretKey: string; baseUrl?: string; createPath?: string },
  input: CreatePixInput,
): Promise<PixResult> {
  const cleanPhone = String(input.phone || "").replace(/\D/g, "");
  const document = String(input.customerDocument || "").replace(/\D/g, "");
  const path = creds.createPath || "/charges";

  const res = await fetch(`${laranjinhaBase(creds.baseUrl)}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.secretKey}`,
      "X-API-Key": creds.secretKey,
    },
    body: JSON.stringify({
      amount_cents: Math.round(input.amount * 100),
      description: `Recarga TIM${cleanPhone ? ` ${cleanPhone}` : ""}`,
      payer: {
        name: input.customerName || `Cliente ${cleanPhone || "TIM"}`,
        email: input.customerEmail || `cliente${cleanPhone || Date.now()}@email.com`,
        document: document || "12345678909",
      },
      metadata: { order_id: `TIM-${Date.now()}`, phone: cleanPhone },
    }),
  });
  const data = await res.json().catch(() => ({}) as any);
  if (!res.ok) {
    throw Object.assign(new Error("Erro ao criar pagamento PIX"), { details: data });
  }

  const charge = data?.data || data?.charge || data;
  return {
    transactionId: pick(charge, ["id", "charge_id", "transaction_id", "hash"]),
    pixCode: pick(charge, [
      "pix.qrcode",
      "pix.qr_code",
      "pix.payload",
      "qr_code",
      "qrcode",
      "pix_code",
      "brcode",
    ]),
    qrCodeBase64: pick(charge, [
      "pix.qr_code_base64",
      "qr_code_base64",
      "qrCodeBase64",
      "qr_code_image",
    ]),
    externalLink: pick(charge, ["payment_url", "checkout_url", "pix.payment_url"]),
    expiresAt: pick(charge, ["expires_at", "pix.expires_at", "expiration_date"]) || null,
  };
}

export async function laranjinhaCheckStatus(
  creds: { secretKey: string; baseUrl?: string; statusPath?: string },
  transactionId: string,
): Promise<PixStatusResult> {
  const path = (creds.statusPath || "/charges/{id}").replace(
    "{id}",
    encodeURIComponent(transactionId),
  );

  const res = await fetch(`${laranjinhaBase(creds.baseUrl)}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${creds.secretKey}`,
      "X-API-Key": creds.secretKey,
    },
  });
  const data = await res.json().catch(() => ({}) as any);
  if (!res.ok) {
    throw Object.assign(new Error("Erro ao verificar status"), { details: data });
  }
  const charge = data?.data || data?.charge || data;
  const rawStatus = String(charge?.status || charge?.payment_status || "").toUpperCase();
  const paid = ["PAID", "APPROVED", "COMPLETED", "CONFIRMED", "SUCCEEDED"].includes(rawStatus);
  const cancelled = [
    "CANCELLED",
    "CANCELED",
    "REFUSED",
    "REFUNDED",
    "CHARGEBACK",
    "EXPIRED",
    "FAILED",
  ].includes(rawStatus);
  return { status: paid ? "PAID" : cancelled ? "CANCELLED" : "PENDING", rawStatus };
}
