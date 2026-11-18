import { EVOLUTION_DEMO_CATALOG, availableEvolutions, levelFromXP, planEvolution } from '../../../shared/creature-evolution.mjs';

/** Read-only design sandbox. This must not update collection saves or multiplayer protocol. */
export function mountCreatureEvolutionLab(host: HTMLElement): void {
  const create = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  };
  const root = create('section', 'ng-card'); root.id = 'nextgen-evolution-lab';
  root.append(create('h2', '', 'Evolution Lab'), create('p', 'ng-note',
    'M04-B rule preview only. No creatures are granted, no XP is written, and cloud saves or co-op combat cannot be modified here.'));
  const familyLabel = create('label', '', 'Creature family');
  const family = create('select'); family.id = 'ng-evolution-family';
  for (const id of EVOLUTION_DEMO_CATALOG.familyIds) {
    const option = create('option', '', EVOLUTION_DEMO_CATALOG.families[id].name); option.value = id;
    family.append(option);
  }
  familyLabel.append(family);
  const formLabel = create('label', '', 'Current form');
  const form = create('select'); form.id = 'ng-evolution-form'; formLabel.append(form);
  const xpLabel = create('label', '', 'Test XP (level derived automatically)');
  const xp = create('input'); xp.id = 'ng-evolution-xp'; xp.type = 'number'; xp.min = '0'; xp.max = '1000000'; xp.step = '1'; xp.value = '0'; xpLabel.append(xp);
  const friendshipLabel = create('label', '', 'Test friendship');
  const friendship = create('input'); friendship.id = 'ng-evolution-friendship'; friendship.type = 'number'; friendship.min = '0'; friendship.max = '100'; friendship.value = '0'; friendshipLabel.append(friendship);
  const timeLabel = create('label', '', 'Test time');
  const time = create('select'); time.id = 'ng-evolution-time';
  for (const id of ['day', 'night']) { const option = create('option', '', id); option.value = id; time.append(option); }
  timeLabel.append(time);
  const itemLabel = create('label', '', 'Own one moon_shard (simulation)');
  const item = create('input'); item.id = 'ng-evolution-item'; item.type = 'checkbox'; item.style.width = 'auto'; item.style.marginLeft = '10px'; itemLabel.append(item);
  const tradeLabel = create('label', '', 'Trusted trade completed (simulation)');
  const trade = create('input'); trade.id = 'ng-evolution-trade'; trade.type = 'checkbox'; trade.style.width = 'auto'; trade.style.marginLeft = '10px'; tradeLabel.append(trade);
  const detail = create('p', 'ng-note'); detail.id = 'ng-evolution-level';
  const options = create('div'); options.id = 'ng-evolution-options'; options.setAttribute('aria-live', 'polite');
  const message = create('p', 'ng-status', 'This preview never affects your character or cloud collection.');
  message.id = 'ng-evolution-message';
  root.append(familyLabel, formLabel, xpLabel, friendshipLabel, timeLabel, itemLabel, tradeLabel, detail, options, message);
  host.append(root);
  function context() {
    const safe = (value: string, max: number) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Math.floor(Number(value)))) : 0;
    return { xp: safe(xp.value, 1_000_000), friendship: safe(friendship.value, 100),
      items: (item.checked ? { moon_shard: 1 } : {}) as Record<string, number>, trustedTrade: trade.checked, timeOfDay: time.value as 'day' | 'night' };
  }
  function draw(): void {
    const current = context();
    detail.textContent = `Preview level ${levelFromXP(current.xp)} • ${current.xp} XP • ${current.friendship} friendship`;
    options.replaceChildren();
    const choices = availableEvolutions(EVOLUTION_DEMO_CATALOG, family.value, form.value, current);
    if (!choices.length) options.append(create('p', 'ng-note', 'Final form: no further evolution from this form.'));
    for (const choice of choices) {
      const row = create('div', 'ng-card');
      row.append(create('strong', '', choice.targetName), create('p', 'ng-note', choice.ready ? 'Ready to preview' : choice.missing.join(' • ')));
      const button = create('button', 'ng-button ng-secondary', `PREVIEW → ${choice.targetName}`);
      button.type = 'button'; button.disabled = !choice.ready;
      button.addEventListener('click', () => {
        const decision = planEvolution(EVOLUTION_DEMO_CATALOG, family.value, form.value, choice.to, context());
        if (!decision.ok) { message.textContent = decision.reason; return; }
        const before = form.value;
        form.value = decision.to;
        message.textContent = `Preview only: ${EVOLUTION_DEMO_CATALOG.forms[before].name} → ${choice.targetName}. No item spent, no save changed.`;
        draw();
      });
      row.append(button); options.append(row);
    }
  }
  function loadForms(): void {
    form.replaceChildren();
    for (const record of EVOLUTION_DEMO_CATALOG.families[family.value].forms) {
      const option = create('option', '', record.name); option.value = record.id; form.append(option);
    }
    message.textContent = 'Evolution conditions are simulated locally, not saved.';
    draw();
  }
  family.value = 'glimmerpaw';
  family.addEventListener('change', loadForms);
  for (const element of [form, xp, friendship, time, item, trade]) element.addEventListener('change', draw);
  loadForms();
}
