// Sayfaya sadece Transfermarkt köprüsünü açar (başka Node erişimi yok)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('tactechNative', {
  version: 1,
  tmFetch: (url) => ipcRenderer.invoke('tm-fetch', url, false),
  tmFetchImage: (url) => ipcRenderer.invoke('tm-fetch', url, true)
});
