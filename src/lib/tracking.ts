type TrackingValue = string | number | boolean | null | undefined;

type TrackingPayload = Record<string, TrackingValue>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  }
}

const GOOGLE_EVENT_NAMES: Record<string, string> = {
  click_recarregar: "begin_checkout",
  gerar_pix: "add_payment_info",
  pagamento_aprovado: "purchase",
  copiar_pix: "copy_pix",
  preencheu_telefone: "phone_completed",
  preencheu_cpf: "document_completed",
};

const CAMPAIGN_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
] as const;

function getCampaignData(): TrackingPayload {
  const campaign: TrackingPayload = {};
  const search = new URLSearchParams(window.location.search);

  for (const key of CAMPAIGN_KEYS) {
    const value = search.get(key);
    if (value) campaign[key] = value;
  }

  return campaign;
}

function sanitizeTrackingData(data: Record<string, unknown>): TrackingPayload {
  const payload: TrackingPayload = {};

  for (const [key, value] of Object.entries(data)) {
    // Phone numbers and documents must never be exposed to the browser data layer.
    if (["telefone", "phone", "cpf", "customerDocument"].includes(key)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null ||
      value === undefined
    ) {
      payload[key] = value;
    }
  }

  return payload;
}

export const trackEvent = async (
  eventName: string,
  data: Record<string, unknown>,
): Promise<void> => {
  if (typeof window === "undefined") return;

  const mappedEventName = GOOGLE_EVENT_NAMES[eventName] || eventName;
  const transactionId = String(data.transaction_id || "");
  const deduplicationKey = transactionId ? `tracked:${mappedEventName}:${transactionId}` : "";

  if (deduplicationKey && safeSessionGet(deduplicationKey)) return;

  const value = typeof data.valor === "number" ? data.valor : undefined;
  const payload: TrackingPayload = {
    ...sanitizeTrackingData(data),
    ...getCampaignData(),
    event_source: "sharpify",
    currency: value === undefined ? undefined : "BRL",
    value,
    page_location: window.location.href,
    page_path: window.location.pathname,
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: mappedEventName,
    original_event: eventName,
    ecommerce:
      value === undefined
        ? undefined
        : {
            transaction_id: transactionId || undefined,
            currency: "BRL",
            value,
            items: [
              {
                item_id: "recarga-tim",
                item_name: "Recarga TIM",
                price: value,
                quantity: 1,
              },
            ],
          },
    ...payload,
  });

  if (typeof window.gtag === "function" && eventName !== "page_view") {
    window.gtag("event", mappedEventName, payload);
  }

  if (deduplicationKey) safeSessionSet(deduplicationKey, "1");
};

function safeSessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Tracking must never interrupt the checkout.
  }
}
