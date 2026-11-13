# Murk & Mettle v0.13.1 — stability patch

- Implemented transactional revision compare-and-swap for account cloud saves in `PlayerAccount`. Stale PUT requests return HTTP 409 without modifying data. Existing v0.13 saves without a revision are treated as revision 0 and migrated only upon accepted PUT.
- Account sync checks the expected revision on page load and pauses if cloud progress changed. Manual upload requires explicit confirmation when replacing cloud data or uploading unowned/different-account browser progress. Restore confirms before replacing local data. Existing localStorage save keys remain unchanged.
- Disabled automatic legacy recovery-key backup uploads (manual save/key/restore preserved) to avoid competing sync histories.
- Keyboard shortcuts are ignored in editable fields; focusing a field clears stale movement and attack inputs.
- Moved co-op, account, and legacy backup actions into the collapsible FIELD MENU. Preserved all original gameplay element IDs. Made HUD stacks scrollable by pointer and improved small-screen text.
- Added a Node test for successful upload, stale-revision rejection, legacy save migration and invalid PUT.

Not addressed: authenticated multiplayer, server-authoritative damage/rewards, account PIN hardening, large-controller refactor, actual network reconnect testing. This remains a **private beta**, not public-ready. No live deployment was performed.
