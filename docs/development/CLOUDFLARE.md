# Cloudflare build and deployment

The supported Windows browser frontend and Tauri-hosted game share the same Cloudflare Worker. Root `dist/` is static frontend output; `server/cloudflare/index.mjs` is the Worker module. Preserve the existing Worker name `murk-mettle`.

```sh
npm ci
npm test
npm run typecheck
npm run build
npx wrangler deploy --dry-run --outdir /tmp/murk-worker-check
```

On Windows, choose an equivalent temporary outdir. The dry run bundles the Worker and inventories static assets; it does not deploy or prove production connectivity.

For a complete isolated local preview, use `npm run dev:cloudflare`. Register separate local test accounts and connect clients with the same 3–12 character room code. Static-only Vite preview cannot implement account APIs or Durable Objects.

After review and manual staging acceptance, an operator may run `npm run deploy` using their own Cloudflare authentication. This cleanup does not run a production deployment or merge a PR. Git-integrated production builds use `npm run build` and `npx wrangler deploy`; branch previews use the existing configured `npx wrangler preview` workflow. Root/preview bindings remain isolated; never add a production namespace/script link to previews.

Keep all three bindings and class exports:

| Binding | Class | SQLite migration |
| --- | --- | --- |
| GAME_ROOMS | GameRoom | v1 |
| PLAYER_PROFILES | PlayerProfile | v2 |
| PLAYER_ACCOUNTS | PlayerAccount | v3 |

Do not reset/rename classes, namespace bindings, migration tags, accounts or storage schemas. The legacy PlayerProfile binding is deliberately retained. Never replace this deployment with a Pages-only upload. `_headers` retains immutable fingerprinted JS/CSS caching and revalidation for models; deployed CDN behavior remains a staging check.

Desktop uses the exact HTTPS root in `desktop/deployment.json`. Its same-origin login/WS strategy requires no CORS/cookie exception. Changing that origin is a separate reviewed desktop configuration change, not a local development workaround.
