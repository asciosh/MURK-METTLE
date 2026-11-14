# Desktop icon provenance

`lantern.svg` is original vector artwork authored in source for this project: a copper lantern and botanical flame. It uses no fonts, downloaded textures or third-party imagery. `src-tauri/icons/icon.ico` and `icon.png` are derived from it with the pinned Tauri CLI's `icon` command. Redistribute them with MURK & METTLE.

Recreate with `npm run tauri -- icon art/lantern.svg --output /path/to/temporary-icons`, then copy only `icon.ico` and `icon.png` into `src-tauri/icons/`. No generated installer/build output belongs in Git.
