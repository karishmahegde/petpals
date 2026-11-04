// What it does: TypeScript declarations for Vite environment variables
/// <reference types="vite/client" />

interface ImportMetaEnv {
  // REST base, e.g. http://localhost:5000/api/v1 locally, /api/v1 on Vercel
  // (its rewrite forwards /api/* to Render).
  readonly VITE_API_URL: string;
  // Notification stream base — the API's own URL in production, so the
  // stream skips the rewrite. Optional: blank falls back to VITE_API_URL.
  readonly VITE_STREAM_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
