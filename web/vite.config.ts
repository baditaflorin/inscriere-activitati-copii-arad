import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const version = readFileSync(resolve(__dirname, "../VERSION.md"), "utf8").trim();

export default defineConfig({
  root: __dirname,
  base: process.env.VITE_BASE_PATH ?? "/inscriere-activitati-copii-arad/",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  publicDir: "public",
  build: {
    outDir: "../docs",
    emptyOutDir: false,
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
