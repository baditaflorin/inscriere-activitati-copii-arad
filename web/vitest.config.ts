import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const version = readFileSync(resolve(__dirname, "../VERSION.md"), "utf8").trim();

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
