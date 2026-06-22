import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules[\\/](@?react|react-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
          if (/node_modules[\\/](@tanstack|@trpc|superjson)[\\/]/.test(id)) return "vendor-data";
          if (id.includes("node_modules/@radix-ui/")) return "vendor-radix";
          if (id.includes("node_modules/sonner/")) return "vendor-notifications";
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
  },
});