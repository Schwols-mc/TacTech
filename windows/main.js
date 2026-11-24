const { app, BrowserWindow, Menu, shell, ipcMain, net, safeStorage } = require('electron');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');


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


// ---- Google ile giriş + Drive (Windows) ----
// Giriş sistem tarayıcısında yapılır (Google gömülü pencerelerde girişe izin vermiyor).
// Dönüş adresi bu bilgisayardaki geçici bir yerel sunucudur (127.0.0.1). Yenileme anahtarı şifreli saklanır.
// Değerler depoda tutulmaz: GitHub Actions derlerken GOOGLE_DESKTOP_CLIENT_ID / _SECRET gizli değişkenlerinden yazar
const G_CLIENT_ID = '__G_DESKTOP_CLIENT_ID__';
const G_CLIENT_SECRET = '__G_DESKTOP_CLIENT_SECRET__';
const G_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.appdata';
const G_FILE = () => path.join(app.getPath('userData'), 'google-auth.bin');
let gTok = null; // { access_token, expires_at, refresh_token, user }
function gSave(){ try{ const raw=JSON.stringify({refresh_token:gTok.refresh_token,user:gTok.user}); const buf=safeStorage.isEncryptionAvailable()?safeStorage.encryptString(raw):Buffer.from(raw); fs.writeFileSync(G_FILE(),buf); }catch(e){} }
function gLoad(){ if(gTok) return gTok; try{ const buf=fs.readFileSync(G_FILE()); const raw=safeStorage.isEncryptionAvailable()?safeStorage.decryptString(buf):buf.toString(); const o=JSON.parse(raw); if(o.refresh_token) gTok={refresh_token:o.refresh_token,user:o.user,access_token:null,expires_at:0}; }catch(e){} return gTok; }
function b64url(b){ return b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function userFromIdToken(t){ try{ const p=JSON.parse(Buffer.from(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString()); return {email:p.email||'',name:p.name||'',picture:p.picture||''}; }catch(e){ return {email:'',name:'',picture:''}; } }
async function gTokenRequest(params){
  const res=await net.fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params).toString()});
  const j=await res.json(); if(!res.ok) throw new Error(j.error_description||j.error||('HTTP '+res.status)); return j;
}
function gSignIn(){
  if(G_CLIENT_ID.indexOf('__')===0) return Promise.resolve({ok:false,error:'Bu sürümde Google giriş bilgileri yok'});
  return new Promise((resolve)=>{
    const verifier=b64url(crypto.randomBytes(32)), challenge=b64url(crypto.createHash('sha256').update(verifier).digest()), state=b64url(crypto.randomBytes(16));
    let done=false;
    const server=http.createServer(async (req,res)=>{
      const u=new URL(req.url,'http://127.0.0.1'); if(u.pathname!=='/'){ res.writeHead(404); res.end(); return; }
      const code=u.searchParams.get('code'), st=u.searchParams.get('state'), err=u.searchParams.get('error');
      const page=(msg)=>{ res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); res.end('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#0f1a10;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#7fff5a">TacTech</h2><p>'+msg+'</p></div></body>'); };
      if(err||!code||st!==state){ page('Giriş tamamlanamadı. Uygulamaya dönüp tekrar deneyebilirsin.'); finish({ok:false,error:err||'iptal'}); return; }
      try{
        const j=await gTokenRequest({code,client_id:G_CLIENT_ID,client_secret:G_CLIENT_SECRET,redirect_uri:'http://127.0.0.1:'+server.address().port,grant_type:'authorization_code',code_verifier:verifier});
        gTok={access_token:j.access_token,expires_at:Date.now()+(j.expires_in-60)*1000,refresh_token:j.refresh_token||(gLoad()&&gLoad().refresh_token),user:userFromIdToken(j.id_token||'')};
        gSave(); page('Giriş tamam. Bu sekmeyi kapatıp TacTech\'e dönebilirsin.');
        finish({ok:true,user:gTok.user});
        const w=BrowserWindow.getAllWindows()[0]; if(w){ if(w.isMinimized()) w.restore(); w.focus(); }
      }catch(e){ page('Giriş tamamlanamadı: '+String(e.message||e)); finish({ok:false,error:String(e.message||e)}); }
    });
    const finish=(r)=>{ if(done) return; done=true; clearTimeout(to); setTimeout(()=>server.close(),500); resolve(r); };
    const to=setTimeout(()=>finish({ok:false,error:'zaman aşımı'}),5*60*1000);
    server.listen(0,'127.0.0.1',()=>{
      const port=server.address().port;
      const url='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:G_CLIENT_ID,redirect_uri:'http://127.0.0.1:'+port,response_type:'code',scope:G_SCOPES,code_challenge:challenge,code_challenge_method:'S256',state,access_type:'offline',prompt:'consent select_account'}).toString();
      shell.openExternal(url);
    });
  });
}
async function gAccessToken(){
  const t=gLoad(); if(!t||!t.refresh_token) return null;
  if(t.access_token && Date.now()<t.expires_at) return t.access_token;
  const j=await gTokenRequest({client_id:G_CLIENT_ID,client_secret:G_CLIENT_SECRET,refresh_token:t.refresh_token,grant_type:'refresh_token'});
  t.access_token=j.access_token; t.expires_at=Date.now()+(j.expires_in-60)*1000; return t.access_token;
}
ipcMain.handle('g-signin', ()=>gSignIn());
ipcMain.handle('g-status', ()=>{ const t=gLoad(); return t&&t.refresh_token?{signedIn:true,user:t.user}:{signedIn:false}; });
ipcMain.handle('g-token', async ()=>{ try{ return {ok:true,token:await gAccessToken()}; }catch(e){ return {ok:false,error:String(e.message||e)}; } });
ipcMain.handle('g-signout', async ()=>{ const t=gLoad(); try{ if(t&&t.refresh_token) await net.fetch('https://oauth2.googleapis.com/revoke?token='+encodeURIComponent(t.refresh_token),{method:'POST'}); }catch(e){} gTok=null; try{ fs.unlinkSync(G_FILE()); }catch(e){} return {ok:true}; });
// Drive istekleri (sadece googleapis.com)
ipcMain.handle('g-fetch', async (e, url, opts)=>{
  try{
    const u=new URL(String(url)); if(u.protocol!=='https:'||u.hostname!=='www.googleapis.com') return {ok:false,status:0,error:'İzin verilmeyen adres'};
    const tok=await gAccessToken(); if(!tok) return {ok:false,status:401,error:'Giriş yapılmamış'};
    const o=opts||{}; const headers=Object.assign({},o.headers||{},{Authorization:'Bearer '+tok});
    const res=await net.fetch(u.toString(),{method:o.method||'GET',headers,body:o.body});
    return {ok:res.ok,status:res.status,text:await res.text()};
  }catch(err){ return {ok:false,status:0,error:String(err&&err.message||err)}; }
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
