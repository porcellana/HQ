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
import { Game, type LevelUpEvent } from '@/game/game';
import { SaveManager, exportCode, importCode } from '@/game/save/saveManager';
import { showExport, showImport } from '@/ui/transfer';
import { defaultStores } from '@/game/save/storage';
import { loadSettings, saveSettings, type Settings } from '@/game/settings';
import { createNewGame, type GameState } from '@/game/state';
import { Renderer } from '@/gfx/renderer';
import { heroColors } from '@/gfx/sprites';
import { creationScreen } from '@/ui/creation';
import { characterSheet } from '@/ui/sheet';
import { inventoryScreen } from '@/ui/inventory';
import { talentPicker } from '@/ui/talents';
import { npcDialog } from '@/ui/npcDialog';
import { shopScreen } from '@/ui/shop';
import { journalScreen } from '@/ui/journal';
import { zoneMapScreen } from '@/ui/zoneMap';
import { evolutionScreen, moveChoice, petOrders, petScreen, stableScreen } from '@/ui/pets';
import type { NpcDef } from '@/data/schema';
import { confirmDialog, showDialog } from '@/ui/dialogs';
import { buzz, h } from '@/ui/dom';
import { Hud } from '@/ui/hud';
import { mainMenu, settingsScreen } from '@/ui/menus';
import { helpScreen } from '@/ui/help';
import { victoryScreen } from '@/ui/victory';
import { Sfx } from '@/audio/sfx';

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
  private readonly sfx = new Sfx();
  /** La pantalla final espera a que se cierre el diálogo de la misión. */
  private pendingVictory = false;

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
        if (code === 'KeyI') this.showInventory();
        if (code === 'KeyJ') this.showJournal();
        if (code === 'KeyM') this.showZoneMap();
        if (code === 'KeyQ') this.game?.quickPotion();
        if (code === 'KeyF') this.game?.flee();
        const n = Number(code.replace('Digit', ''));
        if (code.startsWith('Digit') && n >= 1 && this.game) {
          const sk = this.game.cls.skills.filter((s) => s.unlockLevel <= this.game!.state.player.level)[n - 1];
          if (sk) this.game.selectSkill(sk);
        }
      },
    });
    window.addEventListener('resize', () => this.layout());
    // El audio sólo puede arrancar tras un gesto del usuario.
    window.addEventListener('pointerdown', () => this.sfx.unlock(), { once: true });
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
        { onExport: () => void this.exportSave(), onImport: () => this.importSave(back) },
      ),
    );
  }

  private async exportSave(): Promise<void> {
    let state = this.game?.state;
    if (!state) {
      const res = await this.saves.load();
      if (!res.ok) {
        showDialog(this.ui, 'Exportar partida', 'No hay ninguna partida guardada que exportar.', [{ label: 'Vale' }]);
        return;
      }
      state = res.state;
    } else {
      await this.autosave('exportar');
    }
    showExport(this.ui, exportCode(state, __APP_VERSION__));
  }

  private importSave(back: () => void): void {
    showImport(this.ui, async (code) => {
      const res = importCode(code);
      if (!res.ok) return res.message;
      const wasPlaying = !!this.game;
      this.loop.stop();
      this.game = null;
      this.hud?.root.remove();
      this.hud = null;
      await this.saves.save(res.state);
      this.setScreen(null);
      if (wasPlaying) this.startGame(res.state);
      else back();
      this.toast(`Partida de ${res.state.player.name} importada.`);
      return null;
    });
  }

  private applySettings(): void {
    document.documentElement.classList.toggle('ui-grande', this.settings.uiScale === 'grande');
    this.hud?.applySettings(this.settings);
    if (this.game) this.game.stepDuration = this.settings.moveSpeed === 'rapida' ? 0.08 : 0.14;
    this.sfx.enabled = this.settings.sound;
    this.sfx.volume = this.settings.volume;
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
          this.hud?.pushMessage(`¡Que empiece la aventura, ${r.name}!`, 'good');
          this.hud?.pushMessage('Toca el mapa para caminar. Las flechas doradas llevan a las salidas.', 'info');
          this.hud?.pushMessage('Tu objetivo sale arriba. ¿Dudas? Menú → Cómo se juega.', 'info');
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
      onInventory: () => this.showInventory(),
      onJoystick: (d) => this.setHeldDir(d),
      onSkill: (sk) => game.selectSkill(sk),
      onFlee: () => game.flee(),
      onPotion: () => {
        const err = game.quickPotion();
        if (err) hud.pushMessage(err, 'warn');
      },
      onMinimapTap: () => this.showZoneMap(),
      onPetOrders: () => {
        if (!this.screen && !this.pauseClose) petOrders(this.ui, game, () => this.showPets());
      },
      onBind: () => {
        const err = game.bindPet();
        if (err) hud.pushMessage(err, 'warn');
      },
    });
    this.hud = hud;
    this.ui.prepend(hud.root);
    this.applyLook();
    this.applySettings();

    game.events.on('message', (m) => hud.pushMessage(m.text, m.kind));
    game.events.on('dice', (d) => hud.dice.show(d));
    game.events.on('playerHurt', ({ amount }) => buzz(this.settings.vibration, Math.min(80, 15 + amount * 4)));
    game.events.on('levelUp', (ev) => this.showLevelUp(ev));
    game.events.on('playerDied', () => this.showDeath());
    game.events.on('petTapped', () => {
      if (!this.screen && !this.pauseClose) petOrders(this.ui, game, () => this.showPets());
    });
    game.events.on('petEvent', (ev) => {
      if (ev.kind === 'vinculo') buzz(this.settings.vibration, 40);
    });
    // Entrenamiento del establo mientras no jugabas
    for (const r of game.trainStable()) hud.pushMessage(`🐾 ${r.name} ha subido ${r.levels} nivel${r.levels > 1 ? 'es' : ''} en el establo mientras no estabas.`, 'good');
    game.events.on('sfx', ({ id }) => this.sfx.play(id));
    game.events.on('victory', () => {
      this.pendingVictory = true;
      void this.autosave('victoria');
    });
    game.events.on('npcTalk', ({ npc }) => this.showNpcDialog(npc));
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
    // Sólo en desarrollo (npm run dev): acceso desde la consola del navegador para depurar.
    if (import.meta.env.DEV) Object.assign(window, { __game: game, __app: this });
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

  private showLevelUp(ev: LevelUpEvent): void {
    buzz(this.settings.vibration, 60);
    void this.autosave('subida de nivel');
    const body = h('ul', {}, [
      h('li', { text: `+${Math.max(0, ev.hpGain)} PV máximos (vida restaurada)` }),
      ev.mpGain > 0 ? h('li', { text: `+${ev.mpGain} ${this.game?.cls.resource.short ?? 'PM'} máximos` }) : null,
      h('li', { text: `+${ev.points} punto${ev.points > 1 ? 's' : ''} de característica para repartir` }),
      ...ev.skills.map((sk) => h('li', { text: `Nueva habilidad: ${sk.icon} ${sk.name}` })),
    ]);
    if (ev.talentChoices > 0) body.append(h('li', { text: `✦ Elige un talento nuevo (${ev.talentChoices} pendiente${ev.talentChoices > 1 ? 's' : ''})` }));
    const close = showDialog(this.ui, `¡Nivel ${ev.level}!`, body, [
      ...(ev.talentChoices > 0 ? [{ label: '✦ Elegir talento', kind: 'primary' as const, action: () => this.showTalents() }] : []),
      { label: 'Repartir puntos', kind: ev.talentChoices > 0 ? undefined : ('primary' as const), action: () => this.showSheet() },
      { label: 'Seguir', action: () => void 0 },
    ]);
    void close;
    this.ui.querySelector('.modal:last-of-type')?.classList.add('levelup');
  }

  private showDeath(): void {
    buzz(this.settings.vibration, 200);
    window.setTimeout(() => {
      showDialog(this.ui, 'Has caído', 'La oscuridad te envuelve... pero tu historia no termina aquí.', [
        {
          label: 'Despertar en el templo (−10 % de oro)',
          kind: 'primary',
          action: () => {
            this.game?.respawn();
            void this.autosave('reaparición');
          },
        },
        {
          label: 'Cargar la última partida guardada',
          action: () => void this.continueGame(),
        },
      ]);
    }, 700);
  }

  private showInventory(): void {
    const game = this.game;
    if (!game || this.pauseClose || this.screen) return;
    game.heldDir = null;
    this.setScreen(
      inventoryScreen(
        game,
        () => this.setScreen(null),
        () => {
          // Usar un objeto en combate gasta el turno: cerramos para que se vea.
          if (game.phase === 'enemies') this.setScreen(null);
          void this.autosave('mochila');
        },
      ),
    );
  }

  private showTalents(): void {
    const game = this.game;
    if (!game) return;
    game.heldDir = null;
    this.setScreen(
      talentPicker(game, () => {
        this.setScreen(null);
        this.applyLook();
        void this.autosave('talento');
      }),
    );
  }

  /** Mapa grande de la zona (al tocar el minimapa). */
  private showZoneMap(): void {
    const game = this.game;
    if (!game || this.pauseClose || this.screen) return;
    game.heldDir = null;
    this.setScreen(
      zoneMapScreen(game, this.renderer.zoneImage(game.zone), this.renderer.heroColors, () => this.setScreen(null), (x, y) => {
        this.setScreen(null);
        game.tapTile(x, y);
      }),
    );
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
        () => this.showJournal(),
        () => this.showTalents(),
        () => this.showPets(),
      ),
    );
  }

  /** Ficha de la mascota y bestiario. */
  private showPets(): void {
    const game = this.game;
    if (!game || this.pauseClose) return;
    this.ui.querySelectorAll('.modal-back').forEach((m) => m.remove());
    this.setScreen(petScreen(game, () => this.setScreen(null), () => void this.autosave('mascota')));
  }

  /** Establo: entrena por el tiempo pasado y muestra el resumen. */
  private showStable(): void {
    const game = this.game;
    if (!game) return;
    const report = game.trainStable();
    this.setScreen(stableScreen(game, report, () => this.setScreen(null), () => void this.autosave('establo')));
  }

  /** Muestra la evolución y la elección de movimientos pendientes de la mascota. */
  private resolvingPet = false;
  private checkPetPending(): void {
    const game = this.game;
    const pi = game?.petInstance;
    if (!game || !pi || this.resolvingPet || this.screen || this.pauseClose || this.ui.querySelector('.modal-back')) return;
    if (!game.canAct || game.inCombat) return;
    if (!pi.pendingEvolution && !pi.pendingMoves.length) return;
    this.resolvingPet = true;
    const finish = () => {
      this.resolvingPet = false;
      void this.autosave('mascota');
    };
    evolutionScreen(this.ui, game, () => moveChoice(this.ui, game, finish));
  }

  private showJournal(): void {
    const game = this.game;
    if (!game || this.pauseClose) return;
    game.heldDir = null;
    this.setScreen(journalScreen(game, () => this.setScreen(null)));
  }

  private showNpcDialog(npc: NpcDef): void {
    const game = this.game;
    if (!game) return;
    game.heldDir = null;
    this.ui.querySelector('.dialog-back')?.remove();
    this.ui.append(
      npcDialog(game, npc, {
        openShop: (shopId) => {
          this.setScreen(
            shopScreen(game, shopId, () => this.setScreen(null), () => void this.autosave('tienda')),
          );
        },
        afterService: () => void this.autosave('servicio'),
        openStable: () => this.showStable(),
        close: () => void 0,
      }),
    );
  }

  /** Los márgenes del HUD cambian (barra de habilidades, objetivo): se revisan a menudo. */
  private insetTimer = 0;

  private tick(dt: number): void {
    const game = this.game;
    if (!game) return;
    this.checkPetPending();
    this.insetTimer -= dt;
    if (this.insetTimer <= 0 && this.hud) {
      this.insetTimer = 0.5;
      const ins = this.hud.insets();
      const dpr = this.renderer.pixelRatio;
      this.renderer.setInsets(ins.top * dpr, ins.bottom * dpr);
    }
    const blocked = !!this.ui.querySelector('.modal-back, .dialog-back');
    if (!this.pauseClose && !this.screen && !blocked) game.update(dt);
    if (this.pendingVictory && !this.pauseClose && !this.screen && !blocked) {
      this.pendingVictory = false;
      this.setScreen(victoryScreen(game.state, () => this.setScreen(null), () => void this.quitToMenu()));
    }
    this.renderer.render(game, dt, { grid: this.settings.grid, dayNight: this.settings.dayNight, questGuide: this.settings.questGuide });
    this.hud?.update(game, dt);
  }

  private onTap(sx: number, sy: number): void {
    if (!this.game || this.pauseClose || this.screen || this.ui.querySelector('.modal-back, .dialog-back')) return;
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
    if (!game || game.isDead) return this.saving;
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
        label: '❓ Cómo se juega',
        action: () => {
          this.pauseClose = null;
          this.setScreen(helpScreen(() => this.setScreen(null)));
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
      const modal = this.ui.querySelector('.modal-back, .dialog-back');
      if (this.pauseClose) {
        this.togglePause();
      } else if (modal) {
        modal.remove();
      } else if (this.game && this.screen) {
        this.setScreen(null);
      } else if (this.game) {
        this.togglePause();
      } else if (this.screen && !this.screen.classList.contains('main-menu')) {
        // Ajustes o creación de personaje: Atrás vuelve al menú principal.
        void this.showMainMenu();
      } else {
        void CapApp.exitApp();
      }
    });
  }
}
