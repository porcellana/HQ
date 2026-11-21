/**
 * CONTROLADOR DE LA APLICACIÓN
 * ----------------------------
 * Une motor, partida, interfaz y guardado: menú principal, inicio/carga de
 * partida, menú de pausa, autoguardado y ciclo de vida de Android.
 */
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getClass, getZoneDef } from '@/data/registry';
import { GameLoop } from '@/engine/loop';
import { Input } from '@/engine/input';
import { randomSeed } from '@/engine/rng';
import { Game } from '@/game/game';
import { SaveManager } from '@/game/save/saveManager';
import { defaultStores } from '@/game/save/storage';
import { loadSettings, saveSettings, type Settings } from '@/game/settings';
import { createNewGame, type GameState } from '@/game/state';
import { Renderer } from '@/gfx/renderer';
import { heroColors } from '@/gfx/sprites';
import { creationScreen } from '@/ui/creation';
import { characterSheet } from '@/ui/sheet';
import { confirmDialog, showDialog } from '@/ui/dialogs';
import { buzz } from '@/ui/dom';
import { Hud } from '@/ui/hud';
import { mainMenu, settingsScreen } from '@/ui/menus';

/** Cada cuántos turnos se autoguarda además de al cambiar de zona. */
const AUTOSAVE_EVERY_TURNS = 40;

