/// <reference types="vite/client" />

// 构建时由 vite.config.ts 注入（来自 package.json 的 version）
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_KEY?: string;
}
