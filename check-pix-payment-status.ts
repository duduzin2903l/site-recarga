import { createFileRoute } from "@tanstack/react-router";
import {
  blackcatCheckStatus,
  deriveSharpifyClientId,
  laranjinhaCheckStatus,
  normalizeGateway,
  sharpifyCheckStatus,
} from "@/lib/pix-gateways";
import { normalizeUtmifyTracking, sendUtmifyOrder } from "@/lib/utmify-orders";

function getCustomerIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    ""
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const Route = createFileRoute("/api/public/check-pix-payment-status")({
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
          const { transactionId } = body;
          if (!transactionId) {
            return new Response(JSON.stringify({ error: "Missing transactionId" }), {
              status: 400,
              headers: cors,
            });
          }

          const numericAmount = Number(body.amount);

          let result;
          if (gateway === "blackcat") {
            const apiKey = process.env["BLACKCAT_SECRET_KEY"] || process.env["STRIPE_LIVE_API_KEY"];
            if (!apiKey) {
              return new Response(JSON.stringify({ error: "BlackCat não configurada" }), {
                status: 500,
                headers: cors,
              });
            }
            result = await blackcatCheckStatus(apiKey, String(transactionId));
          } else if (gateway === "laranjinha") {
            const secretKey = process.env["LARANJINHA_SECRET_KEY"];
            if (!secretKey) {
              return new Response(JSON.stringify({ error: "Laranjinha Pay não configurada" }), {
                status: 500,
                headers: cors,
              });
            }
            result = await laranjinhaCheckStatus(
              {
                secretKey,
                baseUrl: process.env["LARANJINHA_API_URL"],
                statusPath: process.env["LARANJINHA_STATUS_PATH"],
              },
              String(transactionId),
            );
          } else {
            const clientSecret = process.env["SHARPIFY_CLIENT_SECRET"];
            const clientId =
              process.env["SHARPIFY_CLIENT_ID"] || deriveSharpifyClientId(clientSecret || "");
            if (!clientId || !clientSecret) {
              return new Response(JSON.stringify({ error: "Sharpify não configurada" }), {
                status: 500,
                headers: cors,
              });
            }
            result = await sharpifyCheckStatus({ clientId, clientSecret }, String(transactionId));
          }

          let utmifySent = false;
          const utmifyToken = process.env["UTMIFY_API_TOKEN"] || "";
          if (
            utmifyToken &&
            Number.isFinite(numericAmount) &&
            numericAmount > 0 &&
            (result.status === "PAID" || result.status === "CANCELLED")
          ) {
            try {
              await sendUtmifyOrder(utmifyToken, {
                orderId: String(transactionId),
                platform: gateway === "sharpify" ? "Sharpify" : gateway,
                amount: numericAmount,
                status: result.status === "PAID" ? "paid" : "refused",
                createdAt:
                  typeof body.createdAt === "string" ? body.createdAt : new Date().toISOString(),
                approvedDate: result.status === "PAID" ? new Date() : null,
                customerName: typeof body.customerName === "string" ? body.customerName : undefined,
                customerEmail:
                  typeof body.customerEmail === "string" ? body.customerEmail : undefined,
                customerPhone: typeof body.phone === "string" ? body.phone : undefined,
                customerDocument:
                  typeof body.customerDocument === "string" ? body.customerDocument : undefined,
                customerIp: getCustomerIp(request),
                trackingParameters: normalizeUtmifyTracking(body.trackingParameters),
              });
              utmifySent = true;
            } catch (utmifyError) {
              console.error(
                `utmify ${result.status.toLowerCase()} error:`,
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
            { status: 200, headers: cors },
          );
        } catch (error) {
          const details = (error as { details?: unknown }).details;
          console.error(
            "check-pix-payment-status error:",
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
