import { createFileRoute } from "@tanstack/react-router";
import { deriveSharpifyClientId, sharpifyCheckStatus } from "@/lib/pix-gateways";
import { openSharpifyWebhookContext, sendUtmifyOrder } from "@/lib/utmify-orders";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const Route = createFileRoute("/api/public/sharpify-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const clientSecret = process.env["SHARPIFY_CLIENT_SECRET"] || "";
          const clientId =
            process.env["SHARPIFY_CLIENT_ID"] || deriveSharpifyClientId(clientSecret);
          const utmifyToken = process.env["UTMIFY_API_TOKEN"] || "";
          if (!clientId || !clientSecret || !utmifyToken) {
            return Response.json({ error: "Integração não configurada" }, { status: 503 });
          }

          const body = asRecord(await request.json().catch(() => ({})));
          const event = asRecord(body.event);
          const data = asRecord(body.data);
          const paymentLink = asRecord(data.paymentLink);
          const transactionId = asText(event.contextId) || asText(paymentLink.id);
          if (!transactionId) {
            return Response.json({ error: "Evento sem ID de pagamento" }, { status: 400 });
          }

          // Do not trust the public callback body alone. Confirm the status directly with Sharpify.
          const verified = await sharpifyCheckStatus({ clientId, clientSecret }, transactionId);
          if (verified.status === "PENDING") {
            return Response.json({ error: "Pagamento ainda pendente" }, { status: 409 });
          }

          const contextToken = new URL(request.url).searchParams.get("ctx") || "";
          const context = openSharpifyWebhookContext(contextToken, clientSecret);
          const payment = asRecord(paymentLink.payment);
          const pricing = asRecord(paymentLink.pricing);
          const amount = Number(payment.amount ?? pricing.total ?? pricing.subTotal);
          if (!Number.isFinite(amount) || amount <= 0) {
            return Response.json({ error: "Evento sem valor válido" }, { status: 400 });
          }

          const name = asText(paymentLink.name);
          const phoneFromName = name.match(/\d{10,15}/)?.[0] || "";
          const createdAt =
            context?.createdAt || asText(paymentLink.createdAt) || new Date().toISOString();
          const occurredAt = asText(event.occurredAt) || new Date().toISOString();

          await sendUtmifyOrder(utmifyToken, {
            orderId: transactionId,
            platform: "Sharpify",
            amount,
            status: verified.status === "PAID" ? "paid" : "refused",
            createdAt,
            approvedDate: verified.status === "PAID" ? occurredAt : null,
            customerPhone: context?.phone || phoneFromName,
            customerDocument: context?.document,
            trackingParameters: context?.trackingParameters,
          });

          return Response.json({ success: true }, { status: 200 });
        } catch (error) {
          console.error(
            "sharpify-webhook error:",
            (error as Error).message,
            JSON.stringify((error as { details?: unknown }).details ?? null),
          );
          return Response.json({ error: "Falha ao processar webhook" }, { status: 502 });
        }
      },
    },
  },
});
