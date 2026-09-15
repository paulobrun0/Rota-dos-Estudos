import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Custom service worker (src/sw.js) instead of the auto-generated one
      // — needed for the push/notificationclick handlers, which
      // generateSW's config alone can't add. injectManifest still gives us
      // workbox precaching (self.__WB_MANIFEST is filled in at build time);
      // we just also get to add our own event listeners around it.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
      },
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "Rota dos Estudos",
        short_name: "Rota dos Estudos",
        description: "Plano de estudos para concursos: edital, metas diárias e progresso.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#12141C",
        theme_color: "#12141C",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // "Só instalável": src/sw.js only precaches static build assets (via
      // precacheAndRoute) and doesn't register any navigation fallback, so
      // there's nothing that could intercept /api/* while offline — the app
      // still requires a real connection to do anything.
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
