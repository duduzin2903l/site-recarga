import { createFileRoute } from "@tanstack/react-router";
import {
  blackcatCreatePix,
  deriveSharpifyClientId,
  laranjinhaCreatePix,
  normalizeGateway,
  sharpifyCreatePix,
} from "@/lib/pix-gateways";

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

          const body = await request.json().catch(() => ({}) as any);
          const numericAmount = Number(body?.amount);
          if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return new Response(JSON.stringify({ error: "Valor inválido" }), {
              status: 400,
              headers: cors,
            });
          }

          const input = {
            amount: numericAmount,
            phone: String(body?.phone || ""),
            customerName: body?.customerName,
            customerEmail: body?.customerEmail,
            customerDocument: body?.customerDocument,
          };

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
            result = await sharpifyCreatePix(
              {
                clientId,
                clientSecret,
                webhookUrl: process.env["SHARPIFY_WEBHOOK_URL"],
              },
              input,
            );
          }

          return new Response(JSON.stringify({ success: true, gateway, ...result }), {
            status: 200,
            headers: cors,
          });
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
