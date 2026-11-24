// Sayfaya sadece Transfermarkt ve Google (giriş + Drive) köprülerini açar (başka Node erişimi yok)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('tactechNative', {
  version: 1,
  tmFetch: (url) => ipcRenderer.invoke('tm-fetch', url, false),
  tmFetchImage: (url) => ipcRenderer.invoke('tm-fetch', url, true),
  google: {
    platform: 'windows',
    signIn: () => ipcRenderer.invoke('g-signin'),
    status: () => ipcRenderer.invoke('g-status'),
    token: () => ipcRenderer.invoke('g-token'),
    signOut: () => ipcRenderer.invoke('g-signout'),
    fetch: (url, opts) => ipcRenderer.invoke('g-fetch', url, opts)
  }
});
