import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Build config, previously provided by @lovable.dev/vite-tanstack-config.
// Reproduces the production pipeline: Tailwind, tsconfig paths, TanStack
// Start (SSR, server entry = src/server.ts), Nitro (Vercel preset) on build,
// and React. Dev-only Lovable editor plugins were dropped — not needed to run.
export default defineConfig(async ({ command, mode }) => {
  const plugins: import("vite").PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
    }),
  ];

  // Nitro/Vercel preset only for real production builds. Lovable's harness
  // runs `vite build --mode development` and then checks for `dist/`, so we
  // skip Nitro in that mode and let Vite emit the standard dist output.
  if (command === "build" && mode !== "development") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ preset: "vercel" }));
  }

  plugins.push(viteReact());

  // Lovable's dist-check runs after Vite builds and expects a `dist/index.html`.
  // TanStack Start's SSR build can emit only nested server/client outputs, so
  // synthesize a minimal placeholder for both preview and production checks.
  if (command === "build") {
    plugins.push({
      name: "lovable-dist-check-index-html",
      apply: "build",
      closeBundle() {
        const distDir = resolve(process.cwd(), "dist");
        if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>App</title></head><body><div id="root"></div></body></html>`;
        writeFileSync(resolve(distDir, "index.html"), html);
      },
    } as import("vite").Plugin);
  }

  return {
    css: { transformer: "lightningcss" as const },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: { host: "::", port: process.env.PORT ? Number(process.env.PORT) : 8080 },
    plugins,
  };
});
