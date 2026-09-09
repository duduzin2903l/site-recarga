import { createFileRoute } from "@tanstack/react-router";
import {
  blackcatCreatePix,
  deriveSharpifyClientId,
  laranjinhaCreatePix,
  normalizeGateway,
  sharpifyCreatePix,
} from "@/lib/pix-gateways";
import {
  normalizeUtmifyTracking,
  sealSharpifyWebhookContext,
  sendUtmifyOrder,
} from "@/lib/utmify-orders";

function getCustomerIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    ""
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function getSharpifyWebhookUrl(request: Request, configuredUrl: string | undefined): string {
  const baseUrl =
    configuredUrl?.trim() || new URL("/api/public/sharpify-webhook", request.url).href;
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) return "";
  return url.href;
}

export const Route = createFileRoute("/api/public/create-pix-payment")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      POST: async ({ request }) => {
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        };
        try {
          const gateway = normalizeGateway(process.env["ACTIVE_GATEWAY"]);

          const parsedBody: unknown = await request.json().catch(() => ({}));
          const body = isRecord(parsedBody) ? parsedBody : {};
          const numericAmount = Number(body.amount);
          if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return new Response(JSON.stringify({ error: "Valor inválido" }), {
              status: 400,
              headers: cors,
            });
          }

          const input = {
            amount: numericAmount,
            phone: String(body.phone || ""),
            customerName: typeof body.customerName === "string" ? body.customerName : undefined,
            customerEmail: typeof body.customerEmail === "string" ? body.customerEmail : undefined,
            customerDocument:
              typeof body.customerDocument === "string" ? body.customerDocument : undefined,
          };
          const trackingParameters = normalizeUtmifyTracking(body.trackingParameters);
          const utmifyCreatedAt = new Date().toISOString();

          let result;
          if (gateway === "blackcat") {
            const apiKey = process.env["BLACKCAT_SECRET_KEY"] || process.env["STRIPE_LIVE_API_KEY"];
            if (!apiKey) {
              return new Response(
                JSON.stringify({
                  error: "BlackCat não configurada. Defina BLACKCAT_SECRET_KEY.",
                }),
                { status: 500, headers: cors },
              );
            }
            result = await blackcatCreatePix(apiKey, input);
          } else if (gateway === "laranjinha") {
            const secretKey = process.env["LARANJINHA_SECRET_KEY"];
            if (!secretKey) {
              return new Response(
                JSON.stringify({
                  error: "Laranjinha Pay não configurada. Defina LARANJINHA_SECRET_KEY.",
                }),
                { status: 500, headers: cors },
              );
            }
            result = await laranjinhaCreatePix(
              {
                secretKey,
                baseUrl: process.env["LARANJINHA_API_URL"],
                createPath: process.env["LARANJINHA_CREATE_PATH"],
              },
              input,
            );
          } else {
            const clientSecret = process.env["SHARPIFY_CLIENT_SECRET"];
            const clientId =
              process.env["SHARPIFY_CLIENT_ID"] || deriveSharpifyClientId(clientSecret || "");
            if (!clientId || !clientSecret) {
              return new Response(
                JSON.stringify({
                  error:
                    "Sharpify não configurada. Defina SHARPIFY_CLIENT_ID e SHARPIFY_CLIENT_SECRET.",
                }),
                { status: 500, headers: cors },
              );
            }
            const webhookUrl = getSharpifyWebhookUrl(request, process.env["SHARPIFY_WEBHOOK_URL"]);
            const callbackUrl = webhookUrl ? new URL(webhookUrl) : null;
            if (callbackUrl) {
              callbackUrl.searchParams.set(
                "ctx",
                sealSharpifyWebhookContext(
                  {
                    createdAt: utmifyCreatedAt,
                    phone: input.phone,
                    document: String(input.customerDocument || ""),
                    trackingParameters,
                  },
                  clientSecret,
                ),
              );
            }

            result = await sharpifyCreatePix(
              {
                clientId,
                clientSecret,
                webhookUrl: callbackUrl?.href,
              },
              input,
            );
          }

          // UTMify requires the original createdAt to stay unchanged on status updates.
          result.createdAt = utmifyCreatedAt;

          if (!result.transactionId) {
            throw new Error("O gateway criou o PIX sem retornar o ID da transação");
          }

          let utmifySent = false;
          const utmifyToken = process.env["UTMIFY_API_TOKEN"] || "";
          if (utmifyToken) {
            try {
              await sendUtmifyOrder(utmifyToken, {
                orderId: result.transactionId,
                platform: gateway === "sharpify" ? "Sharpify" : gateway,
                amount: numericAmount,
                status: "waiting_payment",
                createdAt: result.createdAt,
                customerName: input.customerName,
                customerEmail: input.customerEmail,
                customerPhone: input.phone,
                customerDocument: input.customerDocument,
                customerIp: getCustomerIp(request),
                trackingParameters,
              });
              utmifySent = true;
            } catch (utmifyError) {
              console.error(
                "utmify waiting_payment error:",
                (utmifyError as Error).message,
                JSON.stringify((utmifyError as { details?: unknown }).details ?? null),
              );
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              gateway,
              ...result,
              utmify: { configured: Boolean(utmifyToken), sent: utmifySent },
            }),
            {
              status: 200,
              headers: cors,
            },
          );
        } catch (error) {
          const details = (error as { details?: unknown }).details;
          console.error(
            "create-pix-payment error:",
            (error as Error).message,
            JSON.stringify(details ?? null),
          );
          return new Response(JSON.stringify({ error: (error as Error).message, details }), {
            status: 500,
            headers: cors,
          });
        }
      },
    },
  },
});