export class App {
  private settings: Settings = loadSettings();
  private readonly saves = new SaveManager(defaultStores(), __APP_VERSION__);
  private readonly renderer: Renderer;
  private readonly loop: GameLoop;
  private game: Game | null = null;
  private hud: Hud | null = null;
  private screen: HTMLElement | null = null;
  private pauseClose: (() => void) | null = null;
  private saving: Promise<void> = Promise.resolve();
  private lastSavedTurn = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly ui: HTMLElement,
  ) {
    this.renderer = new Renderer(canvas);
    this.loop = new GameLoop((dt) => this.tick(dt));
    new Input(canvas, {
      onTap: (x, y) => this.onTap(x, y),
      onHeldDir: (d) => this.setHeldDir(d),
      onKey: (code) => {
        if (code === 'Space' || code === 'Period') this.game?.waitTurn();
        if (code === 'Escape') this.togglePause();
        if (code === 'KeyC') this.showSheet();
      },
    });
    window.addEventListener('resize', () => this.layout());
    this.applySettings();
    this.setupLifecycle();
  }

  async start(): Promise<void> {
    await this.showMainMenu();
  }

  // ------------------------------------------------------------- Pantallas
  private setScreen(el: HTMLElement | null): void {
    this.screen?.remove();
    this.screen = el;
    if (el) this.ui.append(el);
  }

  private async showMainMenu(): Promise<void> {
    const summary = await this.saves.summary();
    this.setScreen(
      mainMenu(summary, {
        onContinue: () => void this.continueGame(),
        onNewGame: () => void this.newGame(summary !== null),
        onSettings: () => this.showSettings(() => void this.showMainMenu()),
      }),
    );
  }

  private showSettings(back: () => void): void {
    this.setScreen(
      settingsScreen(
        this.settings,
        (s) => {
          this.settings = s;
          saveSettings(s);
          this.applySettings();
        },
        back,
        this.game
          ? null
          : async () => {
              if (await confirmDialog(this.ui, 'Borrar partida', 'Se borrará tu partida guardada y su copia de seguridad. No se puede deshacer.', 'Borrar', true)) {
                await this.saves.deleteAll();
                this.toast('Partida borrada.');
              }
            },
      ),
    );
  }

  private applySettings(): void {
    document.documentElement.classList.toggle('ui-grande', this.settings.uiScale === 'grande');
    this.hud?.applySettings(this.settings);
    if (this.game) this.game.stepDuration = this.settings.moveSpeed === 'rapida' ? 0.08 : 0.14;
    // El tamaño de interfaz cambia el layout: recalculamos el canvas.
    requestAnimationFrame(() => this.layout());
  }

  /** Recalcula el canvas y el hueco libre entre el HUD superior y los botones. */
  private layout(): void {
    this.renderer.resize();
    const insets = this.hud?.insets();
    if (insets) {
      const dpr = this.renderer.pixelRatio;
      this.renderer.setInsets(insets.top * dpr, insets.bottom * dpr);
    }
  }

  private toast(text: string): void {
    if (this.hud) this.hud.pushMessage(text);
    else showDialog(this.ui, 'Aviso', text, [{ label: 'Vale' }]);
  }

  // --------------------------------------------------------------- Partida
  private async newGame(hasSave: boolean): Promise<void> {
    if (hasSave) {
      const ok = await confirmDialog(this.ui, 'Nueva partida', 'Ya tienes una partida guardada. Si empiezas otra, se sobrescribirá al guardar.', 'Empezar', true);
      if (!ok) return;
    }
    this.setScreen(
      creationScreen(
        (r) => {
          const state = createNewGame({ ...r, seed: randomSeed() });
          this.startGame(state);
          void this.autosave('nueva partida');
          this.hud?.pushMessage(`¡Que empiece la aventura, ${r.name}! Toca el mapa para moverte.`, 'good');
        },
        () => void this.showMainMenu(),
      ),
    );
  }

  private async continueGame(): Promise<void> {
    const res = await this.saves.load();
    if (!res.ok) {
      showDialog(this.ui, 'No se pudo cargar', res.message, [{ label: 'Vale' }]);
      return;
    }
    this.startGame(res.state);
    if (res.usedBackup) this.hud?.pushMessage('Se cargó la copia de seguridad de tu partida.', 'warn');
    if (res.migratedFrom !== null) this.hud?.pushMessage(`Partida actualizada desde la versión de guardado ${res.migratedFrom}.`, 'good');
  }

  private startGame(state: GameState): void {
    this.setScreen(null);
    this.hud?.root.remove();
    const game = new Game(state);
    this.game = game;
    this.lastSavedTurn = state.turn;

    const hud = new Hud({
      onWait: () => game.waitTurn(),
      onSheet: () => this.showSheet(),
      onMenu: () => this.togglePause(),
      onInventory: () => hud.pushMessage('La mochila llegará en el Hito 4.'),
      onJoystick: (d) => this.setHeldDir(d),
    });
    this.hud = hud;
    this.ui.prepend(hud.root);
    this.applyLook();
    this.applySettings();

    game.events.on('message', (m) => hud.pushMessage(m.text, m.kind));
    game.events.on('zoneChanged', ({ zone, firstVisit }) => {
      hud.showBanner(zone.def.name, firstVisit ? zone.def.description : undefined);
      buzz(this.settings.vibration, 20);
      void this.autosave('cambio de zona');
    });
    game.events.on('turn', ({ turn }) => {
      if (turn - this.lastSavedTurn >= AUTOSAVE_EVERY_TURNS) void this.autosave('periódico');
    });

    const def = getZoneDef(state.player.pos.zone);
    hud.showBanner(def?.name ?? '', undefined);
    this.layout();
    this.loop.start();
  }

  /** Aplica aspecto de clase y retrato al mapa y al HUD. */
  private applyLook(): void {
    const p = this.game?.state.player;
    if (!p || !this.hud) return;
    const cls = getClass(p.classId);
    const colors = heroColors(cls.look, p.portrait);
    this.renderer.heroColors = colors;
    this.hud.setPortrait(colors);
    this.hud.setResource(cls.resource.short, cls.resource.color);
  }

  private showSheet(): void {
    const game = this.game;
    if (!game || this.pauseClose || this.screen) return;
    game.heldDir = null;
    this.setScreen(
      characterSheet(
        game.state.player,
        () => this.setScreen(null),
        () => void this.autosave('ficha'),
      ),
    );
  }

  private tick(dt: number): void {
    const game = this.game;
    if (!game) return;
    if (!this.pauseClose && !this.screen) game.update(dt);
    this.renderer.render(game, dt, { grid: this.settings.grid });
    this.hud?.update(game, dt);
  }

  private onTap(sx: number, sy: number): void {
    if (!this.game || this.pauseClose || this.screen) return;
    const t = this.renderer.screenToTile(sx, sy);
    this.game.tapTile(t.x, t.y);
  }

  private setHeldDir(d: { dx: number; dy: number } | null): void {
    if (!this.game) return;
    if (d) this.game.cancelPath();
    this.game.heldDir = d;
  }

  /** Guarda en segundo plano; las llamadas se encadenan para no solaparse. */
  private autosave(reason: string): Promise<void> {
    const game = this.game;
    if (!game) return this.saving;
    this.lastSavedTurn = game.state.turn;
    this.saving = this.saving
      .then(() => this.saves.save(game.state))
      .catch((e: unknown) => {
        console.error(`[guardado] falló (${reason})`, e);
        this.hud?.pushMessage('¡No se pudo guardar la partida!', 'warn');
      });
    return this.saving;
  }

  // ----------------------------------------------------------------- Pausa
  private togglePause(): void {
    if (!this.game) return;
    if (this.pauseClose) {
      this.pauseClose();
      this.pauseClose = null;
      return;
    }
    if (this.screen) return;
    this.game.heldDir = null;
    const close = showDialog(this.ui, 'Pausa', null, [
      { label: 'Continuar', kind: 'primary', action: () => void (this.pauseClose = null) },
      {
        label: 'Guardar partida',
        action: () => {
          void this.autosave('manual').then(() => this.hud?.pushMessage('Partida guardada.', 'good'));
          this.pauseClose = null;
        },
      },
      {
        label: 'Ajustes',
        action: () => {
          this.pauseClose = null;
          this.showSettings(() => this.setScreen(null));
        },
      },
      {
        label: 'Guardar y salir al menú',
        kind: 'danger',
        action: () => {
          this.pauseClose = null;
          void this.quitToMenu();
        },
      },
    ]);
    this.pauseClose = close;
  }

  private async quitToMenu(): Promise<void> {
    await this.autosave('salir al menú');
    this.loop.stop();
    this.game = null;
    this.hud?.root.remove();
    this.hud = null;
    await this.showMainMenu();
  }

  // ------------------------------------------------------- Ciclo de vida
  private setupLifecycle(): void {
    // Navegador/PWA: guardar al ocultar o cerrar la pestaña.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.autosave('app oculta');
    });
    window.addEventListener('pagehide', () => void this.autosave('cierre'));

    if (!Capacitor.isNativePlatform()) return;
    void CapApp.addListener('pause', () => void this.autosave('app en pausa'));
    void CapApp.addListener('backButton', () => {
      const modal = this.ui.querySelector('.modal-back');
      if (this.pauseClose) {
        this.togglePause();
      } else if (modal) {
        modal.remove();
      } else if (this.game && this.screen) {
        this.setScreen(null);
      } else if (this.game) {
        this.togglePause();
      } else {
        void CapApp.exitApp();
      }
    });
  }
}
