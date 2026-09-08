import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getGatewayStatus,
  type GatewayStatus,
} from "@/lib/gateway-status.functions";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Painel de Gateways | Brasil da TIM" },
      {
        name: "description",
        content:
          "Painel interno para consultar qual gateway de pagamento PIX está ativo (Sharpify ou BlackCat).",
      },
      { property: "og:title", content: "Painel de Gateways | Brasil da TIM" },
      {
        property: "og:description",
        content: "Consulte e configure o gateway PIX ativo do site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PainelPage,
});

function PainelPage() {
  const fetchStatus = useServerFn(getGatewayStatus);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await fetchStatus({ data: { password } });
      setStatus(result);
    } catch {
      setError("Senha incorreta");
    } finally {
      setLoading(false);
    }
  };

  if (!status) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Painel de Gateways</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                placeholder="Senha do painel"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={100}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verificando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const gateways = [
    {
      id: "sharpify" as const,
      name: "Sharpify",
      configured: status.sharpifyConfigured,
      vars: "SHARPIFY_CLIENT_ID, SHARPIFY_CLIENT_SECRET",
    },
    {
      id: "blackcat" as const,
      name: "BlackCat",
      configured: status.blackcatConfigured,
      vars: "BLACKCAT_SECRET_KEY",
    },
    {
      id: "laranjinha" as const,
      name: "Laranjinha Pay",
      configured: status.laranjinhaConfigured,
      vars: "LARANJINHA_SECRET_KEY, LARANJINHA_API_URL",
    },
  ];


  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Painel de Gateways</h1>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gateways.map((g) => {
            const isActive = status.active === g.id;
            return (
              <Card key={g.id} className={isActive ? "border-primary" : ""}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-lg">{g.name}</CardTitle>
                  <Badge variant={isActive ? "default" : "secondary"}>
                    {isActive ? "Ativo" : "Desativado"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Credenciais:{" "}
                    <span className={g.configured ? "text-primary" : "text-destructive"}>
                      {g.configured ? "configuradas" : "faltando"}
                    </span>
                  </p>
                  <p className="break-words font-mono text-xs">{g.vars}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como trocar o gateway ativo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Na Vercel, em Settings → Environment Variables, defina a variável{" "}
              <span className="font-mono text-foreground">ACTIVE_GATEWAY</span> com o valor{" "}
              <span className="font-mono text-foreground">sharpify</span> ou{" "}
              <span className="font-mono text-foreground">blackcat</span> ou{" "}<span className="font-mono text-foreground">laranjinha</span> e faça o redeploy.
            </p>
            <p>
              O PIX do site sempre usa o gateway indicado nessa variável. Se ela não existir,
              o padrão é Sharpify.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
