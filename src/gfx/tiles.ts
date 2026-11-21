/**
 * GENERADORES DE TILES PIXEL ART
 * ------------------------------
 * Cada generador pinta una casilla de 16x16 con un Rng propio, de modo que
 * cada tile tiene varias variantes deterministas (sin assets externos).
 * Para crear un tile nuevo: añade aquí una función y úsala como `sprite`
 * en src/data/config/tiles.ts.
 */
import { Rng, hashString } from '@/engine/rng';
import { PAL } from './palette';
import { TILE, ctx2d, makeCanvas, px } from './canvas';

type Gen = (c: CanvasRenderingContext2D, r: Rng) => void;

const speckle = (c: CanvasRenderingContext2D, r: Rng, n: number, colors: readonly string[]) => {
  for (let i = 0; i < n; i++) px(c, r.int(0, 15), r.int(0, 15), r.pick(colors));
};

const grass: Gen = (c, r) => {
  px(c, 0, 0, PAL.grass, TILE, TILE);
  speckle(c, r, 22, [PAL.grassD, PAL.grassD, PAL.grassL]);
  for (let i = 0; i < 3; i++) {
    const x = r.int(1, 14), y = r.int(2, 14);
    px(c, x, y, PAL.grassL);
    px(c, x, y - 1, PAL.grassLL);
  }
};

const flowers: Gen = (c, r) => {
  grass(c, r);
  const cols = [PAL.red, PAL.goldL, PAL.white, PAL.purple];
  for (let i = 0; i < 4; i++) {
    const x = r.int(2, 13), y = r.int(2, 13);
    const col = r.pick(cols);
    px(c, x, y, col);
    px(c, x - 1, y, col);
    px(c, x + 1, y, col);
    px(c, x, y - 1, col);
    px(c, x, y + 1, PAL.grassLL);
    px(c, x, y, PAL.gold);
  }
};

const dirt: Gen = (c, r) => {
  px(c, 0, 0, PAL.dirt, TILE, TILE);
  speckle(c, r, 26, [PAL.dirtD, PAL.dirtL]);
  for (let i = 0; i < 2; i++) {
    const x = r.int(1, 13), y = r.int(1, 13);
    px(c, x, y, PAL.stoneL, 2, 1);
    px(c, x, y + 1, PAL.dirtD, 2, 1);
  }
};

const cobble: Gen = (c, r) => {
  px(c, 0, 0, '#3a3640', TILE, TILE);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 === 0 ? 0 : -3;
    for (let col = 0; col < 4; col++) {
      const x = off + col * 6, y = row * 4;
      const base = r.pick(['#6a6470', '#5d5866', '#74695c']);
      px(c, x + 1, y + 1, base, 4, 2);
      px(c, x + 1, y + 1, PAL.stoneLL, 2, 1);
      px(c, x + 1, y + 3, '#2e2b33', 4, 1);
    }
  }
};

const stoneFloor: Gen = (c, r) => {
  px(c, 0, 0, PAL.stone, TILE, TILE);
  speckle(c, r, 14, [PAL.stoneD, PAL.stoneL]);
  // Juntas de losas
  px(c, 0, 0, PAL.stoneD, TILE, 1);
  px(c, 0, 0, PAL.stoneD, 1, TILE);
  const mid = r.int(6, 9);
  px(c, 0, mid, PAL.stoneD, TILE, 1);
  px(c, r.int(4, 11), 0, PAL.stoneD, 1, mid);
  if (r.chance(0.3)) {
    let x = r.int(3, 12), y = r.int(mid + 2, 14);
    for (let i = 0; i < 4; i++) {
      px(c, x, y, PAL.shadow);
      x += r.int(-1, 1);
      y -= 1;
    }
  }
};

const stoneWall: Gen = (c, r) => {
  px(c, 0, 0, PAL.shadow, TILE, TILE);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 === 0 ? 0 : -4;
    for (let col = 0; col < 3; col++) {
      const x = off + col * 8, y = row * 4;
      const base = r.pick([PAL.stoneD, PAL.stone, PAL.stone]);
      px(c, x + 1, y, base, 7, 3);
      px(c, x + 1, y, PAL.stoneL, 7, 1);
    }
  }
  px(c, 0, 15, PAL.black, TILE, 1);
};

const water: Gen = (c, r) => {
  px(c, 0, 0, PAL.water, TILE, TILE);
  speckle(c, r, 10, [PAL.waterD]);
  for (let i = 0; i < 3; i++) {
    const x = r.int(0, 11), y = r.int(1, 14);
    px(c, x, y, PAL.waterL, 3, 1);
    px(c, x + 1, y - 1, PAL.waterL, 2, 1);
  }
};

