import type { CreatureRosterView } from '../../../shared/nextgen-creature-roster.mjs';

/** Private account collection. Selection and evolution are server-validated intents. */
export function mountCreatureCollectionPanel(host: HTMLElement) {
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text = '') => {
    const node = document.createElement(tag);
    node.className = css; node.textContent = text; return node;
  };
  const status = make('p', 'ng-status'); status.id = 'ng-collection-status'; status.setAttribute('role', 'status');
  const list = make('div'); list.id = 'ng-creature-collection';
  const refreshButton = make('button', 'ng-button ng-secondary', 'REFRESH COLLECTION'); refreshButton.type = 'button';
  host.append(make('h2', '', 'Creature collection'),
    make('p', 'ng-note', 'Capture wild Lanternkin in the field, train individual specimens and evolve eligible forms here. Selection and evolution take effect when you next enter a co-op room.'),
    refreshButton, status, list,
    make('p', 'ng-note', 'Solo practice remains local. Creature health, capture devices, market purchases and base assignments are future updates.'));
  let generation = 0;
  function clear() {
    generation++; list.replaceChildren(); status.textContent = ''; refreshButton.disabled = false;
  }
  async function action(id: string, kind: 'select' | 'evolve', targetId?: string) {
    const request = ++generation;
    refreshButton.disabled = true;
    list.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      const response = await fetch('/api/account/nextgen-roster-action', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id,action:kind,...(targetId ? {targetId} : {})}) });
      if (request !== generation) return;
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw Error(error.error || 'Creature action failed.'); }
      await refresh();
    } catch (error) {
      if (request !== generation) return;
      await refresh(); status.textContent = error instanceof Error ? error.message : 'Creature action failed.';
    }
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
      if (!roster.instances.length) list.append(make('p', 'ng-note', 'No creatures yet. Visit a creature habitat or the wild capture marker in a co-op expedition.'));
      for (const creature of roster.instances) {
        const card = make('article', 'ng-card'); card.dataset.creatureId = creature.id;
        const name = make('h3', '', creature.name);
        const label = creature.status === 'lost' ? 'Lost' : creature.id === roster.activeId ? 'Selected in co-op' : 'In collection';
        card.append(name, make('p', 'ng-smallcaps', `${creature.familyName} · Lv ${creature.level} · ${label}`),
          make('p', '', `${creature.xp} lifetime XP · ${creature.origin === 'native' ? 'Captured specimen' : 'Original bonded creature'}`));
        if (creature.status === 'available' && creature.nextXP !== null) {
          const previousThreshold = creature.nextXP === 120 ? 0 : 120;
          const progress = make('progress'); progress.max = creature.nextXP - previousThreshold;
          progress.value = Math.max(0, creature.xp - previousThreshold); progress.setAttribute('aria-label', `Evolution progress for ${creature.name}`);
          card.append(progress, make('p', 'ng-note', creature.xp >= creature.nextXP ? 'Evolution ready' : `${creature.nextXP - creature.xp} XP to next evolution`));
          if (creature.nextFormId) {
            const targetId = creature.nextFormId;
            const evolve = make('button','ng-button ng-secondary','EVOLVE'); evolve.type = 'button'; evolve.disabled = creature.xp < creature.nextXP;
            evolve.onclick = () => void action(creature.id,'evolve',targetId); card.append(evolve);
          }
        } else if (creature.status === 'available') card.append(make('p', 'ng-note', 'Final evolution reached'));
        if (creature.status === 'available' && creature.id !== roster.activeId) {
          const select = make('button','ng-button ng-secondary','SELECT COMPANION'); select.type = 'button';
          select.onclick = () => void action(creature.id,'select'); card.append(select);
        }
        card.append(make('p', 'ng-note', `Creature ID: ${creature.id}`)); list.append(card);
      }
    } catch (error) {
      if (request === generation) status.textContent = error instanceof Error ? error.message : 'Collection unavailable.';
    } finally { if (request === generation) refreshButton.disabled = false; }
  }
  refreshButton.onclick = () => void refresh();
  return { refresh, clear };
}
