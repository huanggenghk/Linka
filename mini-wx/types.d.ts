declare function App(options: Record<string, unknown>): void;
declare function Page(options: Record<string, unknown>): void;

declare const wx: {
  request(options: {
    url: string;
    method?: string;
    data?: unknown;
    header?: Record<string, string>;
    success?: (res: { statusCode: number; data: unknown }) => void;
    fail?: (err: { errMsg?: string }) => void;
  }): void;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  setClipboardData(options: {
    data: string;
    success?: () => void;
    fail?: () => void;
  }): void;
  showToast(options: {
    title: string;
    icon?: "success" | "error" | "loading" | "none";
    duration?: number;
  }): void;
  showModal(options: {
    title: string;
    content: string;
    confirmText?: string;
    success?: (res: { confirm: boolean; cancel: boolean }) => void;
  }): void;
};