const tree: Gen = (c, r) => {
  grass(c, r);
  // Sombra
  px(c, 3, 13, PAL.grassD, 10, 2);
  // Tronco
  px(c, 7, 10, PAL.woodD, 2, 5);
  px(c, 7, 10, PAL.wood, 1, 4);
  // Copa redonda
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 5.5;
      const d = dx * dx + dy * dy * 1.1;
      if (d < 40) {
        let col: string = PAL.leaf;
        if (dx + dy > 3) col = PAL.leafD;
        else if (dx + dy < -4) col = PAL.leafL;
        if (d > 32) col = PAL.leafD;
        px(c, x, y, col);
      }
    }
  }
  for (let i = 0; i < 6; i++) px(c, r.int(3, 11), r.int(1, 8), r.pick([PAL.leafL, PAL.leafD, PAL.grassL]));
};

const pine: Gen = (c, r) => {
  px(c, 0, 0, PAL.grassD, TILE, TILE);
  speckle(c, r, 12, [PAL.grass, PAL.leafD]);
  px(c, 3, 14, PAL.black, 10, 2);
  px(c, 7, 13, PAL.woodD, 2, 3);
  // Capas de ramas de arriba a abajo, con contorno oscuro y luz a la izquierda.
  const layers: Array<[number, number]> = [[1, 2], [4, 4], [7, 6], [10, 7]];
  for (const [y0, half] of layers) {
    for (let y = 0; y < 4; y++) {
      const w = Math.max(1, Math.round((half * (y + 1)) / 4));
      for (let x = 8 - w; x < 8 + w; x++) {
        const edge = x === 8 - w || x === 8 + w - 1 || y === 3;
        px(c, x, y0 + y - 1, edge ? PAL.leafD : x < 7 ? PAL.grassL : PAL.leafL);
      }
    }
  }
  px(c, 7, 0, PAL.grassLL);
  for (let i = 0; i < 4; i++) px(c, r.int(5, 7), r.int(3, 12), PAL.grassLL);
};

const bush: Gen = (c, r) => {
  grass(c, r);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 9;
      const d = dx * dx + dy * dy * 1.4;
      if (d < 30) px(c, x, y, d > 22 || dx + dy > 3 ? PAL.leafD : PAL.leafL);
    }
  }
  for (let i = 0; i < 3; i++) px(c, r.int(4, 11), r.int(6, 12), PAL.red);
};

const rock: Gen = (c, r) => {
  grass(c, r);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 9;
      const d = dx * dx * 0.8 + dy * dy * 1.3;
      if (d < 36) {
        let col: string = PAL.stone;
        if (dx + dy > 2) col = PAL.stoneD;
        if (dx + dy < -5) col = PAL.stoneL;
        if (d > 28) col = PAL.shadow;
        px(c, x, y, col);
      }
    }
  }
  px(c, r.int(5, 9), r.int(7, 10), PAL.stoneLL);
};

const roofGen = (d: string, m: string, l: string): Gen => (c, r) => {
  px(c, 0, 0, m, TILE, TILE);
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    px(c, 0, y + 3, d, TILE, 1);
    const off = row % 2 === 0 ? 0 : 2;
    for (let x = off; x < 16; x += 4) {
      px(c, x, y, d, 1, 3);
      px(c, x + 1, y, l, 2, 1);
    }
  }
  speckle(c, r, 4, [d]);
};

const woodWall: Gen = (c, r) => {
  px(c, 0, 0, PAL.wood, TILE, TILE);
  for (let x = 0; x < 16; x += 4) {
    px(c, x, 0, PAL.woodD, 1, TILE);
    px(c, x + 1, 0, PAL.woodL, 1, TILE);
  }
  px(c, 0, 0, PAL.woodD, TILE, 2);
  px(c, 0, 14, PAL.shadow, TILE, 2);
  speckle(c, r, 6, [PAL.woodD]);
  // Ventanita a veces
  if (r.chance(0.35)) {
    px(c, 5, 4, PAL.woodD, 6, 6);
    px(c, 6, 5, PAL.gold, 4, 4);
    px(c, 7, 5, PAL.woodD, 1, 4);
    px(c, 6, 7, PAL.woodD, 4, 1);
  }
};

