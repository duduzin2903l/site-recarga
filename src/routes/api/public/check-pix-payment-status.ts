import { createFileRoute } from "@tanstack/react-router";
import {
  blackcatCheckStatus,
  laranjinhaCheckStatus,
  normalizeGateway,
  sharpifyCheckStatus,
} from "@/lib/pix-gateways";

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
          const { transactionId } = await request.json().catch(() => ({}) as any);
          if (!transactionId) {
            return new Response(JSON.stringify({ error: "Missing transactionId" }), {
              status: 400,
              headers: cors,
            });
          }

          let result;
          if (gateway === "blackcat") {
            const apiKey =
              process.env["BLACKCAT_SECRET_KEY"] || process.env["STRIPE_LIVE_API_KEY"];
            if (!apiKey) {
              return new Response(
                JSON.stringify({ error: "BlackCat não configurada" }),
                { status: 500, headers: cors },
              );
            }
            result = await blackcatCheckStatus(apiKey, String(transactionId));
          } else if (gateway === "laranjinha") {
            const secretKey = process.env["LARANJINHA_SECRET_KEY"];
            if (!secretKey) {
              return new Response(
                JSON.stringify({ error: "Laranjinha Pay não configurada" }),
                { status: 500, headers: cors },
              );
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
            const clientId = process.env["SHARPIFY_CLIENT_ID"];
            const clientSecret = process.env["SHARPIFY_CLIENT_SECRET"];
            if (!clientId || !clientSecret) {
              return new Response(
                JSON.stringify({ error: "Sharpify não configurada" }),
                { status: 500, headers: cors },
              );
            }
            result = await sharpifyCheckStatus({ clientId, clientSecret }, String(transactionId));
          }

          return new Response(
            JSON.stringify({ success: true, gateway, ...result }),
            { status: 200, headers: cors },
          );
        } catch (error) {
          const details = (error as { details?: unknown }).details;
          console.error("check-pix-payment-status error:", (error as Error).message, JSON.stringify(details ?? null));
          return new Response(
            JSON.stringify({ error: (error as Error).message, details }),
            { status: 500, headers: cors },
          );
        }
      },
    },
  },
});
