import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI backend so the frontend can call /api/* directly.
    proxy: {
      // Backend runs on 8001 (8000 is taken by the legalgpt project on this machine).
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
      // Locally-stored upload images are served by the backend (🔌 storage seam).
      "/uploads": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
});
