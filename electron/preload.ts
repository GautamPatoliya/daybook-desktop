import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('wtt', {
  invoke: (channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
