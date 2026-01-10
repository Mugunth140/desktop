export const isTauriRuntime = (): boolean => {
  // Tauri injects globals into the browser window at runtime.
  // In a plain web build (vite dev / preview), these won't exist.
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean((w as any).__TAURI_INTERNALS__ || (w as any).__TAURI__);
};
