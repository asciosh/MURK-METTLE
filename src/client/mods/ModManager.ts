import type { SpeciesId } from '../../../shared/expansion.mjs';
import { CREATURES } from '../../../shared/expansion.mjs';
import { ModRegistry } from './ModRegistry';
import type { ModPreview } from './ModPreview';
export class ModManager {
  private readonly dialog = document.querySelector<HTMLDialogElement>('#mods-dialog')!;
  private readonly status = document.querySelector<HTMLElement>('#mods-status')!;
  private readonly list = document.querySelector<HTMLElement>('#mods-list')!;
  private readonly previewHost = document.querySelector<HTMLElement>('#mod-preview')!;
  private readonly input = document.querySelector<HTMLInputElement>('#mods-file')!;
  private preview: ModPreview | null = null;
  private previewGeneration = 0;
  private busy = false;
  private disposed = false;
  private activeSpecies: SpeciesId = 'lanternkin';
  private hudKey = '';
  private hudGeneration = 0;
  private hudURL: string | null = null;
  private readonly unsubscribe: () => void;
  constructor(private readonly registry: ModRegistry) {
    document.querySelector('#mods-open')?.addEventListener('click', this.open);
    document.querySelector('#mods-close')?.addEventListener('click', this.close);
    document.querySelector('#mods-import')?.addEventListener('click', this.pick);
    document.querySelector('#mods-demo')?.addEventListener('click', this.demo);
    document.querySelector('#mods-restore')?.addEventListener('click', this.restore);
    document.querySelector('#mod-preview-pulse')?.addEventListener('click', this.pulse);
    this.input.addEventListener('change', this.changed);
    this.dialog.addEventListener('close', this.onClose);
    this.unsubscribe = registry.subscribe(() => {
      this.draw();
      this.setSpecies(this.activeSpecies);
    });
  }
  setSpecies(species: SpeciesId): void {
    this.activeSpecies = species;
    const id = this.registry.selection(species),
      key = id || '';
    if (key === this.hudKey) return;
    this.hudKey = key;
    const generation = ++this.hudGeneration;
    if (this.hudURL) URL.revokeObjectURL(this.hudURL);
    this.hudURL = null;
    const image = document.querySelector<HTMLImageElement>('#creature-mod-icon');
    if (!image) return;
    image.hidden = true;
    image.removeAttribute('src');
    if (id)
      void this.registry
        .icon(id)
        .then((url) => {
          if (this.disposed || generation !== this.hudGeneration) {
            if (url) URL.revokeObjectURL(url);
            return;
          }
          this.hudURL = url;
          if (url) {
            image.src = url;
            image.hidden = false;
          }
        })
        .catch(() => {})
        .finally(() => this.registry.trim());
  }
  private readonly open = (): void => {
    if (this.dialog.open) return;
    const menu = document.querySelector<HTMLElement>('#field-menu');
    if (menu) menu.hidden = true;
    document.querySelector('#field-menu-toggle')?.setAttribute('aria-expanded', 'false');
    document.querySelector<HTMLButtonElement>('#inventory-close')?.click();
    document.querySelector<HTMLButtonElement>('#journal-close')?.click();
    document.dispatchEvent(new Event('field-overlay-open'));
    if (document.pointerLockElement) document.exitPointerLock();
    this.dialog.showModal();
    this.draw();
    void this.registry.ready.then(() => {
      if (!this.disposed) {
        this.draw();
        if (this.registry.errors.size) this.status.textContent = [...this.registry.errors.values()].join(' ');
      }
    });
  };
  private readonly close = (): void => this.dialog.close();
  private readonly onClose = (): void => {
    this.previewGeneration++;
    this.preview?.dispose();
    this.preview = null;
    this.previewHost.replaceChildren();
    document.querySelector('#mod-preview-caption')!.textContent =
      'Select Preview to inspect a cosmetic before enabling it.';
    this.registry.trim();
    document.querySelector<HTMLElement>('#field-menu-toggle')?.focus();
  };
  private readonly pick = (): void => this.input.click();
  private readonly changed = (): void => {
    const file = this.input.files?.[0];
    this.input.value = '';
    if (file)
      void this.run(async () => {
        const id = await this.registry.import(file);
        this.status.textContent = 'Imported and validated. Preview it, then enable when ready.';
        await this.showPreview(id);
      });
  };
  private readonly demo = (): void => {
    void this.run(async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}mod-examples/copperbloom.mmcosmetic`);
      if (!response.ok) throw Error('Original demo package unavailable');
      const id = await this.registry.import(await response.blob());
      this.status.textContent = 'Original CC0 demo imported. Previewed locally; not enabled yet.';
      await this.showPreview(id);
    });
  };
  private readonly restore = (): void => {
    void this.run(async () => {
      await this.registry.restoreOriginals();
      this.status.textContent = 'Original creature appearances restored on this device.';
    });
  };
  private readonly pulse = (): void => this.preview?.pulse();
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy || this.disposed) return;
    this.busy = true;
    this.status.textContent = 'Validating / loading local cosmetics…';
    this.draw();
    try {
      await action();
    } catch (error) {
      this.status.textContent = (error instanceof Error ? error.message : 'Cosmetic operation failed').slice(
        0,
        300,
      );
    } finally {
      this.busy = false;
      if (!this.disposed) this.draw();
    }
  }
  private draw(): void {
    if (!this.dialog.open || this.disposed) return;
    this.list.replaceChildren();
    for (const control of ['#mods-import', '#mods-demo', '#mods-restore']) {
      const button = document.querySelector<HTMLButtonElement>(control);
      if (button) button.disabled = this.busy;
    }
    if (!this.registry.records.size) {
      const p = document.createElement('p');
      p.textContent = 'No local cosmetics installed. Official creatures are active.';
      this.list.append(p);
    }
    for (const row of this.registry.records.values()) {
      const article = document.createElement('article'),
        heading = document.createElement('h3'),
        summary = document.createElement('p'),
        buttons = document.createElement('div'),
        license = document.createElement('details'),
        title = document.createElement('summary'),
        rights = document.createElement('p'),
        licenseText = document.createElement('pre');
      heading.textContent = row.manifest.name;
      summary.textContent = `${CREATURES[row.manifest.species].name} · v${row.manifest.version} · ${row.enabled ? 'ENABLED LOCALLY' : 'DISABLED'}`;
      title.textContent = `Author & license · ${row.manifest.license}`;
      rights.textContent = `${row.manifest.author} · Declared ${row.manifest.rights} rights. ${row.manifest.attribution}`;
      license.append(title, rights, licenseText);
      license.addEventListener('toggle', () => {
        if (license.open && !licenseText.textContent) {
          licenseText.textContent = 'Loading license text…';
          void this.registry
            .licenseText(row.id)
            .then((content) => {
              licenseText.textContent = content;
            })
            .catch(() => {
              licenseText.textContent =
                'License text unavailable. Remove and re-import the original package.';
            });
        }
      });
      for (const [label, action] of [
        [
          'Preview',
          async () => {
            await this.showPreview(row.id);
            this.status.textContent = 'Preview only. Gameplay and networking are unchanged.';
          },
        ],
        [
          row.enabled ? 'Disable' : 'Enable',
          async () => {
            if (row.enabled) await this.registry.disable(row.id);
            else await this.registry.enable(row.id);
            this.status.textContent = row.enabled
              ? 'Original appearance restored.'
              : 'Cosmetic enabled on this device only.';
          },
        ],
        [
          'Remove',
          async () => {
            this.previewGeneration++;
            this.preview?.dispose();
            this.preview = null;
            this.previewHost.replaceChildren();
            document.querySelector('#mod-preview-caption')!.textContent =
              'Select Preview to inspect a cosmetic before enabling it.';
            await this.registry.remove(row.id);
            this.status.textContent = 'Local package removed. Original appearance is available.';
          },
        ],
      ] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = this.busy;
        button.addEventListener('click', () => {
          void this.run(action);
        });
        buttons.append(button);
      }
      const error = this.registry.errors.get(row.id);
      if (error) {
        const note = document.createElement('p');
        note.textContent = error;
        article.append(note);
      }
      article.append(heading, summary, buttons, license);
      this.list.append(article);
    }
  }
  private async showPreview(id: string): Promise<void> {
    const generation = ++this.previewGeneration;
    const visual = await this.registry.preview(id);
    if (this.disposed || !this.dialog.open || generation !== this.previewGeneration) {
      visual.dispose();
      return;
    }
    this.preview?.dispose();
    this.preview = null;
    try {
      const { ModPreview } = await import('./ModPreview');
      if (this.disposed || !this.dialog.open || generation !== this.previewGeneration) {
        visual.dispose();
        return;
      }
      this.preview = new ModPreview(this.previewHost, visual);
      this.previewHost.scrollIntoView({ block: 'nearest' });
      const mapped = Object.values(visual.mod.manifest.animations || {}),
        available = visual.mod.manifest.animations?.idle;
      document.querySelector('#mod-preview-caption')!.textContent =
        `${visual.mod.manifest.name} · ${visual.mod.stats.triangles.toLocaleString()} triangles · same cosmetic across all three official growth stages. Missing mapped clips use idle or static pose; official bob/pulse remains.${!available || !mapped.length ? ' No idle clip mapped.' : ''}`;
    } catch (error) {
      visual.dispose();
      throw error;
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.previewGeneration++;
    this.hudGeneration++;
    this.preview?.dispose();
    this.preview = null;
    this.unsubscribe();
    if (this.hudURL) URL.revokeObjectURL(this.hudURL);
    this.dialog.close();
    this.dialog.removeEventListener('close', this.onClose);
    this.input.removeEventListener('change', this.changed);
    for (const [selector, callback] of [
      ['#mods-open', this.open],
      ['#mods-close', this.close],
      ['#mods-import', this.pick],
      ['#mods-demo', this.demo],
      ['#mods-restore', this.restore],
      ['#mod-preview-pulse', this.pulse],
    ] as const)
      document.querySelector(selector)?.removeEventListener('click', callback);
  }
}
