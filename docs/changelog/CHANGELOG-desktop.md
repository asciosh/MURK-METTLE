# Windows desktop proof of concept

- Add a separate, locked Tauri 2 Windows project with original lantern branding, a local recovery launcher and the existing hosted Three.js game.
- Retain the exact HTTPS account origin, Secure/HttpOnly/Strict cookies, relative APIs, WSS rooms and current Cloudflare account database. Browser/Android builds and gameplay remain unchanged.
- Keep native permissions confined to one local launcher command. Restrict game navigation, downloads and external URL schemes; grant the remote game no capabilities.
- Add native fullscreen/windowed controls, connection help, cosmetic offline/recovery notices and quit/reload save reminders.
- Configure a current-user NSIS test package and optional Windows CI installer build/install/launch/uninstall checks. Add URL-policy/configuration and launcher regressions, build instructions, icon provenance and signing/SmartScreen notes.

This is a proof of concept pending native Windows acceptance tests. Source configuration does not establish that an installer exists or that WebView2 login/gameplay has been tested. See [Windows desktop documentation](../WINDOWS-DESKTOP.md) for actual validation scope and the release checklist. No FPS improvement is claimed.