const door: Gen = (c, r) => {
  woodWall(c, new Rng(1));
  px(c, 3, 2, PAL.black, 10, 14);
  px(c, 4, 3, PAL.woodD, 8, 13);
  for (let x = 4; x < 12; x += 2) px(c, x, 3, PAL.woodL, 1, 13);
  px(c, 4, 6, PAL.woodD, 8, 1);
  px(c, 4, 11, PAL.woodD, 8, 1);
  px(c, 10, 9, PAL.gold, 1, 1);
  void r;
};

const fence: Gen = (c, r) => {
  grass(c, r);
  px(c, 0, 6, PAL.woodL, TILE, 1);
  px(c, 0, 7, PAL.woodD, TILE, 1);
  px(c, 0, 10, PAL.woodL, TILE, 1);
  px(c, 0, 11, PAL.woodD, TILE, 1);
  for (const x of [2, 13]) {
    px(c, x, 3, PAL.woodL, 1, 11);
    px(c, x + 1, 3, PAL.woodD, 1, 11);
  }
};

const bridge: Gen = (c, r) => {
  water(c, r);
  px(c, 1, 0, PAL.woodD, 14, TILE);
  for (let y = 0; y < 16; y += 3) {
    px(c, 2, y, PAL.wood, 12, 2);
    px(c, 2, y, PAL.woodL, 12, 1);
  }
  px(c, 1, 0, PAL.black, 1, TILE);
  px(c, 14, 0, PAL.black, 1, TILE);
};

const well: Gen = (c, r) => {
  cobble(c, r);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = (x - 7.5) ** 2 + (y - 8) ** 2;
      if (d < 44) px(c, x, y, d > 26 ? PAL.stoneL : d > 18 ? PAL.stoneD : PAL.waterD);
    }
  }
  px(c, 6, 6, PAL.waterL, 2, 1);
};

const sign: Gen = (c, r) => {
  grass(c, r);
  px(c, 7, 8, PAL.woodD, 2, 7);
  px(c, 2, 3, PAL.woodD, 12, 6);
  px(c, 3, 4, PAL.woodL, 10, 4);
  px(c, 4, 5, PAL.woodD, 6, 1);
  px(c, 4, 7, PAL.woodD, 4, 1);
};

const lamp: Gen = (c, r) => {
  grass(c, r);
  px(c, 7, 6, PAL.black, 2, 9);
  px(c, 6, 14, PAL.black, 4, 1);
  px(c, 5, 1, PAL.black, 6, 6);
  px(c, 6, 2, PAL.goldL, 4, 4);
  px(c, 7, 3, PAL.white, 2, 2);
};

/** Farola sobre adoquines (calles de ciudad). */
const streetLamp: Gen = (c, r) => {
  cobble(c, r);
  px(c, 7, 6, PAL.black, 2, 9);
  px(c, 6, 14, PAL.black, 4, 1);
  px(c, 5, 1, PAL.black, 6, 6);
  px(c, 6, 2, PAL.goldL, 4, 4);
  px(c, 7, 3, PAL.white, 2, 2);
};

const grave: Gen = (c, r) => {
  grass(c, r);
  px(c, 4, 13, PAL.grassD, 8, 2);
  px(c, 5, 4, PAL.stoneL, 6, 10);
  px(c, 6, 3, PAL.stoneL, 4, 1);
  px(c, 10, 4, PAL.stoneD, 1, 10);
  px(c, 7, 6, PAL.stoneD, 2, 1);
  px(c, 7, 5, PAL.stoneD, 1, 4);
};

const cave: Gen = (c, r) => {
  px(c, 0, 0, PAL.stoneD, TILE, TILE);
  speckle(c, r, 12, [PAL.stone, PAL.shadow]);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 15;
      if (dx * dx + dy * dy * 0.7 < 48) px(c, x, y, y < 6 ? PAL.shadow : PAL.black);
    }
  }
};

// ------------------------------------------------------------ interiores
const woodFloor: Gen = (c, r) => {
  px(c, 0, 0, PAL.wood, TILE, TILE);
  for (let y = 0; y < 16; y += 4) {
    px(c, 0, y, PAL.woodD, TILE, 1);
    const seam = r.int(2, 13);
    px(c, seam, y + 1, PAL.woodD, 1, 3);
    px(c, 0, y + 1, PAL.woodL, TILE, 1);
  }
  speckle(c, r, 6, [PAL.woodD]);
};

const carpet: Gen = (c, r) => {
  woodFloor(c, r);
  px(c, 1, 1, PAL.roofD, 14, 14);
  px(c, 2, 2, PAL.roof, 12, 12);
  px(c, 3, 3, PAL.gold, 10, 1);
  px(c, 3, 12, PAL.gold, 10, 1);
  px(c, 7, 6, PAL.goldL, 2, 4);
};

