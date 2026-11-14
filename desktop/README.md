# MURK & METTLE · Windows host

Separate Tauri 2 / WebView2 edition of the existing hosted browser game. Intended for Windows 10/11 x64. Internet required; same Cloudflare accounts and multiplayer protocol. No remote native capabilities.

See [Windows architecture, security, build and validation instructions](../docs/WINDOWS-DESKTOP.md). On a prepared Windows machine, run `npm ci` then `npm run dev` here. `npm run build -- -- --locked` builds the configured NSIS test installer. An installer is available only after a real Windows build succeeds; configuration alone is not a built artifact.
