const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const fs = require('fs')
const path = require('path')

const cfgFile = () => path.join(app.getPath('userData'), 'config.json')
const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) } catch (e) { return {} } }
const saveCfg = (c) => { try { fs.writeFileSync(cfgFile(), JSON.stringify(c)) } catch (e) { /* ignore */ } }
const fileArg = (argv) => argv.slice(1).find((a) => /\.dcbackup$/i.test(a) && fs.existsSync(a))

let win = null
let launchFile = fileArg(process.argv) || null

if (!app.requestSingleInstanceLock()) { app.quit() } else {
  app.on('second-instance', (e, argv) => {
    const f = fileArg(argv)
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); if (f) win.webContents.send('open-file', f) }
  })
}

function create() {
  Menu.setApplicationMenu(null)
  win = new BrowserWindow({ width: 1280, height: 800, backgroundColor: '#b7bcc2', title: 'DC Accounts', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } })
  win.maximize()
  win.loadFile(path.join(__dirname, 'app', 'index.html'))
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

ipcMain.handle('launch-file', () => { const f = launchFile; launchFile = null; return f })
ipcMain.handle('default-dir', () => {
  const c = readCfg()
  if (c.dir && fs.existsSync(c.dir)) return c.dir
  return app.getPath('downloads')
})
ipcMain.handle('list-dir', (e, dir) => {
  let d = path.resolve(String(dir || '').replace(/^"|"$/g, ''))
  if (!fs.existsSync(d)) throw new Error('Path not found: ' + d)
  if (fs.statSync(d).isFile()) d = path.dirname(d)
  const files = []
  for (const n of fs.readdirSync(d)) {
    if (!/\.dcbackup$/i.test(n)) continue
    try { const st = fs.statSync(path.join(d, n)); files.push({ name: n, path: path.join(d, n), size: st.size, mtime: st.mtime.toISOString() }) } catch (err) { /* skip */ }
  }
  files.sort((a, b) => b.mtime.localeCompare(a.mtime))
  const parent = path.dirname(d)
  saveCfg({ ...readCfg(), dir: d })
  return { dir: d, files, parent: parent !== d ? parent : '' }
})
ipcMain.handle('read-file', (e, p) => fs.readFileSync(p, 'utf8'))
ipcMain.handle('pick-file', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Open backup file', filters: [{ name: 'DC Backup', extensions: ['dcbackup', 'json'] }], properties: ['openFile'] })
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('pick-dir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Select folder with backup files', properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

app.whenReady().then(create)
app.on('window-all-closed', () => app.quit())