const counter: Gen = (c, r) => {
  woodFloor(c, r);
  px(c, 0, 3, PAL.black, TILE, 12);
  px(c, 0, 4, PAL.woodL, TILE, 3);
  px(c, 0, 7, PAL.wood, TILE, 7);
  for (let x = 1; x < 16; x += 5) px(c, x, 8, PAL.woodD, 1, 6);
  if (r.chance(0.5)) px(c, r.int(2, 11), 2, PAL.gold, 3, 2);
};

const table: Gen = (c, r) => {
  woodFloor(c, r);
  px(c, 2, 4, PAL.black, 12, 9);
  px(c, 3, 5, PAL.woodL, 10, 5);
  px(c, 3, 10, PAL.woodD, 10, 2);
  if (r.chance(0.6)) {
    px(c, 6, 5, PAL.bone, 3, 3);
    px(c, 7, 6, PAL.dirtD, 1, 1);
  }
};

const barrel: Gen = (c, r) => {
  woodFloor(c, r);
  px(c, 3, 2, PAL.black, 10, 13);
  px(c, 4, 3, PAL.wood, 8, 11);
  px(c, 4, 3, PAL.woodL, 3, 11);
  px(c, 3, 5, PAL.steelD, 10, 1);
  px(c, 3, 11, PAL.steelD, 10, 1);
};

const shelf: Gen = (c, r) => {
  px(c, 0, 0, PAL.woodD, TILE, TILE);
  for (let y = 4; y < 16; y += 5) {
    px(c, 0, y, PAL.woodL, TILE, 1);
    for (let x = 1; x < 15; x += 3) {
      if (!r.chance(0.7)) continue;
      const col = r.pick([PAL.red, PAL.blue, '#7ac040', PAL.gold, PAL.purple]);
      px(c, x, y - 3, col, 2, 3);
      px(c, x, y - 3, PAL.white, 1, 1);
    }
  }
};

const altar: Gen = (c, r) => {
  px(c, 0, 0, PAL.stone, TILE, TILE);
  speckle(c, r, 8, [PAL.stoneD, PAL.stoneL]);
  px(c, 1, 5, PAL.black, 14, 10);
  px(c, 2, 6, PAL.white, 12, 3);
  px(c, 2, 9, PAL.stoneL, 12, 5);
  px(c, 7, 0, PAL.gold, 2, 6);
  px(c, 5, 2, PAL.gold, 6, 2);
  px(c, 3, 4, PAL.goldL, 1, 2);
  px(c, 12, 4, PAL.goldL, 1, 2);
};

const hearth: Gen = (c, r) => {
  stoneWall(c, r);
  px(c, 3, 6, PAL.black, 10, 10);
  px(c, 5, 10, PAL.fire, 6, 5);
  px(c, 6, 8, PAL.gold, 4, 4);
  px(c, 7, 7, PAL.goldL, 2, 3);
  px(c, 4, 14, PAL.woodD, 8, 2);
};

const bed: Gen = (c, r) => {
  woodFloor(c, r);
  px(c, 2, 1, PAL.black, 12, 14);
  px(c, 3, 2, PAL.woodL, 10, 12);
  px(c, 4, 3, PAL.white, 8, 3);
  px(c, 3, 7, PAL.red, 10, 7);
  px(c, 3, 7, PAL.roofL, 10, 1);
};

const anvil: Gen = (c, r) => {
  stoneFloor(c, r);
  px(c, 2, 5, PAL.black, 12, 5);
  px(c, 3, 6, PAL.steel, 10, 3);
  px(c, 6, 9, PAL.black, 4, 5);
  px(c, 7, 9, PAL.steelD, 2, 4);
  px(c, 4, 13, PAL.steelD, 8, 2);
};

const dock: Gen = (c, r) => {
  water(c, r);
  for (let x = 0; x < 16; x += 4) {
    px(c, x, 0, PAL.wood, 3, TILE);
    px(c, x, 0, PAL.woodL, 1, TILE);
    px(c, x + 3, 0, PAL.woodD, 1, TILE);
  }
  px(c, 0, 7, PAL.woodD, TILE, 1);
};


