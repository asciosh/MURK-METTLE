# M03 — Co-op extraction acceptance

Use the local Wrangler server (`npm run dev:cloudflare`) with two authenticated browsers in the **same** room. Do not use production accounts or deploy.

1. **Incomplete objective:** In the mission panel, confirm the server reports **3/3 kills AND 2/2 samples** before attempting extraction. If samples are 1/2, the extraction is **locked**; pressing E must not complete it.
2. **Complete objectives:** Collect both sample pickups and earn the required team kills, then walk to the extraction marker (green ring).
3. **Server confirmation:** Press E once. A persistent **EXPEDITION N COMPLETE** results panel should appear. Until the account reward packet arrives, it must say the reward is pending, **not** claim XP has been credited.
4. **Account reward:** For each living participant, wait for **ACCOUNT REWARD VERIFIED**, **+150 XP**, total account XP, and the extractions count. Downed/eliminated players are not guaranteed personal credit.
5. **Mission loop:** The original room server intentionally resets kills and samples immediately after successful extraction; the next mission begins while the result panel remains visible. Select **Continue next expedition** to dismiss the panel; this is **not a pause button** and infected continue to move underneath.
6. **Persistence:** Press I to view **ACCOUNT XP / EXTRACTED**. Reconnect in the same browser account and re-open I; the same server totals should remain. Account totals differ between different player accounts and different local Wrangler databases.
7. **Failure:** If the reward fails, the results must show **REWARD NOT CONFIRMED**. Do not repeatedly attempt extraction for the same rewards; collect the server logs for troubleshooting.

Automated tests: `node --test tests/nextgen/room-extraction-receipt.test.mjs` and `npm test` (existing account idempotency tests).
