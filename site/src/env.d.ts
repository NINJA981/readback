declare const __SITE_VERSION__: string;

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
  /** Public repository URL, set at build time once the repository exists. */
  readonly VITE_REPO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.svg?raw' {
  const content: string;
  export default content;
}