// ------------------------------------------------------------ Mazmorras (Hito 6)
/** Suelo irregular de mazmorra con piedrecitas. */
const dungeonFloor = (base: string, dark: string, light: string): Gen => (c, r) => {
  px(c, 0, 0, base, TILE, TILE);
  speckle(c, r, 22, [dark, dark, light]);
  for (let i = 0; i < 2; i++) {
    const x = r.int(1, 13), y = r.int(1, 13);
    px(c, x, y, light, 2, 1);
    px(c, x, y + 1, dark, 2, 1);
  }
};

/** Pared de roca con bloques irregulares y borde inferior oscuro. */
const dungeonWall = (base: string, dark: string, light: string, extra?: (c: CanvasRenderingContext2D, r: Rng) => void): Gen => (c, r) => {
  px(c, 0, 0, dark, TILE, TILE);
  for (let i = 0; i < 6; i++) {
    const w = r.int(4, 8), h = r.int(3, 5);
    const x = r.int(-2, 12), y = r.int(0, 10);
    px(c, x, y, base, w, h);
    px(c, x, y, light, w, 1);
  }
  px(c, 0, 14, PAL.black, TILE, 2);
  extra?.(c, r);
};

const silkStrands = (c: CanvasRenderingContext2D, r: Rng) => {
  for (let i = 0; i < 3; i++) {
    let x = r.int(0, 15);
    for (let y = 0; y < 14; y++) {
      px(c, x, y, 'rgba(236,230,214,0.55)');
      if (r.chance(0.3)) x += r.int(-1, 1);
    }
  }
};

const cryptBricks = (c: CanvasRenderingContext2D, r: Rng) => {
  for (let row = 0; row < 3; row++) {
    const off = row % 2 === 0 ? 0 : -4;
    for (let col = 0; col < 3; col++) px(c, off + col * 8, row * 5 + 4, '#0e0c14', 8, 1);
  }
  if (r.chance(0.25)) {
    px(c, 7, 5, PAL.purple, 2, 2);
    px(c, 7, 5, '#c080ff', 1, 1);
  }
};

const stairs = (down: boolean): Gen => (c, r) => {
  dungeonFloor('#3e3a47', '#2c2934', '#57525f')(c, r);
  px(c, 1, 1, PAL.black, 14, 14);
  for (let i = 0; i < 5; i++) {
    const shade = down ? [PAL.stoneLL, PAL.stoneL, PAL.stone, PAL.stoneD, PAL.shadow][i]! : [PAL.shadow, PAL.stoneD, PAL.stone, PAL.stoneL, PAL.stoneLL][i]!;
    px(c, 2, 2 + i * 2 + (down ? 0 : 0), shade, 12, 2);
  }
  // Flecha
  const col = PAL.goldL;
  if (down) {
    px(c, 7, 4, col, 2, 5);
    px(c, 5, 8, col, 6, 1);
    px(c, 6, 9, col, 4, 1);
    px(c, 7, 10, col, 2, 1);
  } else {
    px(c, 7, 7, col, 2, 5);
    px(c, 7, 4, col, 2, 1);
    px(c, 6, 5, col, 4, 1);
    px(c, 5, 6, col, 6, 1);
  }
};

/** Cofre (fondo transparente: se dibuja encima del suelo). */
const chestGen = (open: boolean, locked: boolean): Gen => (c) => {
  px(c, 2, 13, 'rgba(0,0,0,0.35)', 12, 2);
  if (open) {
    px(c, 2, 3, PAL.black, 12, 4);
    px(c, 3, 4, PAL.woodD, 10, 2);
    px(c, 2, 7, PAL.black, 12, 7);
    px(c, 3, 8, PAL.woodD, 10, 5);
    px(c, 4, 8, '#0e0c14', 8, 2);
    px(c, 3, 10, PAL.wood, 10, 1);
    px(c, 7, 9, PAL.gold, 2, 1);
    return;
  }
  px(c, 2, 4, PAL.black, 12, 10);
  px(c, 3, 5, PAL.wood, 10, 3);
  px(c, 3, 5, PAL.woodL, 10, 1);
  px(c, 3, 9, PAL.wood, 10, 4);
  px(c, 3, 8, PAL.woodD, 10, 1);
  px(c, 5, 5, PAL.gold, 1, 8);
  px(c, 10, 5, PAL.gold, 1, 8);
  px(c, 7, 7, locked ? PAL.steel : PAL.gold, 2, 3);
  if (locked) px(c, 7, 8, PAL.black, 2, 1);
};

