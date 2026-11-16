import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static (no-database) build of the letter generator — see docs/STATIC_DEPLOY.md.
// Reuses the full app's src/ (letters lib, GenerateLetterForm, styles) via the
// same "@/" alias, so there is exactly one copy of the letter logic and UI.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
