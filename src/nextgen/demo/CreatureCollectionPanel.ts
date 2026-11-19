import type { CreatureRosterView } from '../../../shared/nextgen-creature-roster.mjs';

/** A private account journal, not a client-side save or simulated ownership screen. */
export function mountCreatureCollectionPanel(host: HTMLElement) {
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text = '') => {
    const node = document.createElement(tag);
    node.className = css; node.textContent = text; return node;
  };
  const status = make('p', 'ng-status'); status.id = 'ng-collection-status'; status.setAttribute('role', 'status');
  const list = make('div'); list.id = 'ng-creature-collection';
  const refreshButton = make('button', 'ng-button ng-secondary', 'REFRESH COLLECTION'); refreshButton.type = 'button';
  host.append(make('h2', '', 'Creature collection'),
    make('p', 'ng-note', 'Your account-owned creatures, their individual IDs, levels and evolution progress. Bond and train in co-op to grow your collection.'),
    refreshButton, status, list,
    make('p', 'ng-note', 'Solo practice remains local. Creature health, duplicate captures, market purchases and base assignments are future updates.'));
  let generation = 0;
  function clear() {
    generation++; list.replaceChildren(); status.textContent = ''; refreshButton.disabled = false;
  }
  async function refresh() {
    const request = ++generation;
    list.replaceChildren(); refreshButton.disabled = true;
    status.textContent = 'Loading your account collection…';
    try {
      const response = await fetch('/api/account/nextgen-roster', { credentials: 'same-origin', cache: 'no-store' });
      if (request !== generation) return;
      if (response.status === 401) { status.textContent = 'Sign in through Co-op, then return to the main menu.'; return; }
      if (!response.ok) throw Error('Could not load the collection. Check your connection and retry.');
      const payload = await response.json() as { roster: CreatureRosterView };
      if (request !== generation) return;
      const { roster } = payload;
      if (roster.version !== 1 || !Array.isArray(roster.instances)) throw Error('Unexpected collection response.');
      status.textContent = `${roster.instances.length} collection record${roster.instances.length === 1 ? '' : 's'} · Cloud account`;
      if (!roster.instances.length) list.append(make('p', 'ng-note', 'No creatures yet. Visit a creature habitat in a co-op expedition and bond with a creature.'));
      for (const creature of roster.instances) {
        const card = make('article', 'ng-card'); card.dataset.creatureId = creature.id;
        const name = make('h3', '', creature.name);
        const label = creature.status === 'lost' ? 'Lost' : creature.id === roster.activeId ? 'Selected in co-op' : 'In collection';
        card.append(name, make('p', 'ng-smallcaps', `${creature.familyName} · Lv ${creature.level} · ${label}`),
          make('p', '', `${creature.xp} lifetime XP`));
        if (creature.status === 'available' && creature.nextXP !== null) {
          const previousThreshold = creature.nextXP === 120 ? 0 : 120;
          const progress = make('progress'); progress.max = creature.nextXP - previousThreshold;
          progress.value = Math.max(0, creature.xp - previousThreshold); progress.setAttribute('aria-label', `Evolution progress for ${creature.name}`);
          card.append(progress, make('p', 'ng-note', `${Math.max(0, creature.nextXP - creature.xp)} XP to next evolution`));
        } else if (creature.origin === 'legacy' && creature.status === 'available') card.append(make('p', 'ng-note', 'Final evolution reached'));
        card.append(make('p', 'ng-note', `Creature ID: ${creature.id}`)); list.append(card);
      }
    } catch (error) {
      if (request === generation) status.textContent = error instanceof Error ? error.message : 'Collection unavailable.';
    } finally { if (request === generation) refreshButton.disabled = false; }
  }
  refreshButton.onclick = () => void refresh();
  return { refresh, clear };
}