const trapGen = (kind: 'spikes' | 'darts' | 'fire'): Gen => (c) => {
  px(c, 2, 2, 'rgba(0,0,0,0.25)', 12, 12);
  if (kind === 'spikes') {
    for (let y = 3; y < 13; y += 4) for (let x = 3; x < 13; x += 4) {
      px(c, x + 1, y, PAL.steel, 1, 2);
      px(c, x, y + 2, PAL.steelD, 3, 1);
    }
  } else if (kind === 'darts') {
    px(c, 3, 3, PAL.stoneD, 10, 10);
    for (let y = 5; y < 12; y += 3) for (let x = 5; x < 12; x += 3) px(c, x, y, PAL.black, 1, 1);
    px(c, 7, 7, '#7ac040', 2, 2);
  } else {
    px(c, 3, 3, '#3a1a10', 10, 10);
    px(c, 4, 7, PAL.fire, 8, 2);
    px(c, 7, 4, PAL.fire, 2, 8);
    px(c, 7, 7, PAL.goldL, 2, 2);
  }
  // Borde de aviso
  px(c, 2, 2, '#ff6040', 12, 1);
  px(c, 2, 13, '#ff6040', 12, 1);
  px(c, 2, 2, '#ff6040', 1, 12);
  px(c, 13, 2, '#ff6040', 1, 12);
};

const oreGen = (vein: string, light: string): Gen => (c, r) => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 9;
      const d = dx * dx * 0.8 + dy * dy * 1.2;
      if (d < 40) px(c, x, y, d > 32 ? PAL.black : dx + dy > 2 ? PAL.stone : PAL.stoneL);
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = r.int(3, 10), y = r.int(5, 11);
    px(c, x, y, PAL.black, 4, 3);
    px(c, x + 1, y, vein, 2, 2);
    px(c, x, y + 1, vein, 3, 1);
    px(c, x + 1, y, light, 1, 1);
  }
};

export const TILE_GENERATORS: Readonly<Record<string, Gen>> = {
  streetLamp, woodFloor, carpet, counter, table, barrel, shelf, altar, hearth, bed, anvil, dock,
  grass, flowers, dirt, cobble, stoneFloor, stoneWall, water, tree, pine, bush, rock,
  roof: roofGen(PAL.roofD, PAL.roof, PAL.roofL),
  roofSlate: roofGen(PAL.slateD, PAL.slate, PAL.slateL),
  woodWall, door, fence, bridge, well, sign, lamp, grave, cave,
  caveFloor: dungeonFloor('#6a5a46', '#54473a', '#80705a'),
  caveWall: dungeonWall('#3a3026', '#16120e', '#54473a'),
  silkFloor: dungeonFloor('#5e5a68', '#4a4652', '#7a7686'),
  silkWall: dungeonWall('#2e2a34', '#141218', '#46424e', silkStrands),
  cryptFloor: dungeonFloor('#4e475e', '#3c3648', '#625a76'),
  cryptWall: dungeonWall('#26222e', '#0e0c14', '#3c3648', cryptBricks),
  stairsDown: stairs(true),
  stairsUp: stairs(false),
  chest: chestGen(false, false),
  chestLocked: chestGen(false, true),
  chestOpen: chestGen(true, false),
  trapSpikes: trapGen('spikes'),
  trapDarts: trapGen('darts'),
  trapFire: trapGen('fire'),
  oreIron: oreGen('#c08a6a', '#f0c0a0'),
  oreSilver: oreGen('#d8e0f0', '#ffffff'),
  oreGem: oreGen('#d04080', '#ff90c0'),
};

/** Número de variantes por tile. */
export const TILE_VARIANTS = 4;

const cache = new Map<string, HTMLCanvasElement>();

/** Devuelve (y cachea) el canvas 16x16 de un sprite de tile y variante. */
export function getTileSprite(spriteId: string, variant: number): HTMLCanvasElement {
  const key = `${spriteId}#${variant}`;
  let canvas = cache.get(key);
  if (!canvas) {
    canvas = makeCanvas(TILE, TILE);
    const gen = TILE_GENERATORS[spriteId];
    const c = ctx2d(canvas);
    if (gen) gen(c, new Rng(hashString(key)));
    else {
      // Tile desconocido: cuadro magenta para detectarlo fácilmente.
      px(c, 0, 0, '#ff00ff', TILE, TILE);
      console.warn(`[gfx] sprite de tile desconocido: ${spriteId}`);
    }
    cache.set(key, canvas);
  }
  return canvas;
}

/** Variante estable para una casilla (para que el mapa no "parpadee"). */
export function variantFor(x: number, y: number): number {
  return ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % TILE_VARIANTS;
}
