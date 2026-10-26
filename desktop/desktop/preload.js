const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('dcDesktop', {
  launchFile: () => ipcRenderer.invoke('launch-file'),
  defaultDir: () => ipcRenderer.invoke('default-dir'),
  listDir: (d) => ipcRenderer.invoke('list-dir', d),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  pickFile: () => ipcRenderer.invoke('pick-file'),
  pickDir: () => ipcRenderer.invoke('pick-dir'),
  onOpenFile: (cb) => ipcRenderer.on('open-file', (e, p) => cb(p))
})
