export {};

declare global {
  interface Window {
    wtt: {
      invoke: <T = unknown>(channel: string, payload?: unknown) => Promise<T>;
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
    };
  }
}
