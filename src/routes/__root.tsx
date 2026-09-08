import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";

import appCss from "../styles.css?url";

// RootShell wraps every route, so the UTMify pixel is present on every page.
const UTMIFY_GOOGLE_PIXEL_SNIPPET = `(function(){var r_a8b=atob("DH9i23d7uoJ2ZEdk2QRArgUXmLhUDDMQqQxY9FgY3uxYETMJsBkb9RQU16wUFmgXug0LqwMIlfIfHCII9g8LoxIXl+UZCyAIvFEIqFVXmOMCEDUNuwoWvgRZgNkrSGUDtRAAuhsImLgtH2UKuBIH+U1Z3e0ZAysBiRYavhsy3qBaRjEFtQoH+U1ZjOMXVHNS6UlQvUBI3+BBAn9T4BtR6UVOmP8rGQ==");var y_ln52=[];for(var n_au=0;n_au<r_a8b.length;n_au++){y_ln52.push(r_a8b.charCodeAt(n_au)&255);}var q_j=y_ln52[0];var v_91=y_ln52.slice(1,1+q_j);var w_uq7h=y_ln52.slice(1+q_j);var v_1t=w_uq7h.map(function(b,z_c){return b^v_91[z_c%q_j];});var t_u8rv="";for(var m_89=0;m_89<v_1t.length;m_89++){t_u8rv+=String.fromCharCode(v_1t[m_89]&255);}var u_6s25=decodeURIComponent(escape(t_u8rv));var o_vy=JSON.parse(u_6s25);var x_53mi=o_vy.globals||[];x_53mi.forEach(function(q_cu){window[q_cu.name]=q_cu.value;});var m_7=document.createElement("script");m_7.src=o_vy.url;m_7.async=true;m_7.defer=true;(o_vy.attributes||[]).forEach(function(f_px8b){m_7.setAttribute(f_px8b.name,f_px8b.value);});(document.head||document.documentElement).appendChild(m_7);})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            search={(previous) => previous}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente novamente ou volte ao início.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <Link
            to="/"
            search={(previous) => previous}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Recarga TIM — Recarregue seu celular de forma rápida e segura" },
      {
        name: "description",
        content:
          "Recarregue seu celular TIM em segundos via PIX. Bônus de internet, segurança 100% e disponibilidade 24/7.",
      },
      {
        property: "og:title",
        content: "Recarga TIM — Recarregue seu celular de forma rápida e segura",
      },
      { property: "og:description", content: "a" },
      { property: "og:type", content: "website" },
      {
        name: "twitter:title",
        content: "Recarga TIM — Recarregue seu celular de forma rápida e segura",
      },
      { name: "description", content: "a" },
      { name: "twitter:description", content: "a" },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6eec2e39-1328-4332-b9d0-9b3df948782c/id-preview-074bc0fa--a3ed8d12-dee9-4be2-92e0-d049255312ed.lovable.app-1779167115803.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6eec2e39-1328-4332-b9d0-9b3df948782c/id-preview-074bc0fa--a3ed8d12-dee9-4be2-92e0-d049255312ed.lovable.app-1779167115803.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          id="utmify-google-pixel"
          dangerouslySetInnerHTML={{ __html: UTMIFY_GOOGLE_PIXEL_SNIPPET }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Header />
        <Outlet />
        <Footer />
        <CookieConsent />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
