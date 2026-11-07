import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@idm/shared-types": path.resolve(__dirname, "../../packages/shared-types/src"),
      "@idm/shared-validation": path.resolve(__dirname, "../../packages/shared-validation/src"),
      "@idm/shared-utils": path.resolve(__dirname, "../../packages/shared-utils/src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  // Electron loads the built app via file://, so relative asset paths are required.
  base: "./",
});
