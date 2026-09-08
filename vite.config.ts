import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// On Vercel, let Nitro use its own Vercel preset output (.vercel/output).
// Elsewhere (Lovable build), emit into dist/.
const isVercel = !!process.env["VERCEL"];

export default defineConfig({
  server: {
    port: 8080,
    host: "::",
    strictPort: true,
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart(),
    nitro(isVercel ? {} : { output: { dir: "dist" } }),
    viteReact(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
});
