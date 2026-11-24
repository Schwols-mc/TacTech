# TacTech

Futbol taktik tahtası. **Tek kaynak dosya: `index.html`** — Windows ve Android aynı dosyayı kullanır.

- `android/` — Android (Capacitor). `main`'e her yüklemede APK otomatik derlenip Releases'a konur.
- `windows/` — Windows (Electron). `npm run app` kök `index.html`'i kopyalar, ardından kurulum dosyası derlenir.

Platforma özel kod `index.html` içinde koşullu çalışır: Android'de `window.Capacitor`, Windows'ta `preload.js`'in verdiği `window.tactechNative` köprüsü.
