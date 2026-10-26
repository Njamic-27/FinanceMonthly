// electron-vite replaces these at build time in main and preload too, so code behind
// `if (import.meta.env.DEV)` is left out of production builds entirely.
interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
