export {};

declare global {
  interface Window {
    idm?: {
      getAppVersion: () => Promise<string>;
      getAppName: () => Promise<string>;
      openBackupsFolder: () => Promise<{ opened: boolean; reason?: string }>;
    };
  }
}
