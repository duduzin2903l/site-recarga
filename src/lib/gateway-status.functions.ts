import { createServerFn } from "@tanstack/react-start";
import { deriveSharpifyClientId } from "@/lib/pix-gateways";

export interface GatewayStatus {
  active: "sharpify" | "blackcat" | "laranjinha";
  sharpifyConfigured: boolean;
  blackcatConfigured: boolean;
  laranjinhaConfigured: boolean;
}

export const getGatewayStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => ({
    password: String(data?.password ?? ""),
  }))
  .handler(async ({ data }): Promise<GatewayStatus> => {
    const expected = process.env["ADMIN_PASSWORD"];
    if (!expected || data.password !== expected) {
      throw new Error("Senha incorreta");
    }
    const raw = String(process.env["ACTIVE_GATEWAY"] || "").toLowerCase();
    const active =
      raw === "blackcat"
        ? "blackcat"
        : raw === "laranjinha" || raw === "laranjinhapay"
          ? "laranjinha"
          : "sharpify";
    return {
      active,
      sharpifyConfigured: Boolean(
        process.env["SHARPIFY_CLIENT_SECRET"] &&
        (process.env["SHARPIFY_CLIENT_ID"] ||
          deriveSharpifyClientId(process.env["SHARPIFY_CLIENT_SECRET"])),
      ),
      blackcatConfigured: Boolean(
        process.env["BLACKCAT_SECRET_KEY"] || process.env["STRIPE_LIVE_API_KEY"],
      ),
      laranjinhaConfigured: Boolean(process.env["LARANJINHA_SECRET_KEY"]),
    };
  });
