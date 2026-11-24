const { app, BrowserWindow, Menu, shell, ipcMain, net } = require('electron');
const path = require('path');


// ---- Transfermarkt köprüsü ----
// Uygulama sayfası tarayıcı kısıtlaması (CORS) yüzünden Transfermarkt'a doğrudan erişemez.
// İstekler burada, kullanıcının kendi bağlantısıyla, sınırlı hızda ve sadece izinli adreslere atılır.
const TM_HOSTS = ['www.transfermarkt.com.tr', 'img.a.transfermarkt.technology', 'tmssl.akamaized.net'];
let tmQueue = Promise.resolve();
let tmLast = 0;
const TM_GAP_MS = 350; // istekler arası en az bekleme (siteyi yormamak için)
function chromeUA() { return app.userAgentFallback.replace(/\s*Electron\/\S+/i, '').replace(/\s*tactech\/\S+/i, ''); }
async function tmFetchOnce(url, binary) {
  let u;
  try { u = new URL(url); } catch (e) { return { ok: false, error: 'Geçersiz adres' }; }
  if (u.protocol !== 'https:' || !TM_HOSTS.includes(u.hostname)) return { ok: false, error: 'İzin verilmeyen adres' };
  const wait = TM_GAP_MS - (Date.now() - tmLast);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  tmLast = Date.now();
  const res = await net.fetch(url, { headers: {
    'User-Agent': chromeUA(),
    'Accept': binary ? 'image/avif,image/webp,image/png,image/*,*/*;q=0.8' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
  } });
  if (!res.ok) return { ok: false, status: res.status, error: 'HTTP ' + res.status };
  if (binary) {
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') || 'image/png';
    return { ok: true, dataUrl: 'data:' + type + ';base64,' + buf.toString('base64') };
  }
  return { ok: true, status: res.status, text: await res.text() };
}
ipcMain.handle('tm-fetch', (e, url, binary) => {
  const job = tmQueue.then(() => tmFetchOnce(String(url), !!binary)).catch(err => ({ ok: false, error: String(err && err.message || err) }));
  tmQueue = job.then(() => {}, () => {});
  return job;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 850, minWidth: 900, minHeight: 560,
    backgroundColor: '#000000',
    title: 'TacTech',
    icon: path.join(__dirname, 'app', 'icons', 'icon-512.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // F11 tam ekran, F12 yok
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // Harici linkler tarayıcıda açılsın; PNG önizleme penceresi uygulama içinde açılsın
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#111' } };
  });
}

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
