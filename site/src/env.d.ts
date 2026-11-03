declare const __SITE_VERSION__: string;

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
  /** Optional: a fork's repository URL, replacing the published one at build time. */
  readonly VITE_REPO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.svg?raw' {
  const content: string;
  export default content;
}
