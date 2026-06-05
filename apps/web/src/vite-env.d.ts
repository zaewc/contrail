/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CARD_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
