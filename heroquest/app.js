(function () {
  var TILE = { WALL:'#', FLOOR:'.', DOOR:'D', EXIT:'X', TRAP:'T', CHEST:'C', KEY:'K', ARMORY:'A' };

  var heroTemplates = [
    { id:'barbaro', label:'B', name:'Bárbaro', hp:8, maxHp:8, atk:3, def:2, moveBonus:2 },
    { id:'arquero', label:'A', name:'Arquero', hp:6, maxHp:6, atk:2, def:2, moveBonus:2, range:2 },
    { id:'mago', label:'M', name:'Mago', hp:5, maxHp:5, atk:2, def:1, moveBonus:2, range:2 },
    { id:'enano', label:'E', name:'Enano', hp:7, maxHp:7, atk:2, def:3, moveBonus:1 }
  ];

  var enemyTemplates = [
    { type:'goblin', label:'g', hp:2, maxHp:2, atk:2, def:1, move:3 },
    { type:'esqueleto', label:'e', hp:3, maxHp:3, atk:2, def:2, move:1 },
    { type:'orco', label:'o', hp:4, maxHp:4, atk:3, def:2, move:2 },
    { type:'caos', label:'c', hp:5, maxHp:5, atk:3, def:2, move:2 },
    { type:'troll', label:'t', hp:7, maxHp:7, atk:3, def:3, move:1 },
    { type:'arana', label:'s', hp:2, maxHp:2, atk:2, def:1, move:4 },
    { type:'licantropo', label:'l', hp:5, maxHp:5, atk:4, def:2, move:3 }
  ];

  var board = document.getElementById('board');
  var activeHeroCardEl = document.getElementById('activeHeroCard');
  var widthEl = document.getElementById('mapWidth');
  var heightEl = document.getElementById('mapHeight');
  var enemyEl = document.getElementById('enemyCount');
  var heroEl = document.getElementById('heroCount');
  var extraRoomsEl = document.getElementById('extraRooms');
  var styleEl = document.getElementById('styleSelect');
  var generateBtn = document.getElementById('generateBtn');
  var fitBtn = document.getElementById('fitBtn');
  var rollBtn = document.getElementById('rollBtn');
  var endTurnBtn = document.getElementById('endTurnBtn');
  var turnInfoEl = document.getElementById('turnInfo');
  var endOverlayEl = document.getElementById('endOverlay');
  // Elements not present in current HTML (guards already null-check internally):
  var statusEl = null;
  var summaryEl = null;
  var characterRosterEl = null;
  var turnPhaseEl = null;
  var combatLogEl = null;
  var combatLastEl = null;
  var combatPreviewEl = null;
  var endTitleEl = document.getElementById('endTitle');
  var endSummaryEl = document.getElementById('endSummary');
  var endRestartBtn = document.getElementById('endRestartBtn');
  var shopBtn = document.getElementById('shopBtn');
  var shopOverlayEl = document.getElementById('shopOverlay');
  var shopItemsEl = document.getElementById('shopItems');
  var shopGoldEl = document.getElementById('shopGold');
  var shopCloseBtn = document.getElementById('shopCloseBtn');

  var current = null;

  // ── Performance: cache for iconSvg to avoid rebuilding identical SVG strings ──
  var _iconSvgCache = {};

  // ── Performance: tile DOM element cache (avoid recreating 600+ divs per render) ──
  var _tileEls = null;
  var _tileElsW = 0;
  var _tileElsH = 0;
  // ── Performance: innerHTML dirty cache (skip DOM write when content unchanged) ──
  var _tileHTMLCache = null;

  var legendIconMap = {
    wall: 'wall',
    floor: 'floor',
    door: 'doorClosed',
    fog: 'fog',
    exit: 'exit',
    trap: 'trap',
    chest: 'chest',
    key: 'key',
    armory: 'armory',
    hero: 'hero',
    enemy: 'enemy',
    boss: 'boss'
  };

  function populateLegendIcons() {
    var nodes = document.querySelectorAll('.legend-glyph[data-icon]');
    Array.prototype.forEach.call(nodes, function (node) {
      var iconName = node.getAttribute('data-icon');
      node.innerHTML = iconSvg(legendIconMap[iconName] || iconName, 'legend-svg');
    });
  }


  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function isEnemyPhaseActive() {
    return !!(current && current.enemyPhaseActive);
  }

  function isMovementAnimationActive() {
    return !!(current && current.movementAnimationActive);
  }

  function isInputLocked() {
    return isEnemyPhaseActive() || isMovementAnimationActive();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function ensureStats() {
    if (!current) return {};
    if (!current.stats) {
      current.stats = {
        enemiesDefeated: 0,
        doorsOpened: 0,
        heroAttacks: 0,
        enemyAttacks: 0,
        damageDealt: 0,
        damageTaken: 0
      };
    }
    return current.stats;
  }

  function addCombatFx(x, y, text, kind) {
    if (!current) return;
    if (!current.floatingFx) current.floatingFx = [];
    if (!current.tileFx) current.tileFx = {};
    var now = Date.now();
    var life = 3000;
    current.floatingFx.push({
      id: 'fx_' + now + '_' + Math.random().toString(36).slice(2, 8),
      key: tileKey(x, y),
      text: text,
      kind: kind || 'damage',
      until: now + life
    });
    current.tileFx[tileKey(x, y)] = { kind: kind || 'damage', until: now + life };
    render();
    setTimeout(function () {
      if (!current) return;
      var now2 = Date.now();
      if (current.floatingFx) current.floatingFx = current.floatingFx.filter(function (fx) { return fx.until > now2; });
      if (current.tileFx) {
        for (var key in current.tileFx) {
          if (current.tileFx[key].until <= now2) delete current.tileFx[key];
        }
      }
      render();
    }, life + 80);
  }

  function getEndState() {
    if (!current) return null;
    if (ensureObjectives().completed) return 'victory';
    if (isGameOver()) return 'defeat';
    return null;
  }

  function updateEndOverlay() {
    if (!endOverlayEl || !endTitleEl || !endSummaryEl) return;
    var endState = getEndState();
    if (!current || !endState) {
      endOverlayEl.classList.add('hidden');
      endTitleEl.className = 'end-title';
      endSummaryEl.innerHTML = '';
      return;
    }
    var stats = ensureStats();
    var survivors = current.heroes ? current.heroes.length : 0;
    var title = endState === 'victory' ? 'Victoria' : 'Derrota';
    endTitleEl.textContent = title;
    endTitleEl.className = 'end-title ' + endState;
    endSummaryEl.innerHTML =
      '<div>' + (endState === 'victory'
        ? 'Los héroes han completado la misión y han escapado de la mazmorra.'
        : 'Todos los héroes han caído antes de completar la misión.') + '</div>' +
      '<div class="end-stat-grid">' +
        '<div class="end-stat"><span class="k">Ronda final</span><span class="v">' + (current.turn ? current.turn.round : '-') + '</span></div>' +
        '<div class="end-stat"><span class="k">Supervivientes</span><span class="v">' + survivors + '</span></div>' +
        '<div class="end-stat"><span class="k">Enemigos derrotados</span><span class="v">' + stats.enemiesDefeated + '</span></div>' +
        '<div class="end-stat"><span class="k">Puertas abiertas</span><span class="v">' + stats.doorsOpened + '</span></div>' +
        '<div class="end-stat"><span class="k">Daño infligido</span><span class="v">' + stats.damageDealt + '</span></div>' +
        '<div class="end-stat"><span class="k">Daño recibido</span><span class="v">' + stats.damageTaken + '</span></div>' +
        '<div class="end-stat"><span class="k">Cofres</span><span class="v">' + (ensureObjectives().chestRequired ? (ensureObjectives().openedChests + '/' + ensureObjectives().totalChests) : '0/0') + '</span></div>' +
        '<div class="end-stat"><span class="k">Oro reunido</span><span class="v">' + ((current.inventory && current.inventory.gold) || 0) + '</span></div>' +
        '<div class="end-stat"><span class="k">Ataques</span><span class="v">' + stats.heroAttacks + ' héroes / ' + stats.enemyAttacks + ' enemigos</span></div>' +
      '</div>';
    endOverlayEl.classList.remove('hidden');
  }

  var logFilter = 'all'; // 'all' | 'combat' | 'items' | 'system'

  function pushCombatLog(message) {
    if (!current) return;
    if (!current.combatLog) current.combatLog = [];
    current.combatLog.unshift(message);
    if (current.combatLog.length > 30) current.combatLog.length = 30;
    current.lastActionMsg = message;
    updateCombatLog();
  }

  function logCategory(line) {
    if (/ataca|impacto|defensa|daño|derrotado|Furia|Frenesí|Golpe|Embate|Caza|Armadura/.test(line)) return 'combat';
    if (/usa|equipa|cofre|armería|trampa|oro|pociones|pergamino|llave|gema|reliquia|artefacto|elixir|corona|cristal|recoge/.test(line)) return 'items';
    return 'system';
  }

  function updateCombatLog() {
    if (!combatLogEl) return;
    if (!current || !current.combatLog || !current.combatLog.length) {
      combatLogEl.innerHTML = '<div class="log-empty">Sin acciones todavía.</div>';
      return;
    }
    var filtered = current.combatLog.filter(function(line) {
      if (logFilter === 'all') return true;
      return logCategory(line) === logFilter;
    });
    var header = '<div class="log-controls">' +
      '<button class="log-filter-btn' + (logFilter==='all'?' active':'') + '" data-filter="all">Todo</button>' +
      '<button class="log-filter-btn' + (logFilter==='combat'?' active':'') + '" data-filter="combat">⚔ Combate</button>' +
      '<button class="log-filter-btn' + (logFilter==='items'?' active':'') + '" data-filter="items">🎒 Objetos</button>' +
      '<button class="log-filter-btn log-clear-btn" data-filter="clear">✕ Limpiar</button>' +
    '</div>';
    var entries = filtered.length
      ? filtered.map(function(line) {
          var cat = logCategory(line);
          return '<div class="log-entry log-entry-' + cat + '">' + escapeHtml(line) + '</div>';
        }).join('')
      : '<div class="log-empty">Sin entradas para este filtro.</div>';
    combatLogEl.innerHTML = header + entries;
  }

  function combatRollsHtml(rolls, successFrom, kind) {
    if (!rolls || !rolls.length) return '<span class="dice-empty">-</span>';
    return rolls.map(function (roll) {
      var success = roll >= successFrom;
      return '<span class="die-chip ' + (success ? ('success ' + kind + '-success') : '') + '">' + roll + '</span>';
    }).join('');
  }

  function updateCombatPreview() {
    if (!combatPreviewEl) return;
    if (!current || !current.heroes || !current.heroes.length) {
      combatPreviewEl.innerHTML = 'Sin partida activa.';
      return;
    }
    var hero = ensureSelectedHero();
    if (!hero) {
      combatPreviewEl.innerHTML = 'Sin héroe activo.';
      return;
    }
    var targets = [];
    var attackable = computeAttackableTiles(hero);
    Object.keys(attackable || {}).forEach(function (key) {
      var xy = parseTileKey(key);
      var enemy = getEnemyAt(xy.x, xy.y);
      if (enemy) targets.push(enemy);
    });
    if (!targets.length) {
      combatPreviewEl.innerHTML = '<div class="combat-preview-empty">Sin enemigos al alcance. Muévete o termina el turno.</div>';
      return;
    }
    combatPreviewEl.innerHTML = targets.map(function (enemy) {
      return '<div class="combat-preview-row">' +
        '<span class="combat-preview-name">' + escapeHtml(unitDisplayName(enemy)) + '</span>' +
        '<span class="combat-preview-stats">PV ' + enemy.hp + '/' + enemy.maxHp + ' · ATQ ' + enemy.atk + ' · DEF ' + enemy.def + '</span>' +
      '</div>';
    }).join('');
  }

  function updateCombatLast() {
    if (!combatLastEl) return;
    if (!current || !current.lastCombat) {
      combatLastEl.innerHTML = 'Todavía no hay acciones de combate.';
      return;
    }
    var c = current.lastCombat;
    var outcome = c.damage > 0 ? ('Daño ' + c.damage) : 'Sin daño';
    if (c.defeated) outcome += ' · Derrotado';
    combatLastEl.innerHTML = '' +
      '<div class="combat-last-head">' +
        '<span class="combat-side ' + (c.actorSide || 'hero') + '">' + escapeHtml(c.attacker) + '</span>' +
        '<span class="combat-vs">→</span>' +
        '<span class="combat-side target">' + escapeHtml(c.defender) + '</span>' +
      '</div>' +
      '<div class="combat-last-grid">' +
        '<div class="combat-row"><span class="k">Ataque</span><span class="v">' + combatRollsHtml(c.attackRolls, c.attackThreshold || 4, 'attack') + '</span></div>' +
        '<div class="combat-row"><span class="k">Defensa</span><span class="v">' + combatRollsHtml(c.defenseRolls, c.defenseThreshold || 5, 'defense') + '</span></div>' +
        '<div class="combat-row"><span class="k">Resultado</span><span class="v">' + c.hits + ' impacto(s) · ' + c.blocks + ' bloqueo(s)</span></div>' +
        '<div class="combat-row"><span class="k">Estado</span><span class="v">' + outcome + '</span></div>' +
      '</div>';
  }

  function recordCombat(data) {
    if (!current) return;
    current.lastCombat = data;
    updateCombatLast();
    updateCombatPreview();
  }

  function rollCombatDice(count, successFrom) {
    var hits = 0;
    var rolls = [];
    for (var i = 0; i < count; i++) {
      var roll = randomInt(Math.random, 1, 6);
      rolls.push(roll);
      if (roll >= successFrom) hits++;
    }
    return { hits:hits, rolls:rolls };
  }


  
  function iconSvg(name, className) {
    var cacheKey = name + '|' + (className || '');
    if (_iconSvgCache[cacheKey]) return _iconSvgCache[cacheKey];
    var cls = className ? ' ' + className : '';
    var svg = '';
    if (name === 'wall') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="0" y="0" width="64" height="64" fill="#252228"/><rect x="0" y="0" width="29" height="14" rx="2" fill="#454048" stroke="#1a1820" stroke-width="1.2"/><rect x="31" y="0" width="33" height="14" rx="2" fill="#424046" stroke="#1a1820" stroke-width="1.2"/><rect x="4" y="19" width="14" height="13" rx="2" fill="#3e3c42" stroke="#1a1820" stroke-width="1.2"/><rect x="20" y="19" width="26" height="13" rx="2" fill="#464248" stroke="#1a1820" stroke-width="1.2"/><rect x="48" y="19" width="12" height="13" rx="2" fill="#424046" stroke="#1a1820" stroke-width="1.2"/><rect x="4" y="34" width="22" height="13" rx="2" fill="#454048" stroke="#1a1820" stroke-width="1.2"/><rect x="28" y="34" width="32" height="13" rx="2" fill="#404044" stroke="#1a1820" stroke-width="1.2"/><rect x="0" y="50" width="33" height="14" rx="2" fill="#464248" stroke="#1a1820" stroke-width="1.2"/><rect x="35" y="50" width="29" height="14" rx="2" fill="#424046" stroke="#1a1820" stroke-width="1.2"/><path d="M5 5h24M33 5h26" stroke="#6e6a74" stroke-width="1" stroke-linecap="round" opacity=".55"/><path d="M5 20h12M21 20h24M49 20h10" stroke="#6e6a74" stroke-width="1" stroke-linecap="round" opacity=".5"/><path d="M5 35h20M29 35h30" stroke="#6e6a74" stroke-width="1" stroke-linecap="round" opacity=".5"/><path d="M16 14l2 4M38 6l1 5M52 34l-1 5M10 48l2 4" stroke="#18161c" stroke-width="1" stroke-linecap="round" opacity=".6"/></svg>';
    else if (name === 'floor') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="3" y="3" width="58" height="58" rx="4" fill="#b8a882"/><path d="M33 3v58M3 33h58" stroke="#8a7a58" stroke-width="2.5"/><rect x="4" y="4" width="27" height="27" rx="1" fill="#c4b48e" opacity=".6"/><rect x="36" y="4" width="24" height="27" rx="1" fill="#bfae88" opacity=".6"/><rect x="4" y="36" width="27" height="24" rx="1" fill="#c2b28c" opacity=".6"/><rect x="36" y="36" width="24" height="24" rx="1" fill="#bdb08a" opacity=".6"/><path d="M5 5h15M5 6h8" stroke="#d8c8a0" stroke-width=".9" stroke-linecap="round" opacity=".7"/><path d="M37 5h14M37 6h8" stroke="#d8c8a0" stroke-width=".9" stroke-linecap="round" opacity=".7"/><path d="M12 16l3 5 2 1M48 12l2-4 1 3M20 44l-3 6M50 42l3 4" stroke="#8a7a58" stroke-width="1" stroke-linecap="round" opacity=".45"/><path d="M4 33 Q18 30 33 33 Q48 30 60 33" stroke="#a09070" stroke-width=".8" stroke-linecap="round" opacity=".4"/></svg>';
    else if (name === 'doorClosed') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="0" y="0" width="64" height="64" fill="#252228"/><rect x="0" y="0" width="16" height="64" fill="#3a3840" stroke="#1e1a14" stroke-width="1"/><rect x="48" y="0" width="16" height="64" fill="#363642" stroke="#1e1a14" stroke-width="1"/><rect x="0" y="0" width="64" height="14" fill="#383844" stroke="#1e1a14" stroke-width="1"/><path d="M18 16 Q32 6 46 16" fill="#4a4438"/><rect x="16" y="12" width="32" height="52" rx="2" fill="#6a4220"/><rect x="17" y="13" width="30" height="50" rx="1" fill="#8a5830"/><rect x="18" y="23" width="28" height="3.5" fill="#2e2e2e"/><rect x="18" y="41" width="28" height="3.5" fill="#2e2e2e"/><rect x="21" y="17" width="9" height="9" rx="1.5" fill="#7a4e24" stroke="#523210" stroke-width=".8"/><rect x="34" y="17" width="9" height="9" rx="1.5" fill="#7a4e24" stroke="#523210" stroke-width=".8"/><rect x="21" y="46" width="9" height="10" rx="1.5" fill="#7a4e24" stroke="#523210" stroke-width=".8"/><rect x="34" y="46" width="9" height="10" rx="1.5" fill="#7a4e24" stroke="#523210" stroke-width=".8"/><circle cx="40" cy="33" r="4" fill="none" stroke="#c89830" stroke-width="2.5"/><circle cx="40" cy="37" r="1.8" fill="#c89830"/><circle cx="29" cy="33" r="2.2" fill="#1a0e08"/><rect x="28" y="33" width="2.5" height="3.5" rx=".8" fill="#1a0e08"/><path d="M20 16h24" stroke="#b07840" stroke-width="1" stroke-linecap="round" opacity=".55"/><path d="M21 18l-1 42M27 16v45M36 16v45M43 18l1 42" stroke="#503010" stroke-width=".8" stroke-linecap="round" opacity=".38"/></svg>';
    else if (name === 'doorOpen') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="3" y="3" width="58" height="58" rx="4" fill="#0a0c12"/><rect x="3" y="3" width="15" height="58" rx="2" fill="#3c3630"/><rect x="46" y="3" width="15" height="58" rx="2" fill="#383228"/><rect x="3" y="3" width="58" height="13" rx="2" fill="#3a3428"/><path d="M18 16 Q32 6 46 16" fill="#464038"/><path d="M18 14 L36 10 L36 58 L18 59 Z" fill="#6a4220"/><path d="M19 15 L35 11 L35 57 L19 58 Z" fill="#885428"/><path d="M22 14l-1 43M28 13v43M33 12v43" stroke="#4e3010" stroke-width=".8" stroke-linecap="round" opacity=".4"/><path d="M18 24 L36 21" stroke="#2a2a2a" stroke-width="3"/><path d="M18 40 L36 37" stroke="#2a2a2a" stroke-width="3"/><path d="M36 10 L54 14 L54 58 L36 58 Z" fill="#120e08" opacity=".85"/><circle cx="33" cy="34" r="2.5" fill="none" stroke="#a07828" stroke-width="1.8"/><path d="M19 16 Q32 7 45 16" fill="none" stroke="#5e5850" stroke-width="1.5" opacity=".5"/><path d="M52 14 Q58 20 58 34" stroke="#1e180e" stroke-width="3" stroke-linecap="round" opacity=".5"/></svg>';
    else if (name === 'fog') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="3" y="3" width="58" height="58" rx="8" fill="#060810"/><path d="M3 52 Q12 42 24 48 Q36 54 48 44 Q56 38 61 44 L61 61 L3 61 Z" fill="#0e1018" opacity=".95"/><path d="M3 44 Q14 34 28 40 Q42 46 56 34 Q60 30 61 35 L61 55 L3 55 Z" fill="#0c0e18" opacity=".8"/><path d="M3 36 Q16 24 30 32 Q44 40 58 26 L61 44 L3 44 Z" fill="#0a0c16" opacity=".7"/><circle cx="20" cy="28" r="1.8" fill="#dd3333" opacity=".4"/><circle cx="24.5" cy="28" r="1.8" fill="#dd3333" opacity=".4"/><circle cx="40" cy="35" r="1.4" fill="#dd3333" opacity=".28"/><circle cx="44.5" cy="35" r="1.4" fill="#dd3333" opacity=".28"/><path d="M6 22 Q16 16 24 22 Q32 28 40 20" fill="none" stroke="#1e2235" stroke-width="2.5" stroke-linecap="round" opacity=".65"/><path d="M10 32 Q22 24 32 30 Q42 36 52 28" fill="none" stroke="#1a1e30" stroke-width="2.2" stroke-linecap="round" opacity=".55"/><path d="M14 42 Q28 36 36 42 Q44 48 56 40" fill="none" stroke="#181c28" stroke-width="2" stroke-linecap="round" opacity=".5"/><circle cx="38" cy="12" r="1" fill="#3a4060" opacity=".5"/><circle cx="50" cy="18" r=".8" fill="#3a4060" opacity=".4"/><circle cx="12" cy="14" r=".8" fill="#3a4060" opacity=".4"/></svg>';
    else if (name === 'exit') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="3" y="3" width="58" height="58" rx="8" fill="#083830"/><circle cx="32" cy="32" r="22" fill="#0a6a5a" opacity=".5"/><circle cx="32" cy="32" r="15" fill="#10a890" opacity=".45"/><circle cx="32" cy="32" r="9" fill="#1ed4b8" opacity=".55"/><circle cx="32" cy="32" r="5" fill="#80fff0" opacity=".8"/><path d="M20 32h16" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M30 22l12 10-12 10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 8v5M32 51v5M8 32h5M51 32h5M16 16l3 3M48 48l3 3M48 16l-3 3M13 48l3-3" stroke="#1ed4b8" stroke-width="1.5" stroke-linecap="round" opacity=".55"/><path d="M13 56 L13 28 Q13 9 32 9 Q51 9 51 28 L51 56" fill="none" stroke="#1a8a78" stroke-width="3" stroke-linecap="round"/><path d="M28 11 Q32 7 36 11 L35 17H29Z" fill="#1a8a78"/></svg>';
    else if (name === 'trap') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="3" y="3" width="58" height="58" rx="4" fill="#a09070"/><path d="M33 3v58M3 33h58" stroke="#7a6a4a" stroke-width="2"/><rect x="4" y="4" width="27" height="27" rx="1" fill="#aaa080" opacity=".6"/><rect x="36" y="4" width="24" height="27" rx="1" fill="#a49a78" opacity=".6"/><rect x="4" y="36" width="27" height="24" rx="1" fill="#a89e7c" opacity=".6"/><rect x="36" y="36" width="24" height="24" rx="1" fill="#a29878" opacity=".6"/><path d="M30 5 L28 22 L36 38 L32 59" stroke="#5a4a2a" stroke-width="2" stroke-linecap="round" opacity=".85"/><path d="M16 34 L30 30 L48 36" stroke="#5a4a2a" stroke-width="1.5" stroke-linecap="round" opacity=".75"/><path d="M27 31l2-6 2 6M33 33l2-5 2 5M22 35l2-5 2 5" fill="#888" opacity=".55"/><circle cx="32" cy="32" r="7" fill="none" stroke="#7a1818" stroke-width="1" stroke-dasharray="2 2" opacity=".45"/><path d="M29 29h6M32 27v6" stroke="#7a1818" stroke-width="1.2" stroke-linecap="round" opacity=".4"/><path d="M6 6h14M37 6h12" stroke="#ccc0a0" stroke-width=".9" stroke-linecap="round" opacity=".55"/></svg>';
    else if (name === 'chest') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="0" y="0" width="64" height="64" fill="#120e06"/><rect x="0" y="27" width="64" height="37" fill="#1a0e04"/><rect x="0" y="29" width="64" height="35" fill="#8a5e1e"/><rect x="1" y="30" width="62" height="34" fill="#a87028"/><path d="M10 38h44M10 44h44" stroke="#6a4010" stroke-width="1.5" opacity=".6"/><path d="M22 30v24M32 30v24M42 30v24" stroke="#6a4010" stroke-width="1" opacity=".4"/><rect x="8" y="34" width="48" height="4" rx="1.5" fill="#d4a020"/><rect x="8" y="46" width="48" height="3" rx="1" fill="#c49018"/><circle cx="14" cy="36" r="2.2" fill="#e8c030"/><circle cx="50" cy="36" r="2.2" fill="#e8c030"/><circle cx="14" cy="48" r="2.2" fill="#e8c030"/><circle cx="50" cy="48" r="2.2" fill="#e8c030"/><rect x="0" y="0" width="64" height="17" fill="#1a0e04"/><rect x="0" y="0" width="64" height="16" fill="#6b4818"/><rect x="1" y="1" width="62" height="15" fill="#8a5e26"/><path d="M22 13v14M32 13v14M42 13v14" stroke="#5a3810" stroke-width="1" opacity=".4"/><path d="M10 20h44" stroke="#5a3810" stroke-width="1.2" opacity=".5"/><rect x="8" y="26" width="48" height="3" rx="1" fill="#d4a020"/><rect x="26" y="24" width="12" height="11" rx="2.5" fill="#c89820"/><circle cx="32" cy="27" r="3.2" fill="#a07010"/><circle cx="32" cy="27" r="1.8" fill="#e8c030"/><rect x="31" y="28" width="2" height="5" rx=".8" fill="#a07010"/><path d="M14 28 Q32 26 50 28" stroke="#ffd040" stroke-width="2" stroke-linecap="round" opacity=".5"/><circle cx="32" cy="36" r="18" fill="#ffc030" opacity=".07"/></svg>';
    else if (name === 'key') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="3" y="3" width="58" height="58" rx="8" fill="#181208"/><circle cx="21" cy="28" r="13" fill="none" stroke="#c0900a" stroke-width="5.5"/><circle cx="21" cy="28" r="9" fill="none" stroke="#d4a020" stroke-width="1.8"/><circle cx="21" cy="28" r="4.8" fill="#d4a020"/><circle cx="21" cy="28" r="2.8" fill="#fff8c0"/><circle cx="21" cy="15.5" r="2.2" fill="#e0b028"/><circle cx="21" cy="40.5" r="2.2" fill="#e0b028"/><circle cx="8.5" cy="28" r="2.2" fill="#e0b028"/><circle cx="33.5" cy="28" r="2.2" fill="#e0b028"/><rect x="33" y="26" width="24" height="4.5" rx="2.2" fill="#c0900a"/><rect x="34" y="27" width="22" height="2.5" rx="1.2" fill="#d4a020"/><rect x="46" y="30.5" width="3.5" height="7" rx="1.2" fill="#b87e08"/><rect x="52" y="30.5" width="3" height="5" rx="1" fill="#b87e08"/><rect x="40" y="30.5" width="3.5" height="9" rx="1.2" fill="#b87e08"/><path d="M35 26 Q42 23 50 26" stroke="#9a6a06" stroke-width=".9" fill="none" opacity=".55"/><path d="M9 22 Q21 16 33 22" stroke="#f0c840" stroke-width="1.5" stroke-linecap="round" opacity=".5"/></svg>';
    else if (name === 'armory') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="3" y="3" width="58" height="58" rx="6" fill="#1e1c22"/><path d="M32 9 L52 18 L52 40 Q52 55 32 60 Q12 55 12 40 L12 18 Z" fill="#283550"/><path d="M32 11 L50 19 L50 40 Q50 53 32 58 Q14 53 14 40 L14 19 Z" fill="#324570"/><circle cx="32" cy="36" r="8.5" fill="#233"/><circle cx="32" cy="36" r="5.5" fill="#445"/><circle cx="32" cy="36" r="3" fill="#6670"/><path d="M32 15v22M20 27h24" stroke="#b89820" stroke-width="2.5" stroke-linecap="round" opacity=".85"/><path d="M9 9 L46 52" stroke="#a0a8b8" stroke-width="4" stroke-linecap="round"/><path d="M21 21 L17 25M21 21 L25 17" stroke="#a0a8b8" stroke-width="3.5" stroke-linecap="round"/><path d="M10 10 L44 50" stroke="#d8e0f0" stroke-width="1.3" stroke-linecap="round" opacity=".6"/><circle cx="9" cy="9" r="4" fill="#c8a820"/><rect x="7.5" y="9" width="3" height="7" rx="1.2" fill="#a08020"/><path d="M56 9 L18 56" stroke="#80704a" stroke-width="3" stroke-linecap="round"/><path d="M56 9 L62 5 L60 14 L52 11 Z" fill="#b8b8b8"/><path d="M55 10 L19 55" stroke="#a09060" stroke-width="1" stroke-linecap="round" opacity=".5"/></svg>';
    else if (name === 'hero') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#1535b5"/><path d="M14 22 Q14 10 32 10 Q50 10 50 22 L48 26 L16 26 Z" fill="#585860"/><path d="M16 24 Q20 13 32 12 Q44 13 48 24" fill="none" stroke="#8888a0" stroke-width="1.5" stroke-linecap="round" opacity=".6"/><path d="M20 26 Q20 46 32 48 Q44 46 44 26 Z" fill="#c87848"/><circle cx="27" cy="33" r="2.5" fill="#1a0800"/><circle cx="37" cy="33" r="2.5" fill="#1a0800"/><circle cx="27.8" cy="32.3" r=".9" fill="#fff" opacity=".9"/><circle cx="37.8" cy="32.3" r=".9" fill="#fff" opacity=".9"/><path d="M28 40 Q32 44 36 40" fill="none" stroke="#a06038" stroke-width="1.5" stroke-linecap="round"/><path d="M14 58 L14 46 Q20 38 26 36 Q32 48 32 48 Q32 48 38 36 Q44 38 50 46 L50 58 Z" fill="#3a2010"/><path d="M16 58 L16 47 Q22 40 28 38 L32 49 L36 38 Q42 40 48 47 L48 58 Z" fill="#5a3018"/></svg>';
    else if (name === 'enemy') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#921818"/><path d="M16 24 Q16 10 32 10 Q48 10 48 24 L48 30 Q44 26 40 28 L32 22 L24 28 Q20 26 16 30 Z" fill="#484850"/><path d="M16 24 Q20 12 32 11 Q44 12 48 24" fill="none" stroke="#707080" stroke-width="1.5" opacity=".6"/><path d="M18 28 Q18 48 32 50 Q46 48 46 28 Z" fill="#c06040"/><path d="M22 32 Q25 29 28 32" fill="#c06040" stroke="#3a1008" stroke-width="2" stroke-linecap="round"/><path d="M36 32 Q39 29 42 32" fill="#c06040" stroke="#3a1008" stroke-width="2" stroke-linecap="round"/><circle cx="25.5" cy="34" r="2.5" fill="#1a0800"/><circle cx="38.5" cy="34" r="2.5" fill="#1a0800"/><circle cx="26" cy="33.3" r=".9" fill="#ff6060" opacity=".9"/><circle cx="39" cy="33.3" r=".9" fill="#ff6060" opacity=".9"/><path d="M26 42 Q30 46 32 46 Q34 46 38 42" fill="#7a1a10" stroke="#5a1008" stroke-width="1"/><path d="M28 43 L30 45 L32 43 L34 45 L36 43" fill="none" stroke="#e0d0c0" stroke-width="1" stroke-linecap="round" opacity=".7"/><path d="M14 58 L14 46 Q20 38 26 36 L32 50 L38 36 Q44 38 50 46 L50 58 Z" fill="#501010"/></svg>';
    else if (name === 'boss') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#8a1010"/><circle cx="32" cy="32" r="27" fill="none" stroke="#e8b820" stroke-width="2"/><path d="M22 9 L26 17 L32 8 L38 17 L42 9 L40 20 L36 16 L32 22 L28 16 L24 20 Z" fill="#e8b820"/><path d="M14 26 Q14 12 32 12 Q50 12 50 26 L50 34 Q44 28 38 32 L32 24 L26 32 Q20 28 14 34 Z" fill="#3a3040"/><path d="M15 28 Q18 14 32 13 Q46 14 49 28" fill="none" stroke="#6a6080" stroke-width="1.5" opacity=".6"/><path d="M16 30 Q16 50 32 52 Q48 50 48 30 Z" fill="#b85838"/><path d="M22 34 Q25 30 28 34" fill="#b85838" stroke="#2a0808" stroke-width="2.2" stroke-linecap="round"/><path d="M36 34 Q39 30 42 34" fill="#b85838" stroke="#2a0808" stroke-width="2.2" stroke-linecap="round"/><circle cx="25.5" cy="36" r="3" fill="#0a0000"/><circle cx="38.5" cy="36" r="3" fill="#0a0000"/><circle cx="26" cy="35.2" r="1.1" fill="#ff8c00" opacity=".95"/><circle cx="39" cy="35.2" r="1.1" fill="#ff8c00" opacity=".95"/><path d="M24 44 Q28 50 32 50 Q36 50 40 44" fill="#5a1010" stroke="#3a0808" stroke-width="1"/><path d="M12 58 L12 46 Q18 36 26 34 L32 52 L38 34 Q46 36 52 46 L52 58 Z" fill="#400808"/></svg>';
    else if (name === 'barbaro') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#1535b5"/><path d="M14 28 Q14 10 32 10 Q50 10 50 28 L48 31 L16 31 Z" fill="#606068"/><path d="M28 12 L28 28" stroke="#484850" stroke-width="3" stroke-linecap="round"/><path d="M36 12 L36 28" stroke="#484850" stroke-width="3" stroke-linecap="round"/><path d="M16 26 Q20 14 32 13 Q44 14 48 26" fill="none" stroke="#909098" stroke-width="1.5" stroke-linecap="round" opacity=".65"/><path d="M14 26 Q6 14 8 7 Q12 7 16 18 L14 26 Z" fill="#808088"/><path d="M50 26 Q58 14 56 7 Q52 7 48 18 L50 26 Z" fill="#808088"/><path d="M8.5 8 Q12 10 15 19" stroke="#b0b0b8" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="M55.5 8 Q52 10 49 19" stroke="#b0b0b8" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="M18 29 Q18 48 32 50 Q46 48 46 29 Z" fill="#c87848"/><path d="M22 32 Q25 29 28 32" fill="none" stroke="#3a1008" stroke-width="2.5" stroke-linecap="round"/><path d="M36 32 Q39 29 42 32" fill="none" stroke="#3a1008" stroke-width="2.5" stroke-linecap="round"/><circle cx="25.5" cy="34" r="2.5" fill="#1a0800"/><circle cx="38.5" cy="34" r="2.5" fill="#1a0800"/><circle cx="26.2" cy="33.3" r=".9" fill="#fff" opacity=".9"/><circle cx="39.2" cy="33.3" r=".9" fill="#fff" opacity=".9"/><path d="M29 37 L34 33" stroke="#8a3818" stroke-width="1.8" stroke-linecap="round" opacity=".75"/><path d="M31 39 Q32 41 33 39" fill="none" stroke="#a05830" stroke-width="1.5" stroke-linecap="round"/><path d="M26 42 Q30 47 32 47 Q34 47 38 42" fill="#7a1808" stroke="#5a1008" stroke-width="1"/><path d="M14 58 L14 46 Q18 38 24 36 Q30 46 32 48 Q34 46 40 36 Q46 38 50 46 L50 58 Z" fill="#3a2010"/><path d="M16 58 L16 47 Q20 40 26 38 L32 49 L38 38 Q44 40 48 47 L48 58 Z" fill="#5a3018"/><path d="M20 38 Q22 35 26 38 Q32 32 38 38 Q42 35 44 38" fill="#402010" stroke="#301808" stroke-width="1" opacity=".85"/><path d="M7 52 L15 40" stroke="#5a3010" stroke-width="3" stroke-linecap="round"/><path d="M4 37 Q3 44 8 46 L14 38 L8 34 Q4 33 4 37 Z" fill="#9a9a9a"/><path d="M4.5 37.5 Q4 43 8 45" stroke="#d0d0d0" stroke-width="1.2" stroke-linecap="round" opacity=".65"/></svg>';
    else if (name === 'arquero') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#1535b5"/><path d="M16 32 Q16 10 32 10 Q48 10 48 32 L48 40 Q40 32 32 34 Q24 32 16 40 Z" fill="#3a3020"/><path d="M17 30 Q20 12 32 11 Q44 12 47 30" fill="none" stroke="#60583a" stroke-width="1.5" opacity=".65"/><path d="M20 30 Q20 50 32 52 Q44 50 44 30 Z" fill="#c8884a"/><path d="M25 33 Q28 30 31 33" fill="none" stroke="#2a1008" stroke-width="2" stroke-linecap="round"/><path d="M33 33 Q36 30 39 33" fill="none" stroke="#2a1008" stroke-width="2" stroke-linecap="round"/><circle cx="27.5" cy="35" r="2.2" fill="#1a0800"/><circle cx="36.5" cy="35" r="2.2" fill="#1a0800"/><circle cx="28.2" cy="34.3" r=".85" fill="#fff" opacity=".9"/><circle cx="37.2" cy="34.3" r=".85" fill="#fff" opacity=".9"/><path d="M28 42 Q32 46 36 42" fill="none" stroke="#a06030" stroke-width="1.5" stroke-linecap="round"/><path d="M14 58 L14 44 Q20 36 28 34 L32 50 L36 34 Q44 36 50 44 L50 58 Z" fill="#2a2010"/><path d="M16 58 L16 45 Q22 38 29 36 L32 51 L35 36 Q42 38 48 45 L48 58 Z" fill="#3e3018"/><path d="M8 10 Q8 56 10 56" stroke="#5a3a18" stroke-width="3.5" stroke-linecap="round"/><path d="M8 10 Q22 20 8 56" fill="none" stroke="#8a5a28" stroke-width="2.2" stroke-linecap="round"/><path d="M8 10 Q6 10 6 12" stroke="#c0a060" stroke-width="1.5" stroke-linecap="round" opacity=".8"/><path d="M8 56 Q6 56 6 54" stroke="#c0a060" stroke-width="1.5" stroke-linecap="round" opacity=".8"/><path d="M54 14 L54 44" stroke="#c0a060" stroke-width="1.5" stroke-linecap="round" opacity=".6"/><path d="M56 28 L54 30 L52 28" stroke="#c0a060" stroke-width="1.5" stroke-linecap="round" opacity=".7"/></svg>';
    else if (name === 'mago') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#1535b5"/><path d="M32 6 L38 20 L50 22 L44 30 L46 38 L32 33 Z" fill="#4a1a8a" opacity=".6"/><path d="M32 6 L46 38 Q38 28 32 33 Z" fill="#9060d8" opacity=".3"/><path d="M26 6 L36 6 Q42 6 40 14 L36 28 Q32 24 28 28 L24 14 Q22 6 26 6 Z" fill="#2a1550"/><path d="M27 6 Q32 3 37 6 Q40 9 38 14 L34 26 Q32 22 30 26 L26 14 Q24 9 27 6 Z" fill="#3a2070"/><path d="M27 7 Q32 4.5 37 7" stroke="#8a60c0" stroke-width="1" stroke-linecap="round" opacity=".7"/><path d="M36 5 L44 3 L42 8 L38 7 Z" fill="#c8b0f8" opacity=".8"/><path d="M32 5 L34 2 L36 5" fill="#c8b0f8" opacity=".6"/><path d="M20 28 Q20 48 32 50 Q44 48 44 28 Z" fill="#d0d8f8"/><path d="M24 32 Q27 29 30 32" fill="none" stroke="#3a2080" stroke-width="2" stroke-linecap="round"/><path d="M34 32 Q37 29 40 32" fill="none" stroke="#3a2080" stroke-width="2" stroke-linecap="round"/><circle cx="27" cy="34" r="2.4" fill="#1a0840"/><circle cx="37" cy="34" r="2.4" fill="#1a0840"/><circle cx="27.8" cy="33.2" r=".9" fill="#a0c0ff" opacity=".95"/><circle cx="37.8" cy="33.2" r=".9" fill="#a0c0ff" opacity=".95"/><path d="M27 41 Q30 45 32 45 Q34 45 37 41" fill="none" stroke="#8070b0" stroke-width="1.5" stroke-linecap="round"/><path d="M28 44 Q30 47 32 47 Q34 47 36 44" fill="#8060b0" opacity=".5"/><path d="M14 58 L14 46 Q20 36 28 34 L32 50 L36 34 Q44 36 50 46 L50 58 Z" fill="#1a0838"/><path d="M16 58 L16 47 Q22 38 29 36 L32 51 L35 36 Q42 38 48 47 L48 58 Z" fill="#2a1050"/><path d="M32 27 L2 42" stroke="#8060c0" stroke-width="2" stroke-linecap="round" opacity=".8"/><circle cx="2" cy="42" r="3.5" fill="#c0a0f8"/><circle cx="2" cy="42" r="2" fill="#e0d8ff"/><path d="M4 40 Q3 41 4 43" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".7"/><path d="M32 14 L34 21 L28 18 Z" fill="#e8d0ff" opacity=".6"/><circle cx="44" cy="10" r="1.5" fill="#c8a8f8" opacity=".7"/><circle cx="48" cy="18" r="1.2" fill="#c8a8f8" opacity=".5"/><circle cx="14" cy="14" r="1.2" fill="#c8a8f8" opacity=".5"/></svg>';
    else if (name === 'enano') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#1535b5"/><path d="M12 30 Q12 10 32 10 Q52 10 52 30 L50 34 L14 34 Z" fill="#707878"/><path d="M14 28 Q18 12 32 11 Q46 12 50 28" fill="none" stroke="#a0a8a8" stroke-width="1.5" stroke-linecap="round" opacity=".6"/><path d="M12 30 L5 22 Q6 16 10 16 L16 26 Z" fill="#686870"/><path d="M52 30 L59 22 Q58 16 54 16 L48 26 Z" fill="#686870"/><path d="M6 17 Q8 18 13 25" stroke="#a0a0a8" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="M58 17 Q56 18 51 25" stroke="#a0a0a8" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="M18 32 Q18 50 32 52 Q46 50 46 32 Z" fill="#c87840"/><path d="M23 35 Q26 32 29 35" fill="none" stroke="#3a1808" stroke-width="2.2" stroke-linecap="round"/><path d="M35 35 Q38 32 41 35" fill="none" stroke="#3a1808" stroke-width="2.2" stroke-linecap="round"/><circle cx="26.5" cy="37" r="2.5" fill="#1a0800"/><circle cx="37.5" cy="37" r="2.5" fill="#1a0800"/><circle cx="27.2" cy="36.2" r=".9" fill="#fff" opacity=".9"/><circle cx="38.2" cy="36.2" r=".9" fill="#fff" opacity=".9"/><path d="M22 48 Q26 50 32 50 Q38 50 42 48" fill="#9a6030" stroke="#6a3810" stroke-width="1.2" stroke-linecap="round"/><path d="M22 50 Q28 54 32 54 Q36 54 42 50" fill="#8a7050" stroke="#4a3020" stroke-width="1.5" stroke-linecap="round"/><path d="M24 52 Q28 56 32 56 Q36 56 40 52" fill="#c0a878" stroke="#9a8858" stroke-width="1"/><path d="M14 60 L14 48 Q18 40 24 38 Q28 50 32 52 Q36 50 40 38 Q46 40 50 48 L50 60 Z" fill="#3a1808"/><path d="M16 60 L16 49 Q20 42 26 40 L32 53 L38 40 Q44 42 48 49 L48 60 Z" fill="#5a2e10"/><path d="M50 38 L58 28" stroke="#888890" stroke-width="3.5" stroke-linecap="round"/><path d="M52 30 L64 26 L60 36 L54 32 Z" fill="#9898a0"/><path d="M53 31 L62 28" stroke="#c8c8d0" stroke-width="1.2" stroke-linecap="round" opacity=".6"/></svg>';
    else if (name === 'goblin') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#921818"/><path d="M10 30 Q14 20 20 22 L20 30 Z" fill="#2a6a1a"/><path d="M54 30 Q50 20 44 22 L44 30 Z" fill="#2a6a1a"/><path d="M10 30 Q12 22 14 22" stroke="#4a8a28" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="M54 30 Q52 22 50 22" stroke="#4a8a28" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="M18 32 Q18 52 32 54 Q46 52 46 32 Z" fill="#5a9a30"/><path d="M18 32 Q18 20 32 18 Q46 20 46 32 Z" fill="#4a8a28"/><path d="M22 26 Q26 22 30 26" fill="none" stroke="#1a3a08" stroke-width="1.8" stroke-linecap="round"/><path d="M34 26 Q38 22 42 26" fill="none" stroke="#1a3a08" stroke-width="1.8" stroke-linecap="round"/><circle cx="26" cy="28" r="3.5" fill="#e8c000"/><circle cx="38" cy="28" r="3.5" fill="#e8c000"/><circle cx="26" cy="28" r="2" fill="#1a1a00"/><circle cx="38" cy="28" r="2" fill="#1a1a00"/><circle cx="26.7" cy="27.3" r=".8" fill="#fff" opacity=".9"/><circle cx="38.7" cy="27.3" r=".8" fill="#fff" opacity=".9"/><path d="M26 38 Q28 36 29 38 M35 38 Q36 36 38 38" stroke="#1a3a08" stroke-width="1.5" stroke-linecap="round"/><path d="M26 42 L28 46 L30 42 L32 47 L34 42 L36 46 L38 42" fill="none" stroke="#f0f0d0" stroke-width="1.2" stroke-linecap="round" opacity=".9"/><path d="M14 58 L14 46 Q18 36 26 34 L32 52 L38 34 Q46 36 50 46 L50 58 Z" fill="#1a3a0a"/><path d="M16 58 L16 47 Q20 38 28 36 L32 53 L36 36 Q44 38 48 47 L48 58 Z" fill="#2a5018"/><path d="M7 40 L15 34" stroke="#4a3820" stroke-width="2.5" stroke-linecap="round"/><path d="M4 34 Q3 38 6 40 L12 34 L7 30 Q4 30 4 34 Z" fill="#8a8060"/><path d="M4.5 34 Q4 37 6 39" stroke="#c0b888" stroke-width="1" stroke-linecap="round" opacity=".6"/></svg>';
    else if (name === 'esqueleto') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#921818"/><path d="M16 30 Q16 8 32 8 Q48 8 48 30 Z" fill="#e8eaf0"/><path d="M18 28 Q20 10 32 9 Q44 10 46 28" fill="none" stroke="#fff" stroke-width="1.5" opacity=".5"/><path d="M16 30 Q16 52 32 54 Q48 52 48 30 Z" fill="#eceef4"/><circle cx="26" cy="25" r="5" fill="#1a1c22"/><circle cx="38" cy="25" r="5" fill="#1a1c22"/><circle cx="26" cy="25" r="3.5" fill="#3080e0" opacity=".8"/><circle cx="38" cy="25" r="3.5" fill="#3080e0" opacity=".8"/><circle cx="27" cy="24" r="1.2" fill="#90d0ff" opacity=".9"/><circle cx="39" cy="24" r="1.2" fill="#90d0ff" opacity=".9"/><path d="M28 12 Q32 8 36 12" fill="none" stroke="#c0c2c8" stroke-width="2" stroke-linecap="round" opacity=".7"/><path d="M20 18 Q22 16 24 18" fill="none" stroke="#c0c2c8" stroke-width="1.5" stroke-linecap="round" opacity=".6"/><path d="M40 18 Q42 16 44 18" fill="none" stroke="#c0c2c8" stroke-width="1.5" stroke-linecap="round" opacity=".6"/><path d="M26 34 L28 38 L30 34 L32 40 L34 34 L36 38 L38 34" fill="none" stroke="#707280" stroke-width="1.5" stroke-linecap="round" opacity=".9"/><path d="M26 42 Q30 45 32 45 Q34 45 38 42" fill="none" stroke="#707280" stroke-width="1.5" stroke-linecap="round"/><path d="M14 58 L14 44 Q20 36 26 34 L32 52 L38 34 Q44 36 50 44 L50 58 Z" fill="#d0d2d8"/><path d="M26 44 L26 58M38 44 L38 58M32 48 L32 58" stroke="#909298" stroke-width="2" stroke-linecap="round" opacity=".7"/><path d="M8 42 L16 34" stroke="#c0c2c8" stroke-width="3" stroke-linecap="round" opacity=".9"/><path d="M4 34 Q3 40 7 42 L14 36 L9 30 Q5 30 4 34 Z" fill="#c8cad0"/><path d="M5 34 Q4 39 7 41" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".55"/></svg>';
    else if (name === 'orco') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#921818"/><path d="M12 28 Q12 8 32 8 Q52 8 52 28 L50 34 L14 34 Z" fill="#3a4838"/><path d="M14 26 Q18 10 32 9 Q46 10 50 26" fill="none" stroke="#5a6850" stroke-width="1.5" opacity=".65"/><path d="M12 28 L4 20 Q6 12 12 14 L16 26 Z" fill="#484838"/><path d="M52 28 L60 20 Q58 12 52 14 L48 26 Z" fill="#484838"/><path d="M5 14 Q8 16 13 24" stroke="#6a7860" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="M59 14 Q56 16 51 24" stroke="#6a7860" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="M16 30 Q16 52 32 54 Q48 52 48 30 Z" fill="#7a9a50"/><path d="M22 33 Q25 30 28 33" fill="none" stroke="#2a1808" stroke-width="2.5" stroke-linecap="round"/><path d="M36 33 Q39 30 42 33" fill="none" stroke="#2a1808" stroke-width="2.5" stroke-linecap="round"/><circle cx="25.5" cy="35.5" r="3" fill="#1a0800"/><circle cx="38.5" cy="35.5" r="3" fill="#1a0800"/><circle cx="26.3" cy="34.8" r="1" fill="#ff4040" opacity=".9"/><circle cx="39.3" cy="34.8" r="1" fill="#ff4040" opacity=".9"/><path d="M28 44 L27 50" stroke="#e0d8b0" stroke-width="2.5" stroke-linecap="round"/><path d="M36 44 L37 50" stroke="#e0d8b0" stroke-width="2.5" stroke-linecap="round"/><path d="M26 42 Q30 47 32 47 Q34 47 38 42" fill="#5a1010" stroke="#3a0808" stroke-width="1"/><path d="M14 58 L14 46 Q18 38 24 36 L32 52 L40 36 Q46 38 50 46 L50 58 Z" fill="#2a1808"/><path d="M16 58 L16 47 Q20 40 26 38 L32 53 L38 38 Q44 40 48 47 L48 58 Z" fill="#3a3828"/><path d="M7 52 L16 40" stroke="#5a3828" stroke-width="3.5" stroke-linecap="round"/><path d="M3 38 Q2 45 7 47 L14 40 L8 34 Q3 33 3 38 Z" fill="#787870"/><path d="M3.5 38 Q3 43 7 46" stroke="#b0b0a8" stroke-width="1.2" stroke-linecap="round" opacity=".65"/></svg>';
    else if (name === 'caos') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#921818"/><path d="M12 28 Q12 8 32 8 Q52 8 52 28 L50 34 L14 34 Z" fill="#181424"/><path d="M14 26 Q18 10 32 9 Q46 10 50 26" fill="none" stroke="#4a3868" stroke-width="1.5" opacity=".65"/><path d="M12 28 L4 18 Q7 10 14 12 L16 28 Z" fill="#201828"/><path d="M52 28 L60 18 Q57 10 50 12 L48 28 Z" fill="#201828"/><path d="M16 30 Q16 52 32 54 Q48 52 48 30 Z" fill="#383040"/><path d="M22 32 Q26 28 30 32" fill="#383040" stroke="#0a0818" stroke-width="2.5" stroke-linecap="round"/><path d="M34 32 Q38 28 42 32" fill="#383040" stroke="#0a0818" stroke-width="2.5" stroke-linecap="round"/><circle cx="26" cy="34" r="3" fill="#060410"/><circle cx="38" cy="34" r="3" fill="#060410"/><circle cx="26" cy="34" r="2" fill="#c050ff" opacity=".9"/><circle cx="38" cy="34" r="2" fill="#c050ff" opacity=".9"/><circle cx="26.8" cy="33.2" r=".8" fill="#f0b0ff" opacity=".9"/><circle cx="38.8" cy="33.2" r=".8" fill="#f0b0ff" opacity=".9"/><path d="M24 42 Q28 47 32 47 Q36 47 40 42" fill="#1a1020" stroke="#120a18" stroke-width="1"/><path d="M26 44 Q30 48 32 48 Q34 48 38 44" fill="none" stroke="#c050ff" stroke-width="1" stroke-linecap="round" opacity=".7"/><path d="M14 58 L14 46 Q18 36 26 34 L32 52 L38 34 Q46 36 50 46 L50 58 Z" fill="#0e0c18"/><path d="M16 58 L16 47 Q20 38 28 36 L32 53 L36 36 Q44 38 48 47 L48 58 Z" fill="#181428"/><path d="M21 38 L23 30 M29 38 L29 30 M37 38 L35 30 M43 38 L41 30" stroke="#8040c0" stroke-width="1" stroke-linecap="round" opacity=".7"/><path d="M20 38 Q24 42 28 38 Q32 34 36 38 Q40 42 44 38" fill="none" stroke="#6030a0" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="M7 52 L16 40" stroke="#281838" stroke-width="3.5" stroke-linecap="round"/><path d="M3 38 Q2 46 8 48 L15 40 L8 33 Q3 32 3 38 Z" fill="#404048"/><path d="M4 38 L24 34 M4 44 L24 40" stroke="#8040c0" stroke-width=".8" stroke-linecap="round" opacity=".5"/></svg>';
    else if (name === 'jefe') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#8a1010"/><circle cx="32" cy="32" r="27" fill="none" stroke="#e0a810" stroke-width="2.2"/><path d="M20 10 L24 20 L32 8 L40 20 L44 10 L42 22 L38 18 L32 24 L26 18 L22 22 Z" fill="#e0a810"/><path d="M21 11 Q26 14 24 21" stroke="#f8d040" stroke-width="1" stroke-linecap="round" opacity=".6"/><path d="M43 11 Q38 14 40 21" stroke="#f8d040" stroke-width="1" stroke-linecap="round" opacity=".6"/><path d="M12 28 Q12 8 32 8 Q52 8 52 28 L50 34 L14 34 Z" fill="#303038"/><path d="M14 26 Q18 10 32 9 Q46 10 50 26" fill="none" stroke="#606068" stroke-width="1.5" opacity=".55"/><path d="M12 28 L3 18 Q6 8 14 10 L16 28 Z" fill="#2a2830"/><path d="M52 28 L61 18 Q58 8 50 10 L48 28 Z" fill="#2a2830"/><path d="M4 10 Q8 12 13 24" stroke="#585060" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="M60 10 Q56 12 51 24" stroke="#585060" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="M16 30 Q16 52 32 54 Q48 52 48 30 Z" fill="#b05030"/><path d="M20 32 Q24 28 28 32" fill="#b05030" stroke="#200808" stroke-width="2.5" stroke-linecap="round"/><path d="M36 32 Q40 28 44 32" fill="#b05030" stroke="#200808" stroke-width="2.5" stroke-linecap="round"/><circle cx="24.5" cy="34.5" r="3.5" fill="#040000"/><circle cx="39.5" cy="34.5" r="3.5" fill="#040000"/><circle cx="24.5" cy="34.5" r="2.2" fill="#ff6000" opacity=".95"/><circle cx="39.5" cy="34.5" r="2.2" fill="#ff6000" opacity=".95"/><circle cx="25.3" cy="33.7" r=".9" fill="#ffcc40" opacity=".9"/><circle cx="40.3" cy="33.7" r=".9" fill="#ffcc40" opacity=".9"/><path d="M22 44 Q27 50 32 50 Q37 50 42 44" fill="#3a0808" stroke="#280808" stroke-width="1.2"/><path d="M24 46 L26 50 L28 46 L30 51 L32 47 L34 51 L36 46 L38 50 L40 46" fill="none" stroke="#e0d0b0" stroke-width="1.2" stroke-linecap="round" opacity=".8"/><path d="M12 58 L12 46 Q16 36 24 34 L32 52 L40 34 Q48 36 52 46 L52 58 Z" fill="#280808"/><path d="M14 58 L14 47 Q18 38 26 36 L32 53 L38 36 Q46 38 50 47 L50 58 Z" fill="#3a1010"/><path d="M6 52 L16 40" stroke="#3a2010" stroke-width="3.5" stroke-linecap="round"/><path d="M2 37 Q1 46 7 48 L15 40 L8 32 Q2 31 2 37 Z" fill="#686060"/><path d="M2.5 37 Q2 44 7 47" stroke="#b0a8a0" stroke-width="1.2" stroke-linecap="round" opacity=".65"/><path d="M58 52 L48 40" stroke="#3a2010" stroke-width="3.5" stroke-linecap="round"/><path d="M62 37 Q63 46 57 48 L49 40 L56 32 Q62 31 62 37 Z" fill="#686060"/><path d="M61.5 37 Q62 44 57 47" stroke="#b0a8a0" stroke-width="1.2" stroke-linecap="round" opacity=".65"/></svg>';
    else if (name === 'troll') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#921818"/><path d="M10 28 Q10 8 32 8 Q54 8 54 28 L52 34 L12 34 Z" fill="#708040"/><path d="M9 22 L14 10 L19 26 Z" fill="#607030"/><path d="M55 22 L50 10 L45 26 Z" fill="#607030"/><path d="M10 7 Q13 12 17 24" stroke="#a0b050" stroke-width="1.2" stroke-linecap="round" opacity=".5"/><path d="M54 7 Q51 12 47 24" stroke="#a0b050" stroke-width="1.2" stroke-linecap="round" opacity=".5"/><path d="M12 30 Q12 52 32 54 Q52 52 52 30 Z" fill="#8a9a50"/><circle cx="24" cy="27" r="5" fill="#1a1a00"/><circle cx="40" cy="27" r="5" fill="#1a1a00"/><circle cx="24" cy="27" r="3.2" fill="#e8c000"/><circle cx="40" cy="27" r="3.2" fill="#e8c000"/><circle cx="23.5" cy="26.5" r="1" fill="#fff" opacity=".8"/><circle cx="39.5" cy="26.5" r="1" fill="#fff" opacity=".8"/><ellipse cx="32" cy="36" rx="5.5" ry="3.5" fill="#607030"/><circle cx="30" cy="36" r="1.5" fill="#1a1a00"/><circle cx="34" cy="36" r="1.5" fill="#1a1a00"/><path d="M24 44 L20 56" stroke="#e8d8a0" stroke-width="3.5" stroke-linecap="round"/><path d="M40 44 L44 56" stroke="#e8d8a0" stroke-width="3.5" stroke-linecap="round"/><path d="M14 60 L14 46 Q18 38 24 36 L32 52 L40 36 Q46 38 50 46 L50 60 Z" fill="#4a5820"/><path d="M16 60 L16 47 Q20 40 26 38 L32 53 L38 38 Q44 40 48 47 L48 60 Z" fill="#5a6e28"/></svg>';
    else if (name === 'arana') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#921818"/><path d="M22 28 Q14 22 7 26" stroke="#1a0808" stroke-width="3" stroke-linecap="round"/><path d="M22 31 Q12 30 7 36" stroke="#1a0808" stroke-width="2.5" stroke-linecap="round"/><path d="M22 34 Q14 38 10 44" stroke="#1a0808" stroke-width="2" stroke-linecap="round"/><path d="M22 37 Q17 43 15 50" stroke="#1a0808" stroke-width="2" stroke-linecap="round"/><path d="M42 28 Q50 22 57 26" stroke="#1a0808" stroke-width="3" stroke-linecap="round"/><path d="M42 31 Q52 30 57 36" stroke="#1a0808" stroke-width="2.5" stroke-linecap="round"/><path d="M42 34 Q50 38 54 44" stroke="#1a0808" stroke-width="2" stroke-linecap="round"/><path d="M42 37 Q47 43 49 50" stroke="#1a0808" stroke-width="2" stroke-linecap="round"/><ellipse cx="32" cy="30" rx="11" ry="9" fill="#280808"/><ellipse cx="32" cy="44" rx="13" ry="11" fill="#1a0404"/><circle cx="25" cy="25" r="3" fill="#ff2000"/><circle cx="31" cy="23" r="3" fill="#ff2000"/><circle cx="37" cy="23" r="3" fill="#ff2000"/><circle cx="39" cy="25" r="2.5" fill="#ff3000"/><circle cx="26.5" cy="29" r="1.8" fill="#ff5000" opacity=".8"/><circle cx="37.5" cy="29" r="1.8" fill="#ff5000" opacity=".8"/><circle cx="25.5" cy="24.5" r="1" fill="#ffb080" opacity=".9"/><circle cx="37.5" cy="23.5" r="1" fill="#ffb080" opacity=".9"/><path d="M27 35 L25 43" stroke="#d0d0c0" stroke-width="2.5" stroke-linecap="round"/><path d="M37 35 L39 43" stroke="#d0d0c0" stroke-width="2.5" stroke-linecap="round"/><path d="M32 8 L32 21" stroke="#808060" stroke-width="1.2" stroke-linecap="round" opacity=".4"/><path d="M20 12 Q26 16 32 21" stroke="#808060" stroke-width=".9" stroke-linecap="round" opacity=".3"/><path d="M44 12 Q38 16 32 21" stroke="#808060" stroke-width=".9" stroke-linecap="round" opacity=".3"/></svg>';
    else if (name === 'licantropo') svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#921818"/><path d="M14 28 Q14 8 32 8 Q50 8 50 28 L48 34 L16 34 Z" fill="#4a3820"/><path d="M14 20 L9 7 L20 18 Z" fill="#6a5030"/><path d="M50 20 L55 7 L44 18 Z" fill="#6a5030"/><path d="M14.5 19 L10.5 8 L19.5 18 Z" fill="#a07858" opacity=".5"/><path d="M49.5 19 L53.5 8 L44.5 18 Z" fill="#a07858" opacity=".5"/><path d="M16 30 Q16 52 32 54 Q48 52 48 30 Z" fill="#5a4228"/><ellipse cx="32" cy="38" rx="8" ry="5.5" fill="#3a2818"/><circle cx="30" cy="37" r="2" fill="#1a0808"/><circle cx="34" cy="37" r="2" fill="#1a0808"/><circle cx="24" cy="27" r="4.5" fill="#0a0800"/><circle cx="40" cy="27" r="4.5" fill="#0a0800"/><circle cx="24" cy="27" r="3" fill="#e8a800"/><circle cx="40" cy="27" r="3" fill="#e8a800"/><circle cx="24.8" cy="26.2" r="1" fill="#fff" opacity=".9"/><circle cx="40.8" cy="26.2" r="1" fill="#fff" opacity=".9"/><path d="M25 42 L23 52" stroke="#f0ead8" stroke-width="3" stroke-linecap="round"/><path d="M39 42 L41 52" stroke="#f0ead8" stroke-width="3" stroke-linecap="round"/><path d="M27 44 Q32 49 37 44" fill="none" stroke="#2a1408" stroke-width="1.5" stroke-linecap="round"/><path d="M14 60 L14 46 Q20 38 26 36 L32 52 L38 36 Q44 38 50 46 L50 60 Z" fill="#3a2818"/><path d="M16 60 L16 47 Q22 40 28 38 L32 53 L36 38 Q42 40 48 47 L48 60 Z" fill="#4a3824"/><path d="M7 52 L16 40" stroke="#4a3018" stroke-width="3.5" stroke-linecap="round"/><path d="M3 38 Q2 46 7 48 L15 40 L8 33 Q3 32 3 38 Z" fill="#6a5030"/><path d="M4 36 L7 40 M4 41 L8 44 M5 46 L9 49" stroke="#e0d0b0" stroke-width="1.2" stroke-linecap="round" opacity=".8"/></svg>';
    else svg = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="currentColor"/></svg>';
    return (_iconSvgCache[cacheKey] = '<span class="svg-icon svg-' + name + cls + '">' + svg + '</span>');
  }

  function heroIconForId(id) {
    if (id === 'barbaro') return iconSvg('barbaro', 'entity-icon');
    if (id === 'arquero') return iconSvg('arquero', 'entity-icon');
    if (id === 'mago') return iconSvg('mago', 'entity-icon');
    if (id === 'enano') return iconSvg('enano', 'entity-icon');
    return iconSvg('hero', 'entity-icon');
  }

  function enemyIconForType(type, boss) {
    if (boss) return iconSvg('jefe', 'entity-icon');
    if (type === 'goblin') return iconSvg('goblin', 'entity-icon');
    if (type === 'esqueleto') return iconSvg('esqueleto', 'entity-icon');
    if (type === 'orco') return iconSvg('orco', 'entity-icon');
    if (type === 'caos') return iconSvg('caos', 'entity-icon');
    if (type === 'troll') return iconSvg('troll', 'entity-icon');
    if (type === 'arana') return iconSvg('arana', 'entity-icon');
    if (type === 'licantropo') return iconSvg('licantropo', 'entity-icon');
    return iconSvg('enemy', 'entity-icon');
  }


  function heroFlavorForId(id) {
    if (id === 'barbaro') return 'Primera línea · alto impacto';
    if (id === 'arquero') return 'Ataque a distancia · movilidad';
    if (id === 'mago') return 'Control arcano · frágil';
    if (id === 'enano') return 'Defensa sólida · avance seguro';
    return 'Aventurero';
  }

  function enemyDisplayName(type, boss) {
    if (boss) return 'Jefe del caos';
    if (type === 'goblin') return 'Goblin';
    if (type === 'esqueleto') return 'Esqueleto';
    if (type === 'orco') return 'Orco';
    if (type === 'caos') return 'Guerrero del caos';
    if (type === 'troll') return 'Troll';
    if (type === 'arana') return 'Araña venenosa';
    if (type === 'licantropo') return 'Licántropo';
    return 'Enemigo';
  }

  function updateActiveHeroCard() {
    if (!activeHeroCardEl) return;
    if (!current || !current.heroes || !current.heroes.length) {
      activeHeroCardEl.innerHTML = '<div class="hero-card-empty">Sin partida activa.</div>';
      return;
    }
    var hero = ensureSelectedHero();
    if (!hero) {
      activeHeroCardEl.innerHTML = '<div class="hero-card-empty">Sin héroe activo.</div>';
      return;
    }
    var heroType = hero.id.split('_')[0];
    var hpPct = Math.max(0, Math.min(100, Math.round((hero.hp / Math.max(1, hero.maxHp || hero.hp)) * 100)));
    var moveLeft = (current.turn && current.turn.movePoints) || 0;
    var attacked = !!(current.turn && current.turn.attacked);
    var rolled = !!(current.turn && current.turn.rolled);
    var abilityLabel = heroAbilityLabel(heroType);
    activeHeroCardEl.innerHTML =
      '<div class="hero-card hero-' + heroType + '">' +
        '<div class="hero-card-head">' +
          '<div class="hero-card-icon hero-icon-' + heroType + '">' + heroIconForId(heroType) + '</div>' +
          '<div class="hero-card-title">' +
            '<div class="hero-card-name">' + escapeHtml(heroDisplayName(hero)) + '</div>' +
          '</div>' +
          '<div class="hero-card-turn-badges">' +
            (rolled ? '<span class="turn-badge move' + (moveLeft <= 0 ? ' spent' : '') + '">⚡ ' + moveLeft + '</span>' : '<span class="turn-badge idle">⚡ —</span>') +
            '<span class="turn-badge atk' + (attacked ? ' spent' : '') + '">' + (attacked ? '⚔ ✓' : '⚔') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="hero-life">' +
          '<div class="hero-life-label"><span>Vida</span><span>' + hero.hp + '/' + (hero.maxHp || hero.hp) + '</span></div>' +
          '<div class="hero-life-bar"><div class="hero-life-fill" style="width:' + hpPct + '%"></div></div>' +
        '</div>' +
        '<div class="hero-stats-grid">' +
          '<div class="hero-stat"><span class="k">ATQ</span><span class="v">' + getHeroAttack(hero) + '</span></div>' +
          '<div class="hero-stat"><span class="k">DEF</span><span class="v">' + getHeroDefense(hero) + '</span></div>' +
          '<div class="hero-stat"><span class="k">MOV</span><span class="v">' + moveLeft + '</span></div>' +
          '<div class="hero-stat"><span class="k">ALC</span><span class="v">' + getHeroRange(hero) + '</span></div>' +
        '</div>' +
        (hero.effects && hero.effects.length ? heroActiveEffectsHtml(hero) : '') +
        '<div class="hero-ability-row"><span class="hero-ability-label">✦ ' + escapeHtml(abilityLabel) + '</span></div>' +
        (current.lastActionMsg ? '<div class="last-action-msg">' + escapeHtml(current.lastActionMsg) + '</div>' : '') +
        heroInventoryActionsHtml(hero) +
      '</div>';
  }

  function updateCharacterRoster() {
    if (!characterRosterEl) return;
    if (!current || ((!current.heroes || !current.heroes.length) && (!current.enemies || !current.enemies.length))) {
      characterRosterEl.innerHTML = '<div class="character-roster-empty">Genera una partida para ver a todos los personajes.</div>';
      return;
    }

    var selectedHero = ensureSelectedHero();
    var heroHtml = (current.heroes || []).map(function (hero) {
      var heroType = hero.id.split('_')[0];
      var hpPct = Math.max(0, Math.min(100, Math.round((hero.hp / Math.max(1, hero.maxHp || hero.hp)) * 100)));
      var selectedClass = selectedHero && selectedHero.id === hero.id ? ' is-selected' : '';
      return '' +
        '<div class="mini-unit hero-mini hero-mini-' + heroType + selectedClass + '">' +
          '<div class="mini-unit-icon hero-icon-' + heroType + '">' + heroIconForId(heroType) + '</div>' +
          '<div class="mini-unit-body">' +
            '<div class="mini-unit-top"><span class="mini-unit-name">' + escapeHtml(heroDisplayName(hero)) + '</span><span class="mini-unit-tag">Héroe</span></div>' +
            '<div class="mini-unit-sub">' + heroFlavorForId(heroType) + '</div>' +
            '<div class="mini-unit-bar"><span style="width:' + hpPct + '%"></span></div>' +
            '<div class="mini-unit-stats"><span>PV ' + hero.hp + '/' + hero.maxHp + '</span><span>ATQ ' + getHeroAttack(hero) + '</span><span>DEF ' + getHeroDefense(hero) + '</span><span>ALC ' + getHeroRange(hero) + '</span></div>' +
          '</div>' +
        '</div>';
    }).join('');

    var counts = { goblin: 0, esqueleto: 0, orco: 0, caos: 0, troll: 0, arana: 0, licantropo: 0, boss: 0 };
    (current.enemies || []).forEach(function (enemy) {
      if (enemy.boss) counts.boss++;
      else if (counts[enemy.type] !== undefined) counts[enemy.type]++;
    });

    var enemyOrder = [
      { key: 'goblin', type: 'goblin', boss: false },
      { key: 'esqueleto', type: 'esqueleto', boss: false },
      { key: 'orco', type: 'orco', boss: false },
      { key: 'caos', type: 'caos', boss: false },
      { key: 'troll', type: 'troll', boss: false },
      { key: 'arana', type: 'arana', boss: false },
      { key: 'licantropo', type: 'licantropo', boss: false },
      { key: 'boss', type: 'caos', boss: true }
    ];

    var enemyHtml = enemyOrder.filter(function (item) { return counts[item.key] > 0; }).map(function (item) {
      return '' +
        '<div class="mini-unit enemy-mini enemy-mini-' + item.key + '">' +
          '<div class="mini-unit-icon enemy-icon-' + item.key + '">' + enemyIconForType(item.type, item.boss) + '</div>' +
          '<div class="mini-unit-body">' +
            '<div class="mini-unit-top"><span class="mini-unit-name">' + enemyDisplayName(item.type, item.boss) + '</span><span class="mini-unit-tag">x' + counts[item.key] + '</span></div>' +
            '<div class="mini-unit-sub">' + (item.boss ? 'Amenaza principal de la sala final' : (item.key === 'troll' ? 'Regenera PV · defensa brutal' : (item.key === 'arana' ? 'Veloz · veneno al impactar' : (item.key === 'licantropo' ? 'Furia bestial al debilitarse' : 'Hostil activo en la mazmorra')))) + '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    characterRosterEl.innerHTML =
      '<div class="roster-block">' +
        '<div class="roster-title">Héroes en juego</div>' +
        '<div class="mini-unit-list">' + (heroHtml || '<div class="character-roster-empty">No hay héroes activos.</div>') + '</div>' +
      '</div>' +
      '<div class="roster-block">' +
        '<div class="roster-title">Amenazas visibles del escenario</div>' +
        '<div class="mini-unit-list enemy-list">' + (enemyHtml || '<div class="character-roster-empty">No hay enemigos vivos.</div>') + '</div>' +
      '</div>';
  }


  function enemyOffsetClass(x, y, unit) {
    if (!unit || (!unit.type && !unit.boss)) return '';
    var seed = (x * 17 + y * 31 + ((unit.type || '').length * 13) + (unit.boss ? 7 : 0)) % 8;
    return ' has-enemy enemy-offset-' + (seed + 1);
  }

  function unitDisplayName(unit) {
    if (!unit) return '';
    if (unit.boss) return 'Jefe';
    if (unit.type) return enemyDisplayName(unit.type, false);
    return heroDisplayName(unit);
  }

  function randomInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function randomChoice(rng, list) {
    if (!list || !list.length) return null;
    return list[randomInt(rng, 0, list.length - 1)];
  }

  function weightedChoice(rng, entries) {
    if (!entries || !entries.length) return null;
    var total = 0;
    for (var i = 0; i < entries.length; i++) total += Math.max(0, entries[i].weight || 0);
    if (total <= 0) return entries[0] || null;
    var roll = rng() * total;
    var acc = 0;
    for (var j = 0; j < entries.length; j++) {
      acc += Math.max(0, entries[j].weight || 0);
      if (roll <= acc) return entries[j];
    }
    return entries[entries.length - 1] || null;
  }

  function createInventoryState() {
    return {
      gold: 1000,
      potions: [],
      scrolls: [],
      keys: [],
      equipment: [],
      specials: [],
      trapsTriggered: 0,
      openedChestRewards: []
    };
  }

  function inventoryBuckets() {
    return [
      { key:'potions', label:'Pociones' },
      { key:'scrolls', label:'Pergaminos' },
      { key:'keys', label:'Llaves' },
      { key:'equipment', label:'Equipo' },
      { key:'specials', label:'Especiales' }
    ];
  }

  function createHeroInventory() {
    return {
      potions: [],
      scrolls: [],
      keys: [],
      specials: [],
      backpack: []
    };
  }

  function createHeroEquipment() {
    return {
      weapon: null,
      shield: null,
      armor: null,
      helmet: null,
      accessory: null
    };
  }

  function effectLabel(effect) {
    if (!effect) return '';
    if (effect.effect === 'buff_attack') return '+' + effect.value + ' ATQ';
    if (effect.effect === 'buff_defense') return '+' + effect.value + ' DEF';
    if (effect.effect === 'buff_range') return '+' + effect.value + ' ALC';
    return effect.label || effect.effect || '';
  }

  function equipmentLabel(item) {
    if (!item) return '—';
    var bits = [item.name || item.id || 'Equipo'];
    if (item.attackBonus) bits.push('+' + item.attackBonus + ' ATQ');
    if (item.defenseBonus) bits.push('+' + item.defenseBonus + ' DEF');
    if (item.rangeBonus) bits.push('+' + item.rangeBonus + ' ALC');
    return bits.join(' · ');
  }

  function heroActiveEffectsHtml(hero) {
    if (!hero || !hero.effects || !hero.effects.length) return '';
    var icons = { buff_attack:'⚔', buff_defense:'🛡', buff_range:'🏹' };
    var chips = hero.effects.map(function(e) {
      var icon = icons[e.effect] || '✨';
      return '<span class="effect-chip">' + icon + ' ' + escapeHtml(effectLabel(e)) + ' · ' + e.duration + 't</span>';
    }).join('');
    return '<div class="active-effects-row">' + chips + '</div>';
  }

  function heroInventoryActionsHtml(hero) {
    if (!hero) return '';
    var inv = hero.inventory || {};
    var equip = hero.equipment || {};
    var potions = inv.potions || [];
    var scrolls = inv.scrolls || [];
    var keys = inv.keys || [];
    var specials = inv.specials || [];

    var hasAnything = potions.length || scrolls.length || keys.length || specials.length ||
      equip.weapon || equip.shield || equip.armor || equip.helmet || equip.accessory;

    var html = '<div class="inv-panel">';
    html += '<div class="inv-panel-title">🎒 Inventario</div>';

    // Equipo equipado
    var equipSlots = [
      { key:'weapon', label:'⚔ Arma' },
      { key:'shield', label:'🛡 Escudo' },
      { key:'armor', label:'🥋 Armadura' },
      { key:'helmet', label:'⛑ Casco' },
      { key:'accessory', label:'💍 Accesorio' }
    ];
    var equippedRows = equipSlots.filter(function(s) { return equip[s.key]; }).map(function(s) {
      var item = equip[s.key];
      var bonuses = [];
      if (item.attackBonus) bonuses.push('+' + item.attackBonus + ' ATQ');
      if (item.defenseBonus) bonuses.push('+' + item.defenseBonus + ' DEF');
      if (item.rangeBonus) bonuses.push('+' + item.rangeBonus + ' ALC');
      return '<div class="inv-item inv-item-equipped">' +
        '<span class="inv-item-slot">' + s.label + '</span>' +
        '<span class="inv-item-name">' + escapeHtml(item.name) + '</span>' +
        (bonuses.length ? '<span class="inv-item-bonus">' + bonuses.join(' ') + '</span>' : '') +
        '<button class="inv-use-btn inv-btn-unequip" data-hero="' + hero.id + '" data-type="unequip" data-slot="' + s.key + '">Quitar</button>' +
      '</div>';
    });
    html += '<div class="inv-section"><div class="inv-section-title">Equipo</div>';
    if (equippedRows.length) {
      html += equippedRows.join('');
    } else {
      html += '<div class="inv-empty-msg">Sin equipo equipado</div>';
    }
    html += '</div>';

    // Mochila (equipo sin equipar)
    var backpack = inv.backpack || [];
    if (backpack.length) {
      html += '<div class="inv-section"><div class="inv-section-title">🎒 Mochila</div>';
      backpack.forEach(function(item, i) {
        var bonuses = [];
        if (item.attackBonus) bonuses.push('+' + item.attackBonus + ' ATQ');
        if (item.defenseBonus) bonuses.push('+' + item.defenseBonus + ' DEF');
        if (item.rangeBonus) bonuses.push('+' + item.rangeBonus + ' ALC');
        html += '<div class="inv-item">' +
          '<span class="inv-item-name">' + escapeHtml(item.name) + '</span>' +
          (bonuses.length ? '<span class="inv-item-bonus">' + bonuses.join(' ') + '</span>' : '') +
          '<button class="inv-use-btn inv-btn-equip" data-hero="' + hero.id + '" data-type="equip" data-index="' + i + '">Equipar</button>' +
        '</div>';
      });
      html += '</div>';
    }

    // Consumibles
    html += '<div class="inv-section"><div class="inv-section-title">Consumibles</div>';
    if (!potions.length && !scrolls.length) {
      html += '<div class="inv-empty-msg">Sin pociones ni pergaminos</div>';
    }
    potions.forEach(function(p, i) {
      var effect = p.effect === 'heal' ? '❤ +' + (p.value||2) + ' PV' :
        p.effect === 'buff_attack' ? '⚔ +' + (p.value||1) + ' ATQ · ' + (p.duration||2) + 't' :
        p.effect === 'buff_defense' ? '🛡 +' + (p.value||1) + ' DEF · ' + (p.duration||2) + 't' :
        p.effect === 'buff_range' ? '🏹 +' + (p.value||1) + ' ALC · ' + (p.duration||2) + 't' : '';
      html += '<div class="inv-item">' +
        '<span class="inv-item-name">' + escapeHtml(p.name) + '</span>' +
        (effect ? '<span class="inv-item-bonus">' + effect + '</span>' : '') +
        '<button class="inv-use-btn inv-btn-use" data-hero="' + hero.id + '" data-type="potion" data-index="' + i + '">Usar</button>' +
      '</div>';
    });
    scrolls.forEach(function(s, i) {
      var effect = s.effect === 'damage' ? '💥 -' + (s.value||2) + ' a enemigos' :
        s.effect === 'heal' ? '❤ +' + (s.value||2) + ' PV' :
        s.effect === 'buff_defense' ? '🛡 +' + (s.value||2) + ' DEF · ' + (s.duration||1) + 't' : '✨ Efecto especial';
      html += '<div class="inv-item">' +
        '<span class="inv-item-name">' + escapeHtml(s.name) + '</span>' +
        '<span class="inv-item-bonus">' + effect + '</span>' +
        '<button class="inv-use-btn inv-btn-use" data-hero="' + hero.id + '" data-type="scroll" data-index="' + i + '">Usar</button>' +
      '</div>';
    });
    html += '</div>';

    // Llaves
    if (keys.length) {
      html += '<div class="inv-section"><div class="inv-section-title">Llaves</div>';
      keys.forEach(function(k) {
        html += '<div class="inv-item inv-item-passive"><span class="inv-item-name">🗝 ' + escapeHtml(k.name || k) + '</span></div>';
      });
      html += '</div>';
    }

    // Especiales
    if (specials.length) {
      html += '<div class="inv-section"><div class="inv-section-title">Especiales</div>';
      specials.forEach(function(sp) {
        html += '<div class="inv-item inv-item-passive"><span class="inv-item-name">✨ ' + escapeHtml(sp.name || sp) + '</span></div>';
      });
      html += '</div>';
    }

    // Objetos de equipo sin equipar (guardados en el array global pero no en slots)
    // Los objetos de equipo se equipan automáticamente al recogerlos, así que no hay pendientes

    html += '</div>';
    return html;
  }

  function heroEquipmentSummary(hero) {
    if (!hero || !hero.equipment) return '<span class="muted">Sin equipo</span>';
    var rows = [];
    if (hero.equipment.weapon) rows.push('Arma: ' + equipmentLabel(hero.equipment.weapon));
    if (hero.equipment.shield) rows.push('Escudo: ' + equipmentLabel(hero.equipment.shield));
    if (hero.equipment.armor) rows.push('Armadura: ' + equipmentLabel(hero.equipment.armor));
    if (hero.equipment.helmet) rows.push('Casco: ' + equipmentLabel(hero.equipment.helmet));
    if (hero.equipment.accessory) rows.push('Accesorio: ' + equipmentLabel(hero.equipment.accessory));
    if (!rows.length) return '<span class="muted">Sin equipo</span>';
    return rows.map(function (row) { return '<span class="loot-chip">' + escapeHtml(row) + '</span>'; }).join(' ');
  }

  function heroEffectsSummary(hero) {
    if (!hero || !hero.effects || !hero.effects.length) return '<span class="muted">Sin efectos</span>';
    return hero.effects.map(function (effect) {
      return '<span class="loot-chip">' + escapeHtml(effectLabel(effect)) + ' · ' + (effect.duration || 1) + ' turno(s)</span>';
    }).join(' ');
  }

  function itemArticle(name) {
    return /^[AEIOUÁÉÍÓÚ]/i.test(name || '') ? 'una' : 'un';
  }

  // ── Performance: item catalog at module level (was rebuilt on every makeItemDefinition call) ──
  var _ITEM_CATALOG = {
      // ── Armas ──
      'Daga afilada':       { type:'weapon', slot:'weapon', attackBonus:1 },
      'Daga envenenada':    { type:'weapon', slot:'weapon', attackBonus:1 },
      'Espada corta':       { type:'weapon', slot:'weapon', attackBonus:1 },
      'Espada larga':       { type:'weapon', slot:'weapon', attackBonus:2 },
      'Espada ancha':       { type:'weapon', slot:'weapon', attackBonus:2 },
      'Espada del caos':    { type:'weapon', slot:'weapon', attackBonus:3 },
      'Hacha de mano':      { type:'weapon', slot:'weapon', attackBonus:1 },
      'Hacha de guerra':    { type:'weapon', slot:'weapon', attackBonus:2 },
      'Hacha doble':        { type:'weapon', slot:'weapon', attackBonus:3 },
      'Maza de hierro':     { type:'weapon', slot:'weapon', attackBonus:1 },
      'Maza pesada':        { type:'weapon', slot:'weapon', attackBonus:2 },
      'Martillo de guerra': { type:'weapon', slot:'weapon', attackBonus:3 },
      'Lanza corta':        { type:'weapon', slot:'weapon', attackBonus:1, rangeBonus:1 },
      'Lanza larga':        { type:'weapon', slot:'weapon', attackBonus:1, rangeBonus:2 },
      'Ballesta ligera':    { type:'weapon', slot:'weapon', attackBonus:1, rangeBonus:2 },
      'Ballesta pesada':    { type:'weapon', slot:'weapon', attackBonus:2, rangeBonus:2 },
      'Arco corto':         { type:'weapon', slot:'weapon', attackBonus:1, rangeBonus:1 },
      'Arco largo':         { type:'weapon', slot:'weapon', attackBonus:1, rangeBonus:3 },
      'Bastón arcano':      { type:'weapon', slot:'weapon', attackBonus:1, rangeBonus:1 },
      'Bastón de poder':    { type:'weapon', slot:'weapon', attackBonus:2, rangeBonus:2 },
      'Espada del alba':    { type:'weapon', slot:'weapon', attackBonus:4 },
      // ── Escudos ──
      'Escudo de madera':   { type:'shield', slot:'shield', defenseBonus:1 },
      'Escudo de hierro':   { type:'shield', slot:'shield', defenseBonus:2 },
      'Escudo reforzado':   { type:'shield', slot:'shield', defenseBonus:2 },
      'Escudo de torre':    { type:'shield', slot:'shield', defenseBonus:3 },
      'Escudo del cruzado': { type:'shield', slot:'shield', defenseBonus:3, attackBonus:1 },
      'Broquel ligero':     { type:'shield', slot:'shield', defenseBonus:1 },
      // ── Cascos ──
      'Casco ligero':       { type:'helmet', slot:'helmet', defenseBonus:1 },
      'Casco de hierro':    { type:'helmet', slot:'helmet', defenseBonus:2 },
      'Yelmo de acero':     { type:'helmet', slot:'helmet', defenseBonus:2 },
      'Corona de combate':  { type:'helmet', slot:'helmet', defenseBonus:3 },
      'Capucha arcana':     { type:'helmet', slot:'helmet', defenseBonus:1, attackBonus:1 },
      // ── Armaduras ──
      'Armadura ligera':    { type:'armor', slot:'armor', defenseBonus:1 },
      'Cota de malla':      { type:'armor', slot:'armor', defenseBonus:2 },
      'Armadura de placas': { type:'armor', slot:'armor', defenseBonus:3 },
      'Coraza de dragón':   { type:'armor', slot:'armor', defenseBonus:4 },
      'Túnica encantada':   { type:'armor', slot:'armor', defenseBonus:1, attackBonus:1 },
      // ── Accesorios ──
      'Amuleto menor':      { type:'accessory', slot:'accessory', attackBonus:1 },
      'Amuleto mayor':      { type:'accessory', slot:'accessory', attackBonus:1, defenseBonus:1 },
      'Anillo de fuerza':   { type:'accessory', slot:'accessory', attackBonus:2 },
      'Anillo de protección':{ type:'accessory', slot:'accessory', defenseBonus:2 },
      'Talismán del héroe': { type:'accessory', slot:'accessory', attackBonus:1, defenseBonus:1, rangeBonus:1 },
      'Capa de sombras':    { type:'accessory', slot:'accessory', defenseBonus:1 },
      'Botas de velocidad': { type:'accessory', slot:'accessory', moveBonus:2 },
      // ── Pociones ──
      'Poción de curación pequeña': { type:'potion', effect:'heal', value:2 },
      'Poción de curación media':   { type:'potion', effect:'heal', value:3 },
      'Poción de curación grande':  { type:'potion', effect:'heal', value:4 },
      'Poción suprema de curación': { type:'potion', effect:'heal', value:6 },
      'Elixir de vida':             { type:'potion', effect:'heal', value:8 },
      'Poción de vigor':            { type:'potion', effect:'buff_attack', value:1, duration:2 },
      'Poción de fuerza':           { type:'potion', effect:'buff_attack', value:1, duration:3 },
      'Poción de fuerza mayor':     { type:'potion', effect:'buff_attack', value:2, duration:3 },
      'Poción de furia':            { type:'potion', effect:'buff_attack', value:3, duration:2 },
      'Poción de defensa':          { type:'potion', effect:'buff_defense', value:1, duration:2 },
      'Poción de resistencia':      { type:'potion', effect:'buff_defense', value:1, duration:3 },
      'Poción de piel de piedra':   { type:'potion', effect:'buff_defense', value:2, duration:3 },
      'Poción de velocidad':        { type:'potion', effect:'buff_range', value:1, duration:3 },
      'Poción de invisibilidad':    { type:'potion', effect:'buff_defense', value:3, duration:1 },
      'Poción de regeneración':     { type:'potion', effect:'heal', value:1, duration:4 },
      'Antídoto':                   { type:'potion', effect:'heal', value:1 },
      // ── Pergaminos ──
      'Pergamino de fuego':      { type:'scroll', effect:'damage', value:2, range:2 },
      'Pergamino de curación':   { type:'scroll', effect:'heal', value:2 },
      'Pergamino de niebla':     { type:'scroll', effect:'utility' },
      'Pergamino de rayo':       { type:'scroll', effect:'damage', value:3, range:3 },
      'Pergamino de escudo':     { type:'scroll', effect:'buff_defense', value:2, duration:1 },
      'Pergamino de explosión':  { type:'scroll', effect:'damage', value:4, range:2, area:1 },
      'Pergamino de teleport corto': { type:'scroll', effect:'utility' },
      'Pergamino épico':         { type:'scroll', effect:'damage', value:5, range:4 },
      'Pergamino de ventisca':   { type:'scroll', effect:'damage', value:3, range:3, area:1 },
      'Pergamino de terremoto':  { type:'scroll', effect:'damage', value:6, range:2, area:2 },
      'Pergamino de resurrección':{ type:'scroll', effect:'heal', value:6 },
      // ── Llaves ──
      'Llave pequeña':   { type:'key' },
      'Llave oxidada':   { type:'key' },
      'Llave de sala':   { type:'key' },
      'Llave maestra':   { type:'key' },
      'Llave de hueso':  { type:'key' },
      // ── Especiales ──
      'Gema azul':           { type:'special' },
      'Gema roja':           { type:'special' },
      'Gema esmeralda':      { type:'special' },
      'Ídolo antiguo':       { type:'special' },
      'Anillo grabado':      { type:'special' },
      'Reliquia antigua':    { type:'special' },
      'Artefacto de misión': { type:'special' },
      'Corona rota':         { type:'special' },
      'Cristal arcano':      { type:'special' },
      'Cáliz sagrado':       { type:'special' },
      'Sello del rey':       { type:'special' },
      'Ojo del abismo':      { type:'special' }
  };

  function makeItemDefinition(name) {
    var base = _ITEM_CATALOG[name] || { type:'special' };
    var copy = {};
    for (var key in base) copy[key] = base[key];
    copy.name = name;
    return copy;
  }

  function equipItem(hero, item) {
    if (!hero || !item || !hero.equipment || !item.slot) return false;
    hero.equipment[item.slot] = item;
    return true;
  }

  function equipFromBackpack(hero, index) {
    if (!hero || !hero.inventory || !hero.inventory.backpack) return;
    var item = hero.inventory.backpack[index];
    if (!item || !item.slot) return;
    if (!hero.inventory) hero.inventory = createHeroInventory();
    var displaced = hero.equipment[item.slot];
    hero.equipment[item.slot] = item;
    hero.inventory.backpack.splice(index, 1);
    if (displaced) hero.inventory.backpack.push(displaced);
    syncHeroDerivedStats(hero);
    showToast('⚔ Equipado: ' + item.name, 'toast-info');
    updateTurnInfo();
    render();
  }

  function unequipSlot(hero, slot) {
    if (!hero || !hero.equipment || !hero.equipment[slot]) return;
    if (!hero.inventory) hero.inventory = createHeroInventory();
    if (!hero.inventory.backpack) hero.inventory.backpack = [];
    hero.inventory.backpack.push(hero.equipment[slot]);
    hero.equipment[slot] = null;
    syncHeroDerivedStats(hero);
    showToast('📦 Guardado en mochila', 'toast-info');
    updateTurnInfo();
    render();
  }

  function getHeroAttack(hero) {
    if (!hero) return 0;
    var total = hero.attackBase != null ? hero.attackBase : (hero.atk || 0);
    if (hero.equipment) {
      var slots = ['weapon', 'shield', 'armor', 'helmet', 'accessory'];
      for (var i = 0; i < slots.length; i++) {
        var item = hero.equipment[slots[i]];
        if (item && item.attackBonus) total += item.attackBonus;
      }
    }
    if (hero.effects) {
      for (var j = 0; j < hero.effects.length; j++) {
        if (hero.effects[j].effect === 'buff_attack') total += hero.effects[j].value || 0;
      }
    }
    return Math.max(1, total);
  }

  function getHeroDefense(hero) {
    if (!hero) return 0;
    var total = hero.defenseBase != null ? hero.defenseBase : (hero.def || 0);
    if (hero.equipment) {
      var slots = ['shield', 'armor', 'helmet', 'accessory'];
      for (var i = 0; i < slots.length; i++) {
        var item = hero.equipment[slots[i]];
        if (item && item.defenseBonus) total += item.defenseBonus;
      }
    }
    if (hero.effects) {
      for (var j = 0; j < hero.effects.length; j++) {
        if (hero.effects[j].effect === 'buff_defense') total += hero.effects[j].value || 0;
      }
    }
    return Math.max(0, total);
  }

  function getHeroRange(hero) {
    if (!hero) return 1;
    var total = hero.baseRange != null ? hero.baseRange : (hero.range || 1);
    if (hero.equipment) {
      var slots = ['weapon', 'shield', 'armor', 'helmet', 'accessory'];
      for (var i = 0; i < slots.length; i++) {
        var item = hero.equipment[slots[i]];
        if (item && item.rangeBonus) total += item.rangeBonus;
      }
    }
    if (hero.effects) {
      for (var j = 0; j < hero.effects.length; j++) {
        if (hero.effects[j].effect === 'buff_range') total += hero.effects[j].value || 0;
      }
    }
    return Math.max(1, total);
  }

  function syncHeroDerivedStats(hero) {
    if (!hero) return hero;
    hero.atk = getHeroAttack(hero);
    hero.def = getHeroDefense(hero);
    hero.range = getHeroRange(hero);
    return hero;
  }

  function syncAllHeroDerivedStats() {
    if (!current || !current.heroes) return;
    for (var i = 0; i < current.heroes.length; i++) syncHeroDerivedStats(current.heroes[i]);
  }

  function heroAbilityLabel(heroType) {
    if (heroType === 'barbaro') return 'Frenesí: si matas un enemigo, puedes atacar de nuevo';
    if (heroType === 'arquero') return 'Disparo libre: puedes moverte después de atacar';
    if (heroType === 'mago') return 'Explosión arcana: el ataque golpea a todos los enemigos en rango';
    if (heroType === 'enano') return 'Armadura sólida: absorbe 1 de daño por golpe';
    return '';
  }

  function heroAbilityReady(hero) {
    if (!hero || !current || !current.turn) return false;
    var heroType = hero.id.split('_')[0];
    if (heroType === 'barbaro') return current.turn.rolled && !current.turn.abilityUsed;
    if (heroType === 'arquero') return current.turn.rolled && current.turn.attacked && current.turn.movePoints > 0;
    if (heroType === 'mago') return current.turn.rolled && !current.turn.attacked;
    if (heroType === 'enano') return false; // pasiva, siempre activa
    return false;
  }

  function tickHeroEffects(hero) {
    if (!hero || !hero.effects || !hero.effects.length) return;
    // Apply damage from poison before decrementing duration
    hero.effects.forEach(function (effect) {
      if (effect.effect === 'poison' && effect.duration > 0 && hero.hp > 0) {
        var poisonDmg = effect.value || 1;
        hero.hp = Math.max(0, hero.hp - poisonDmg);
        addCombatFx(hero.x, hero.y, '-' + poisonDmg, 'damage');
        pushCombatLog(heroDisplayName(hero) + ' sufre ' + poisonDmg + ' PV de veneno. Vida: ' + hero.hp + '/' + hero.maxHp + '.');
      }
    });
    hero.effects = hero.effects
      .map(function (effect) {
        return Object.assign({}, effect, { duration: (effect.duration || 1) - 1 });
      })
      .filter(function (effect) { return effect.duration > 0; });
    syncHeroDerivedStats(hero);
  }

  function usePotion(hero, index) {
    if (!current || !hero || !hero.inventory || !hero.inventory.potions) return;
    var potion = hero.inventory.potions[index];
    if (!potion) return;
    hero.inventory.potions.splice(index, 1);
    if (potion.effect === 'heal') {
      var healed = Math.min(potion.value || 2, (hero.maxHp || hero.hp) - hero.hp);
      hero.hp = Math.min(hero.maxHp || hero.hp, hero.hp + (potion.value || 2));
      addCombatFx(hero.x, hero.y, '+' + healed, 'block');
      pushCombatLog(heroDisplayName(hero) + ' usa ' + potion.name + ' y recupera ' + healed + ' PV.');
      setStatus(heroDisplayName(hero) + ' usa ' + potion.name + '. +' + healed + ' PV. Vida: ' + hero.hp + '/' + hero.maxHp + '.');
    } else if (potion.effect === 'buff_attack' || potion.effect === 'buff_defense' || potion.effect === 'buff_range') {
      if (!hero.effects) hero.effects = [];
      hero.effects.push({ effect: potion.effect, value: potion.value || 1, duration: potion.duration || 2, label: potion.name });
      syncHeroDerivedStats(hero);
      pushCombatLog(heroDisplayName(hero) + ' usa ' + potion.name + ': ' + effectLabel({ effect: potion.effect, value: potion.value }) + ' durante ' + (potion.duration || 2) + ' turno(s).');
      setStatus(heroDisplayName(hero) + ' usa ' + potion.name + '. ' + effectLabel({ effect: potion.effect, value: potion.value }) + ' durante ' + (potion.duration || 2) + ' turno(s).');
    }
    updateTurnInfo();
    render();
  }

  function getScrollTargets(hero, scroll) {
    if (!current || !hero || !scroll) return {};
    var range = scroll.range || 2;
    var targets = {};
    (current.enemies || []).forEach(function(enemy) {
      if (enemy.hp <= 0 || !current.visible[tileKey(enemy.x, enemy.y)]) return;
      var dist = Math.abs(hero.x - enemy.x) + Math.abs(hero.y - enemy.y);
      if (dist <= range) targets[tileKey(enemy.x, enemy.y)] = true;
    });
    return targets;
  }

  function fireScrollAtEnemy(heroId, scrollIndex, targetX, targetY) {
    var hero = getHeroById(heroId);
    var enemy = getEnemyAt(targetX, targetY);
    if (!hero || !enemy || !hero.inventory || !hero.inventory.scrolls) return;
    var scroll = hero.inventory.scrolls[scrollIndex];
    if (!scroll || scroll.effect !== 'damage') return;
    hero.inventory.scrolls.splice(scrollIndex, 1);
    current.scrollTargeting = null;
    current.scrollTargetTiles = {};

    var dmg = scroll.value || 2;
    var hit = [enemy];
    // Explosión: daño también a adyacentes del objetivo
    if (scroll.area) {
      (current.enemies || []).forEach(function(e) {
        if (e === enemy || e.hp <= 0) return;
        if (Math.abs(e.x - targetX) + Math.abs(e.y - targetY) <= scroll.area) hit.push(e);
      });
    }
    var totalDmg = 0;
    hit.forEach(function(e) {
      e.hp -= dmg;
      totalDmg += dmg;
      addCombatFx(e.x, e.y, '-' + dmg, 'damage');
    });
    addCombatFx(hero.x, hero.y, '📜', 'attack');
    removeDeadEnemies();
    computeVisibility(current);
    var line = heroDisplayName(hero) + ' lanza ' + scroll.name + ' sobre ' + unitDisplayName(enemy) +
      ': ' + dmg + ' daño' + (hit.length > 1 ? ' (área, ' + hit.length + ' objetivos)' : '') + '.';
    pushCombatLog(line);
    showToast('📜 ' + scroll.name + ': -' + totalDmg + ' daño', 'toast-danger');
    current.reachable = computeReachableTiles(hero, current.turn ? current.turn.movePoints : 0);
    current.attackable = computeAttackableTiles(hero);
    updateTurnInfo();
    render();
  }

  function useScroll(hero, index) {
    if (!current || !hero || !hero.inventory || !hero.inventory.scrolls) return;
    var scroll = hero.inventory.scrolls[index];
    if (!scroll) return;

    if (scroll.effect === 'damage') {
      // Entrar en modo selección de objetivo
      var targets = getScrollTargets(hero, scroll);
      if (!Object.keys(targets).length) {
        setStatus('No hay enemigos en rango (' + (scroll.range||2) + ') para ' + scroll.name + '.');
        render();
        return;
      }
      current.scrollTargeting = { heroId: hero.id, scrollIndex: index };
      current.scrollTargetTiles = targets;
      setStatus('📜 ' + scroll.name + ' — haz click en un enemigo resaltado (rango ' + (scroll.range||2) + '). Click fuera cancela.');
      render();
      return;
    }

    hero.inventory.scrolls.splice(index, 1);
    if (scroll.effect === 'heal') {
      var healed2 = Math.min(scroll.value || 2, (hero.maxHp || hero.hp) - hero.hp);
      hero.hp = Math.min(hero.maxHp || hero.hp, hero.hp + (scroll.value || 2));
      addCombatFx(hero.x, hero.y, '+' + healed2, 'block');
      pushCombatLog(heroDisplayName(hero) + ' usa ' + scroll.name + ' y recupera ' + healed2 + ' PV.');
      setStatus(heroDisplayName(hero) + ' usa ' + scroll.name + '. +' + healed2 + ' PV.');
    } else if (scroll.effect === 'buff_defense') {
      if (!hero.effects) hero.effects = [];
      hero.effects.push({ effect: 'buff_defense', value: scroll.value || 2, duration: scroll.duration || 1, label: scroll.name });
      syncHeroDerivedStats(hero);
      pushCombatLog(heroDisplayName(hero) + ' usa ' + scroll.name + ': +' + (scroll.value || 2) + ' DEF durante ' + (scroll.duration || 1) + ' turno(s).');
      setStatus(heroDisplayName(hero) + ' usa ' + scroll.name + '. +' + (scroll.value || 2) + ' DEF durante ' + (scroll.duration || 1) + ' turno(s).');
    } else {
      pushCombatLog(heroDisplayName(hero) + ' usa ' + scroll.name + '.');
      setStatus(heroDisplayName(hero) + ' usa ' + scroll.name + '.');
    }
    updateTurnInfo();
    render();
  }

  function tierLabel(tier) {
    if (tier === 'principal') return 'Cofre principal';
    if (tier === 'valioso') return 'Cofre valioso';
    return 'Cofre normal';
  }

  function chestDistribution(total) {
    total = Math.max(0, total || 0);
    if (total <= 0) return [];
    var tiers = ['principal'];
    if (total === 1) return tiers;
    var valuable = total >= 6 ? 2 : 1;
    for (var v = 0; v < valuable && tiers.length < total; v++) tiers.push('valioso');
    while (tiers.length < total) tiers.push('normal');
    return tiers;
  }

  function buildChestTables() {
    return {
      normal: [
        { weight:20, kind:'gold', amount:[15,20,25,30] },
        { weight:25, kind:'potions', items:['Poción de curación pequeña', 'Poción de curación media', 'Poción de vigor', 'Poción de defensa', 'Antídoto'] },
        { weight:15, kind:'keys', items:['Llave pequeña', 'Llave oxidada', 'Llave de sala', 'Llave de hueso'] },
        { weight:20, kind:'scrolls', items:['Pergamino de fuego', 'Pergamino de curación', 'Pergamino de escudo', 'Pergamino de niebla'] },
        { weight:10, kind:'equipment', items:['Daga afilada', 'Daga envenenada', 'Hacha de mano', 'Maza de hierro', 'Arco corto', 'Broquel ligero', 'Capa de sombras'] },
        { weight:10, kind:'trap', traps:[
          { name:'Trampa de aguja', damage:1 },
          { name:'Dardo envenenado', damage:2 },
          { name:'Gas debilitante', damage:1 },
          { name:'Alarma maldita', damage:1 },
          { name:'Suelo de púas', damage:2 }
        ] }
      ],
      valioso: [
        { weight:20, kind:'gold', amount:[40,50,60,75,90] },
        { weight:20, kind:'potions', items:['Poción de curación grande', 'Poción de fuerza', 'Poción de velocidad', 'Poción de resistencia', 'Poción de piel de piedra', 'Poción de regeneración'] },
        { weight:25, kind:'equipment', items:['Espada corta', 'Espada ancha', 'Hacha de guerra', 'Maza pesada', 'Lanza corta', 'Ballesta ligera', 'Bastón arcano', 'Escudo de madera', 'Escudo de hierro', 'Casco ligero', 'Casco de hierro', 'Armadura ligera', 'Cota de malla', 'Amuleto menor', 'Botas de velocidad'] },
        { weight:15, kind:'scrolls', items:['Pergamino de rayo', 'Pergamino de escudo', 'Pergamino de explosión', 'Pergamino de ventisca'] },
        { weight:10, kind:'specials', items:['Gema azul', 'Gema roja', 'Gema esmeralda', 'Ídolo antiguo', 'Anillo grabado'] },
        { weight:10, kind:'trap', traps:[
          { name:'Trampa de ácido', damage:3 },
          { name:'Trampa de cuchillas', damage:2 },
          { name:'Gas venenoso', damage:2 }
        ] }
      ],
      principal: [
        { weight:35, kind:'equipment', items:['Espada larga', 'Espada del caos', 'Hacha doble', 'Martillo de guerra', 'Lanza larga', 'Ballesta pesada', 'Bastón de poder', 'Escudo reforzado', 'Escudo de torre', 'Escudo del cruzado', 'Yelmo de acero', 'Corona de combate', 'Capucha arcana', 'Armadura de placas', 'Túnica encantada', 'Amuleto mayor', 'Anillo de fuerza', 'Anillo de protección', 'Talismán del héroe'] },
        { weight:20, kind:'specials', items:['Reliquia antigua', 'Llave maestra', 'Artefacto de misión', 'Corona rota', 'Cristal arcano', 'Cáliz sagrado', 'Sello del rey', 'Ojo del abismo'] },
        { weight:15, kind:'gold', amount:[100,120,150,200] },
        { weight:15, kind:'potions', items:['Poción suprema de curación', 'Poción de fuerza mayor', 'Poción de furia', 'Poción de invisibilidad', 'Elixir de vida'] },
        { weight:10, kind:'scrolls', items:['Pergamino épico', 'Pergamino de terremoto', 'Pergamino de resurrección'] },
        { weight:5, kind:'trap', traps:[
          { name:'Guardián arcano', damage:4 },
          { name:'Maldición del cofre', damage:3 }
        ] }
      ]
    };
  }

  function resolveChestLoot(rng, tier) {
    var tables = buildChestTables();
    var selectedTier = tables[tier] ? tier : 'normal';
    var entry = weightedChoice(rng, tables[selectedTier]);
    if (!entry) {
      return { tier:selectedTier, rewardType:'gold', bucket:'gold', amount:15, text:'15 de oro', message:'Has encontrado 15 de oro.' };
    }
    if (entry.kind === 'gold') {
      var amount = randomChoice(rng, entry.amount) || entry.amount[0] || 15;
      return {
        tier:selectedTier,
        rewardType:'gold',
        bucket:'gold',
        amount:amount,
        text:amount + ' de oro',
        message:'Has encontrado ' + amount + ' de oro.'
      };
    }
    if (entry.kind === 'trap') {
      var trap = randomChoice(rng, entry.traps) || entry.traps[0];
      return {
        tier:selectedTier,
        rewardType:'trap',
        bucket:'trap',
        amount:trap.damage,
        trapName:trap.name,
        text:trap.name + ' · ' + trap.damage + ' daño',
        message:'Trampa: ' + trap.name + '. Recibes ' + trap.damage + ' de daño.'
      };
    }
    var bucket = entry.forceBucket ? entry.bucket : entry.kind;
    var item = randomChoice(rng, entry.items) || entry.items[0] || 'Tesoro';
    return {
      tier:selectedTier,
      rewardType:entry.kind,
      bucket:bucket,
      item:item,
      text:item,
      message:'Has encontrado ' + (/^[AEIOUÁÉÍÓÚ]/.test(item) ? 'una ' : 'un ') + item + '.'
    };
  }

  function applyChestLoot(hero, loot) {
    if (!current || !hero || !loot) return '';
    if (!current.inventory) current.inventory = createInventoryState();
    var inventory = current.inventory;
    var detail = '';
    if (loot.bucket === 'gold') {
      inventory.gold += loot.amount || 0;
    } else if (loot.bucket === 'trap') {
      hero.hp = Math.max(0, hero.hp - (loot.amount || 0));
      inventory.trapsTriggered = (inventory.trapsTriggered || 0) + 1;
      addCombatFx(hero.x, hero.y, '-' + (loot.amount || 0), 'damage');
    } else if (loot.item) {
      var item = makeItemDefinition(loot.item);
      if (item.type === 'weapon' || item.type === 'shield' || item.type === 'armor' || item.type === 'helmet' || item.type === 'accessory') {
        if (!hero.inventory) hero.inventory = createHeroInventory();
        if (!hero.inventory.backpack) hero.inventory.backpack = [];
        hero.inventory.backpack.push(item);
        // Registro global
        if (inventory.equipment) inventory.equipment.push(item.name);
        detail = item.name + ' guardado en mochila.';
      } else {
        if (!hero.inventory) hero.inventory = createHeroInventory();
        if (item.type === 'potion') hero.inventory.potions.push(item);
        else if (item.type === 'scroll') hero.inventory.scrolls.push(item);
        else if (item.type === 'key') hero.inventory.keys.push(item);
        else hero.inventory.specials.push(item);
        // Registro global también como nombre
        var globalBucket = item.type === 'potion' ? 'potions' : item.type === 'scroll' ? 'scrolls' : item.type === 'key' ? 'keys' : 'specials';
        if (inventory[globalBucket]) inventory[globalBucket].push(item.name);
      }
    }
    inventory.openedChestRewards.unshift({ tier:loot.tier, text:loot.text });
    if (inventory.openedChestRewards.length > 8) inventory.openedChestRewards.length = 8;
    syncHeroDerivedStats(hero);
    return (loot.message || '') + (detail ? ' ' + detail : '');
  }

  function inventoryListHtml(items) {
    if (!items || !items.length) return '<span class="muted">—</span>';
    return items.map(function (item) { return '<span class="loot-chip">' + escapeHtml(item) + '</span>'; }).join(' ');
  }

  function createRng() {
    var seed = (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0;
    return (function (a) {
      return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    })(seed);
  }

  function createFilledMap(width, height) {
    var map = [];
    for (var y = 0; y < height; y++) {
      var row = [];
      for (var x = 0; x < width; x++) row.push(TILE.WALL);
      map.push(row);
    }
    return map;
  }

  function carveRoom(map, room) {
    for (var y = room.y + 1; y < room.y + room.h - 1; y++) {
      for (var x = room.x + 1; x < room.x + room.w - 1; x++) map[y][x] = TILE.FLOOR;
    }
  }

  function corridorH(map, x1, x2, y) {
    for (var x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) map[y][x] = TILE.FLOOR;
  }

  function corridorV(map, y1, y2, x) {
    for (var y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) map[y][x] = TILE.FLOOR;
  }

  function overlaps(a, b, margin) {
    return a.x < b.x + b.w + margin &&
      a.x + a.w + margin > b.x &&
      a.y < b.y + b.h + margin &&
      a.y + a.h + margin > b.y;
  }

  // ── Performance: static buffer for neighbors4 — avoids array allocation on every BFS call ──
  var _n4 = [[0,0],[0,0],[0,0],[0,0]];
  function neighbors4(x, y) {
    _n4[0][0] = x + 1; _n4[0][1] = y;
    _n4[1][0] = x - 1; _n4[1][1] = y;
    _n4[2][0] = x;     _n4[2][1] = y + 1;
    _n4[3][0] = x;     _n4[3][1] = y - 1;
    return _n4;
  }

  function floodFill(map, start, passableFn) {
    var q = [start];
    var qi = 0;
    var seen = {};
    seen[start.x + ',' + start.y] = true;
    while (qi < q.length) {
      var cur = q[qi++];
      var ns = neighbors4(cur.x, cur.y);
      for (var i = 0; i < ns.length; i++) {
        var nx = ns[i][0], ny = ns[i][1];
        if (ny < 0 || ny >= map.length || nx < 0 || nx >= map[0].length) continue;
        if (passableFn ? !passableFn(nx, ny) : map[ny][nx] === TILE.WALL) continue;
        var key = nx + ',' + ny;
        if (seen[key]) continue;
        seen[key] = true;
        q.push({ x:nx, y:ny });
      }
    }
    return seen;
  }

  function randomFloor(map, used, rng, room) {
    for (var i = 0; i < 5000; i++) {
      var x, y;
      if (room) {
        x = randomInt(rng, room.x + 1, room.x + room.w - 2);
        y = randomInt(rng, room.y + 1, room.y + room.h - 2);
      } else {
        x = randomInt(rng, 0, map[0].length - 1);
        y = randomInt(rng, 0, map.length - 1);
      }
      var key = x + ',' + y;
      if (map[y][x] === TILE.FLOOR && !used[key]) return { x:x, y:y };
    }
    return null;
  }

  function randomFloorFallback(map, used, rng, preferredRooms) {
    if (preferredRooms && preferredRooms.length) {
      for (var r = 0; r < preferredRooms.length; r++) {
        var p = randomFloor(map, used, rng, preferredRooms[r]);
        if (p) return p;
      }
    }

    var all = [];
    for (var y = 0; y < map.length; y++) {
      for (var x = 0; x < map[0].length; x++) {
        var key = x + ',' + y;
        if (map[y][x] === TILE.FLOOR && !used[key]) all.push({ x:x, y:y });
      }
    }
    if (!all.length) return null;
    return all[randomInt(rng, 0, all.length - 1)];
  }

  function randomCellFromList(cells, used, rng, map, allowedTiles) {
    var allowed = {};
    for (var i = 0; i < allowedTiles.length; i++) allowed[allowedTiles[i]] = true;
    var candidates = [];
    for (var c = 0; c < cells.length; c++) {
      var cell = cells[c];
      var key = cell.x + ',' + cell.y;
      if (!map[cell.y] || !allowed[map[cell.y][cell.x]] || used[key]) continue;
      candidates.push(cell);
    }
    if (!candidates.length) return null;
    return candidates[randomInt(rng, 0, candidates.length - 1)];
  }

  function sanitizeEntityPositions(map, used, rng, entities, preferredRooms, allowedTiles) {
    var allowed = {};
    for (var i = 0; i < allowedTiles.length; i++) allowed[allowedTiles[i]] = true;

    for (var e = 0; e < entities.length; e++) {
      var ent = entities[e];
      var valid = false;
      if (map[ent.y] && map[ent.y][ent.x] !== undefined) {
        var tile = map[ent.y][ent.x];
        var key = ent.x + ',' + ent.y;
        if (allowed[tile] && !used[key]) valid = true;
      }
      if (!valid) {
        var safePos = randomFloorFallback(map, used, rng, preferredRooms);
        if (!safePos) continue;
        ent.x = safePos.x;
        ent.y = safePos.y;
      }
      used[ent.x + ',' + ent.y] = true;
    }
  }

  function tileKey(x, y) {
    return x + ',' + y;
  }

  function parseTileKey(key) {
    var parts = key.split(',');
    return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) };
  }

  function isInsideRoom(room, x, y) {
    return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
  }

  function roomIndexAt(rooms, x, y) {
    for (var i = 0; i < rooms.length; i++) {
      if (isInsideRoom(rooms[i], x, y)) return i;
    }
    return -1;
  }

  function buildDoorCandidate(room, side, target) {
    if (side === 'left') return { x: room.x, y: clamp(target, room.y + 1, room.y + room.h - 2), side:'left' };
    if (side === 'right') return { x: room.x + room.w - 1, y: clamp(target, room.y + 1, room.y + room.h - 2), side:'right' };
    if (side === 'top') return { x: clamp(target, room.x + 1, room.x + room.w - 2), y: room.y, side:'top' };
    return { x: clamp(target, room.x + 1, room.x + room.w - 2), y: room.y + room.h - 1, side:'bottom' };
  }

  function roomDoorStats(roomIndex, doorSpots) {
    var stats = { total:0, bySide:{} };
    for (var key in doorSpots) {
      var d = doorSpots[key];
      if (d.roomIndex !== roomIndex) continue;
      stats.total++;
      stats.bySide[d.side] = (stats.bySide[d.side] || 0) + 1;
    }
    return stats;
  }

  function maxDoorsForRoom(room) {
    var area = room.w * room.h;
    if (area >= 90) return 2;
    return 1;
  }

  function scoreDoorCandidate(candidate, roomIndex, rooms, doorSpots, preferredSide) {
    var normal = doorNormal(candidate.side);
    var key = tileKey(candidate.x, candidate.y);
    var insideX = candidate.x - normal.dx;
    var insideY = candidate.y - normal.dy;
    var outsideX = candidate.x + normal.dx;
    var outsideY = candidate.y + normal.dy;
    var stats = roomDoorStats(roomIndex, doorSpots);

    if (doorSpots[key]) return -9999;
    if (roomIndexAt(rooms, insideX, insideY) !== roomIndex) return -9999;
    if (roomIndexAt(rooms, outsideX, outsideY) !== -1) return -9999;
    if (stats.bySide[candidate.side]) return -9999;
    if (stats.total >= maxDoorsForRoom(rooms[roomIndex])) return -9999;

    var score = candidate.side === preferredSide ? 100 : 0;
    var minDistRoom = 999;
    for (var existingKey in doorSpots) {
      var d = doorSpots[existingKey];
      if (d.roomIndex !== roomIndex) continue;
      var dist = Math.abs(d.x - candidate.x) + Math.abs(d.y - candidate.y);
      if (dist <= 3) return -9999;
      if (dist < minDistRoom) minDistRoom = dist;
    }

    if (minDistRoom < 999) score += Math.min(25, minDistRoom * 3);

    if (candidate.side === 'left' || candidate.side === 'right') {
      score -= Math.abs(candidate.y - targetBias(candidate.y, rooms[roomIndex].cy));
    } else {
      score -= Math.abs(candidate.x - targetBias(candidate.x, rooms[roomIndex].cx));
    }
    return score;
  }

  function targetBias(value, target) {
    return target === undefined ? value : target;
  }

  function bestExistingDoor(roomIndex, preferredSide, target, doorSpots) {
    var best = null;
    var bestScore = -99999;
    for (var key in doorSpots) {
      var d = doorSpots[key];
      if (d.roomIndex !== roomIndex) continue;
      var score = d.side === preferredSide ? 100 : 0;
      score -= Math.abs((d.side === 'left' || d.side === 'right') ? d.y - target : d.x - target);
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  function roomDoorPoint(room, preferredSide, target, rooms, doorSpots) {
    var roomIndex = rooms.indexOf(room);
    var preferredOnly = [preferredSide];
    var fallbackSides = (preferredSide === 'left' || preferredSide === 'right') ? ['top', 'bottom'] : ['left', 'right'];
    var sideOrder = preferredOnly.concat(fallbackSides);
    var seenSides = {};
    var best = null;
    var bestScore = -99999;

    for (var s = 0; s < sideOrder.length; s++) {
      var side = sideOrder[s];
      if (seenSides[side]) continue;
      seenSides[side] = true;
      var spanMin = (side === 'left' || side === 'right') ? room.y + 1 : room.x + 1;
      var spanMax = (side === 'left' || side === 'right') ? room.y + room.h - 2 : room.x + room.w - 2;
      for (var pos = spanMin; pos <= spanMax; pos++) {
        var cand = buildDoorCandidate(room, side, pos);
        var score = scoreDoorCandidate(cand, roomIndex, rooms, doorSpots, preferredSide);
        score -= Math.abs(pos - target);
        if (side !== preferredSide) score -= 60;
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }
    }

    return bestScore > -9999 ? best : bestExistingDoor(roomIndex, preferredSide, target, doorSpots);
  }

  function doorNormal(side) {
    if (side === 'left') return { dx:-1, dy:0, axis:'v' };
    if (side === 'right') return { dx:1, dy:0, axis:'v' };
    if (side === 'top') return { dx:0, dy:-1, axis:'h' };
    return { dx:0, dy:1, axis:'h' };
  }

  function corridorStartFromDoor(door) {
    var normal = doorNormal(door.side);
    return { x: door.x + normal.dx, y: door.y + normal.dy };
  }

  function countDoorsForRoomGlobal(roomIndex, sourceDoors) {
    var total = 0;
    for (var key in sourceDoors) {
      if (sourceDoors[key].roomIndex === roomIndex) total++;
    }
    return total;
  }

  function ensureStartRoomConnection(map, rooms, doorSpots, rng) {
    if (!rooms || rooms.length < 2) return doorSpots;
    if (countDoorsForRoomGlobal(0, doorSpots) > 0) return doorSpots;

    var ordered = [];
    for (var i = 1; i < rooms.length; i++) {
      ordered.push({
        idx: i,
        dist: Math.abs(rooms[i].cx - rooms[0].cx) + Math.abs(rooms[i].cy - rooms[0].cy)
      });
    }
    ordered.sort(function (a, b) { return a.dist - b.dist; });

    for (var j = 0; j < ordered.length; j++) {
      if (connectRooms(map, rooms, 0, ordered[j].idx, doorSpots, rng)) break;
    }

    return finalizeDoors(map, rooms, doorSpots);
  }

  function nearestRoomIndexForStart(rooms) {
    if (!rooms || rooms.length < 2) return -1;
    var bestIdx = -1;
    var bestDist = Infinity;
    for (var i = 1; i < rooms.length; i++) {
      var d = Math.abs(rooms[i].cx - rooms[0].cx) + Math.abs(rooms[i].cy - rooms[0].cy);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function forceMandatoryStartExit(map, rooms, doorSpots) {
    if (!rooms || !rooms.length) return finalizeDoors(map, rooms, doorSpots || {});
    doorSpots = doorSpots || {};
    if (countDoorsForRoomGlobal(0, doorSpots) > 0) return finalizeDoors(map, rooms, doorSpots);

    var targetIndex = nearestRoomIndexForStart(rooms);
    if (targetIndex < 0) return finalizeDoors(map, rooms, doorSpots);

    var start = rooms[0];
    var target = rooms[targetIndex];
    var preferredSide;
    var targetBiasValue;

    if (Math.abs(start.cx - target.cx) >= Math.abs(start.cy - target.cy)) {
      preferredSide = start.cx < target.cx ? 'right' : 'left';
      targetBiasValue = target.cy;
    } else {
      preferredSide = start.cy < target.cy ? 'bottom' : 'top';
      targetBiasValue = target.cx;
    }

    var door = buildDoorCandidate(start, preferredSide, targetBiasValue);
    door.roomIndex = 0;
    door.connectionTo = targetIndex;
    door.open = false;

    var normal = doorNormal(door.side);
    var outsideX = door.x + normal.dx;
    var outsideY = door.y + normal.dy;

    if (!map[outsideY] || map[outsideY][outsideX] === undefined) return finalizeDoors(map, rooms, doorSpots);

    map[outsideY][outsideX] = TILE.FLOOR;
    if (Math.abs(start.cx - target.cx) >= Math.abs(start.cy - target.cy)) {
      corridorH(map, outsideX, target.cx, outsideY);
      corridorV(map, outsideY, target.cy, target.cx);
    } else {
      corridorV(map, outsideY, target.cy, outsideX);
      corridorH(map, outsideX, target.cx, target.cy);
    }

    doorSpots[tileKey(door.x, door.y)] = door;
    return finalizeDoors(map, rooms, doorSpots);
  }


  function startBoundaryCandidates(room) {
    var candidates = [];
    for (var x = room.x + 1; x <= room.x + room.w - 2; x++) {
      candidates.push({ x:x, y:room.y, side:'top' });
      candidates.push({ x:x, y:room.y + room.h - 1, side:'bottom' });
    }
    for (var y = room.y + 1; y <= room.y + room.h - 2; y++) {
      candidates.push({ x:room.x, y:y, side:'left' });
      candidates.push({ x:room.x + room.w - 1, y:y, side:'right' });
    }
    return candidates;
  }

  function startRoomHasImmediateExit(map, rooms, doors) {
    if (!rooms || !rooms.length) return false;
    var start = rooms[0];
    var candidates = startBoundaryCandidates(start);
    for (var i = 0; i < candidates.length; i++) {
      var cand = candidates[i];
      var normal = doorNormal(cand.side);
      var insideX = cand.x - normal.dx;
      var insideY = cand.y - normal.dy;
      var outsideX = cand.x + normal.dx;
      var outsideY = cand.y + normal.dy;
      if (!map[insideY] || !map[outsideY]) continue;
      if (map[insideY][insideX] !== TILE.FLOOR) continue;
      if (map[outsideY][outsideX] === undefined || map[outsideY][outsideX] === TILE.WALL) continue;
      if (map[cand.y][cand.x] === TILE.DOOR || map[cand.y][cand.x] === TILE.FLOOR) return true;
      if (doors && doors[tileKey(cand.x, cand.y)]) return true;
    }
    return false;
  }

  function carveGuaranteedStartPassage(map, rooms) {
    if (!rooms || rooms.length < 2) return false;
    var start = rooms[0];
    var targetIndex = nearestRoomIndexForStart(rooms);
    if (targetIndex < 0) return false;
    var target = rooms[targetIndex];
    var preferredSide;
    var targetBiasValue;

    if (Math.abs(start.cx - target.cx) >= Math.abs(start.cy - target.cy)) {
      preferredSide = start.cx < target.cx ? 'right' : 'left';
      targetBiasValue = target.cy;
    } else {
      preferredSide = start.cy < target.cy ? 'bottom' : 'top';
      targetBiasValue = target.cx;
    }

    var passage = buildDoorCandidate(start, preferredSide, targetBiasValue);
    var normal = doorNormal(passage.side);
    var outsideX = passage.x + normal.dx;
    var outsideY = passage.y + normal.dy;

    if (!map[outsideY] || map[outsideY][outsideX] === undefined) return false;

    map[passage.y][passage.x] = TILE.FLOOR;
    map[outsideY][outsideX] = TILE.FLOOR;

    if (Math.abs(start.cx - target.cx) >= Math.abs(start.cy - target.cy)) {
      corridorH(map, outsideX, target.cx, outsideY);
      corridorV(map, outsideY, target.cy, target.cx);
    } else {
      corridorV(map, outsideY, target.cy, outsideX);
      corridorH(map, outsideX, target.cx, target.cy);
    }
    return true;
  }

  function connectRooms(map, rooms, aIndex, bIndex, doorSpots, rng) {
    var a = rooms[aIndex];
    var b = rooms[bIndex];
    var startDoor, endDoor;
    var existingStartCount = roomDoorStats(aIndex, doorSpots).total;
    var existingEndCount = roomDoorStats(bIndex, doorSpots).total;
    if (Math.abs(a.cx - b.cx) >= Math.abs(a.cy - b.cy)) {
      if (a.cx < b.cx) {
        startDoor = roomDoorPoint(a, 'right', b.cy, rooms, doorSpots);
        endDoor = roomDoorPoint(b, 'left', a.cy, rooms, doorSpots);
      } else {
        startDoor = roomDoorPoint(a, 'left', b.cy, rooms, doorSpots);
        endDoor = roomDoorPoint(b, 'right', a.cy, rooms, doorSpots);
      }
    } else {
      if (a.cy < b.cy) {
        startDoor = roomDoorPoint(a, 'bottom', b.cx, rooms, doorSpots);
        endDoor = roomDoorPoint(b, 'top', a.cx, rooms, doorSpots);
      } else {
        startDoor = roomDoorPoint(a, 'top', b.cx, rooms, doorSpots);
        endDoor = roomDoorPoint(b, 'bottom', a.cx, rooms, doorSpots);
      }
    }

    if (!startDoor || !endDoor) return false;
    startDoor.roomIndex = aIndex;
    endDoor.roomIndex = bIndex;
    startDoor.connectionTo = bIndex;
    endDoor.connectionTo = aIndex;
    if (startDoor.open === undefined) startDoor.open = false;
    if (endDoor.open === undefined) endDoor.open = false;
    if (!doorSpots[tileKey(startDoor.x, startDoor.y)]) doorSpots[tileKey(startDoor.x, startDoor.y)] = startDoor;
    if (!doorSpots[tileKey(endDoor.x, endDoor.y)]) doorSpots[tileKey(endDoor.x, endDoor.y)] = endDoor;

    var startOutside = corridorStartFromDoor(startDoor);
    var endOutside = corridorStartFromDoor(endDoor);

    if (rng() < 0.5) {
      corridorH(map, startOutside.x, endOutside.x, startOutside.y);
      corridorV(map, startOutside.y, endOutside.y, endOutside.x);
    } else {
      corridorV(map, startOutside.y, endOutside.y, startOutside.x);
      corridorH(map, startOutside.x, endOutside.x, endOutside.y);
    }
    return roomDoorStats(aIndex, doorSpots).total > existingStartCount || roomDoorStats(bIndex, doorSpots).total > existingEndCount;
  }

  function primEdges(rooms) {
    var connected = [0];
    var remaining = [];
    for (var i = 1; i < rooms.length; i++) remaining.push(i);
    var edges = [];

    while (remaining.length) {
      var bestDist = Infinity;
      var bestFrom = 0;
      var bestIdx = 0;

      for (var c = 0; c < connected.length; c++) {
        for (var r = 0; r < remaining.length; r++) {
          var a = rooms[connected[c]];
          var b = rooms[remaining[r]];
          var d = Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
          if (d < bestDist) {
            bestDist = d;
            bestFrom = connected[c];
            bestIdx = r;
          }
        }
      }

      var to = remaining.splice(bestIdx, 1)[0];
      edges.push([bestFrom, to]);
      connected.push(to);
    }

    return edges;
  }

  function addExtraEdges(edges, rooms, extraCount, rng) {
    var used = {};
    for (var i = 0; i < edges.length; i++) {
      used[edges[i][0] + '-' + edges[i][1]] = true;
      used[edges[i][1] + '-' + edges[i][0]] = true;
    }

    for (var e = 0; e < extraCount; e++) {
      var a = randomInt(rng, 0, rooms.length - 1);
      var options = [];
      for (var b = 0; b < rooms.length; b++) {
        if (a === b || used[a + '-' + b]) continue;
        var d = Math.abs(rooms[a].cx - rooms[b].cx) + Math.abs(rooms[a].cy - rooms[b].cy);
        options.push({ idx:b, d:d });
      }
      options.sort(function (x, y) { return x.d - y.d; });

      if (options.length) {
        var pick = options[randomInt(rng, 0, Math.min(1, options.length - 1))];
        used[a + '-' + pick.idx] = true;
        used[pick.idx + '-' + a] = true;
        edges.push([a, pick.idx]);
      }
    }
  }

  function styleParams(style) {
    if (style === 'fortress') return { mediumMinW:6, mediumMaxW:10, mediumMinH:5, mediumMaxH:8, secMinW:4, secMaxW:6, secMinH:4, secMaxH:6, extraEdges:0 };
    if (style === 'catacomb') return { mediumMinW:5, mediumMaxW:8, mediumMinH:4, mediumMaxH:6, secMinW:4, secMaxW:5, secMinH:4, secMaxH:5, extraEdges:0 };
    return { mediumMinW:5, mediumMaxW:9, mediumMinH:5, mediumMaxH:8, secMinW:4, secMaxW:6, secMinH:4, secMaxH:6, extraEdges:0 };
  }

  function collectCorridorCells(map, rooms) {
    var corridorCells = [];
    for (var y = 1; y < map.length - 1; y++) {
      for (var x = 1; x < map[0].length - 1; x++) {
        if (map[y][x] !== TILE.FLOOR) continue;
        if (roomIndexAt(rooms, x, y) !== -1) continue;
        corridorCells.push({ x:x, y:y });
      }
    }
    return corridorCells;
  }

  function findTilePosition(map, tileType) {
    for (var y = 0; y < map.length; y++) {
      for (var x = 0; x < map[0].length; x++) {
        if (map[y][x] === tileType) return { x:x, y:y };
      }
    }
    return null;
  }

  function countTiles(map, tileType) {
    var total = 0;
    for (var y = 0; y < map.length; y++) {
      for (var x = 0; x < map[0].length; x++) {
        if (map[y][x] === tileType) total++;
      }
    }
    return total;
  }

  function validateReachableObjectives(map, startPoint, requiredTiles) {
    var seen = floodFill(map, startPoint);
    for (var i = 0; i < requiredTiles.length; i++) {
      var pos = findTilePosition(map, requiredTiles[i]);
      if (!pos || !seen[pos.x + ',' + pos.y]) return false;
    }
    return true;
  }

  function cloneDoorStates(doors) {
    var copy = {};
    for (var key in doors) {
      copy[key] = {
        x: doors[key].x,
        y: doors[key].y,
        side: doors[key].side,
        roomIndex: doors[key].roomIndex,
        connectionTo: doors[key].connectionTo,
        open: !!doors[key].open,
        thresholdX: doors[key].thresholdX,
        thresholdY: doors[key].thresholdY
      };
    }
    return copy;
  }

  function isPassableForSolver(map, doors, x, y) {
    var tile = map[y][x];
    if (tile === TILE.WALL) return false;
    if (tile === TILE.DOOR) {
      var door = doors[tileKey(x, y)];
      return !!(door && door.open);
    }
    return true;
  }

  function computeSolverReachable(map, doors, starts) {
    var reachable = {};
    for (var i = 0; i < starts.length; i++) {
      var st = starts[i];
      if (!map[st.y] || map[st.y][st.x] === undefined) continue;
      if (!isPassableForSolver(map, doors, st.x, st.y)) continue;
      var partial = floodFill(map, { x: st.x, y: st.y }, function (x, y) {
        return isPassableForSolver(map, doors, x, y);
      });
      for (var key in partial) reachable[key] = true;
    }
    return reachable;
  }

  function canOpenDoorFromReachable(door, reachable) {
    var around = neighbors4(door.x, door.y);
    for (var i = 0; i < around.length; i++) {
      if (reachable[tileKey(around[i][0], around[i][1])]) return true;
    }
    return false;
  }

  function simulateDoorExploration(map, doors, starts) {
    var doorStates = cloneDoorStates(doors);
    var changed = true;
    var safety = 0;
    var reachable = {};

    while (changed && safety++ < 128) {
      changed = false;
      reachable = computeSolverReachable(map, doorStates, starts);
      for (var key in doorStates) {
        if (doorStates[key].open) continue;
        if (canOpenDoorFromReachable(doorStates[key], reachable)) {
          doorStates[key].open = true;
          changed = true;
        }
      }
    }

    reachable = computeSolverReachable(map, doorStates, starts);
    return { reachable: reachable, doors: doorStates };
  }

  function validateGeneratedLevel(map, rooms, heroes, doors, enemies) {
    var starts = heroes && heroes.length ? heroes.map(function (h) { return { x:h.x, y:h.y }; }) : [ { x: rooms[0].cx, y: rooms[0].cy } ];
    var simulation = simulateDoorExploration(map, doors, starts);
    var reachable = simulation.reachable;
    var failures = [];

    function requireTile(tileType, code) {
      var pos = findTilePosition(map, tileType);
      if (!pos) {
        failures.push(code + '_missing');
        return;
      }
      if (!reachable[tileKey(pos.x, pos.y)]) failures.push(code + '_unreachable');
    }

    function countDoorsForRoom(roomIndex, sourceDoors) {
      var total = 0;
      for (var key in sourceDoors) {
        if (sourceDoors[key].roomIndex === roomIndex) total++;
      }
      return total;
    }

    function roomHasReachableDoor(roomIndex, sourceDoors, sourceReachable) {
      for (var key in sourceDoors) {
        var d = sourceDoors[key];
        if (d.roomIndex !== roomIndex) continue;
        if (sourceReachable[tileKey(d.thresholdX, d.thresholdY)] || sourceReachable[tileKey(d.x, d.y)]) return true;
      }
      return false;
    }

    if (!startRoomHasImmediateExit(map, rooms, simulation.doors)) failures.push('start_room_without_exit');
    if (!countDoorsForRoom(0, doors) && !startRoomHasImmediateExit(map, rooms, simulation.doors)) failures.push('start_room_without_door');
    if (!roomHasReachableDoor(0, simulation.doors, reachable) && !startRoomHasImmediateExit(map, rooms, simulation.doors)) failures.push('start_room_trapped');

    requireTile(TILE.CHEST, 'chest');
    requireTile(TILE.EXIT, 'exit');

    if (enemies && enemies.length) {
      for (var i = 0; i < enemies.length; i++) {
        if (!enemies[i].boss) continue;
        if (!reachable[tileKey(enemies[i].x, enemies[i].y)]) failures.push('boss_unreachable');
        break;
      }
    }

    var roomCentersMissing = 0;
    for (var r = 0; r < rooms.length; r++) {
      if (!reachable[tileKey(rooms[r].cx, rooms[r].cy)]) roomCentersMissing++;
    }
    if (roomCentersMissing) failures.push('isolated_rooms_' + roomCentersMissing);

    return {
      ok: failures.length === 0,
      failures: failures,
      openedDoorCount: Object.keys(simulation.doors).filter(function (k) { return simulation.doors[k].open; }).length
    };
  }

  function buildEntityIndex(entities) {
    var index = {};
    for (var i = 0; i < entities.length; i++) {
      index[entities[i].x + ',' + entities[i].y] = entities[i];
    }
    return index;
  }

  function openFloorNeighbors(map, x, y, ignoreKey) {
    var count = 0;
    var ns = neighbors4(x, y);
    for (var i = 0; i < ns.length; i++) {
      var nx = ns[i][0], ny = ns[i][1];
      if (!map[ny] || map[ny][nx] === undefined) continue;
      if (ignoreKey && tileKey(nx, ny) === ignoreKey) continue;
      if (map[ny][nx] !== TILE.WALL) count++;
    }
    return count;
  }

  function isWallAt(map, x, y) {
    return !map[y] || map[y][x] === undefined || map[y][x] === TILE.WALL;
  }

  function isFloorLikeAt(map, x, y) {
    return !!(map[y] && map[y][x] !== undefined && map[y][x] !== TILE.WALL);
  }

  function corridorForwardSteps(map, rooms, x, y, dx, dy, limit) {
    var steps = 0;
    var cx = x;
    var cy = y;
    while (steps < limit) {
      if (!isFloorLikeAt(map, cx, cy)) break;
      if (roomIndexAt(rooms, cx, cy) !== -1) break;
      if (dx !== 0) {
        if (!isWallAt(map, cx, cy - 1) || !isWallAt(map, cx, cy + 1)) break;
      } else {
        if (!isWallAt(map, cx - 1, cy) || !isWallAt(map, cx + 1, cy)) break;
      }
      steps++;
      cx += dx;
      cy += dy;
    }
    return steps;
  }

  function buildPlacedDoor(map, rooms, door) {
    var normal = doorNormal(door.side);
    var doorX = door.x;
    var doorY = door.y;
    var insideX = doorX - normal.dx;
    var insideY = doorY - normal.dy;
    var outsideX = doorX + normal.dx;
    var outsideY = doorY + normal.dy;
    var forwardX = outsideX + normal.dx;
    var forwardY = outsideY + normal.dy;

    if (!map[insideY] || !map[doorY] || !map[outsideY] || !map[forwardY]) return null;
    if (roomIndexAt(rooms, insideX, insideY) !== door.roomIndex) return null;
    if (roomIndexAt(rooms, doorX, doorY) !== door.roomIndex) return null;
    if (roomIndexAt(rooms, outsideX, outsideY) !== -1) return null;
    if (map[insideY][insideX] !== TILE.FLOOR) return null;
    if (map[outsideY][outsideX] !== TILE.FLOOR) return null;
    if (map[forwardY][forwardX] !== TILE.FLOOR) return null;
    if (roomIndexAt(rooms, forwardX, forwardY) !== -1) return null;

    if (normal.axis === 'v') {
      if (!isWallAt(map, doorX, doorY - 1) || !isWallAt(map, doorX, doorY + 1)) return null;
      if (!isWallAt(map, outsideX, outsideY - 1) || !isWallAt(map, outsideX, outsideY + 1)) return null;
    } else {
      if (!isWallAt(map, doorX - 1, doorY) || !isWallAt(map, doorX + 1, doorY)) return null;
      if (!isWallAt(map, outsideX - 1, outsideY) || !isWallAt(map, outsideX + 1, outsideY)) return null;
    }

    if (corridorForwardSteps(map, rooms, outsideX, outsideY, normal.dx, normal.dy, 2) < 2) return null;

    return {
      x: doorX,
      y: doorY,
      side: door.side,
      roomIndex: door.roomIndex,
      connectionTo: door.connectionTo,
      open: !!door.open,
      thresholdX: insideX,
      thresholdY: insideY
    };
  }

  function finalizeDoors(map, rooms, doorSpots) {
    var validated = {};
    var perRoom = {};
    for (var key in doorSpots) {
      var placed = buildPlacedDoor(map, rooms, doorSpots[key]);
      if (!placed) continue;
      var roomKey = String(placed.roomIndex);
      if (perRoom[roomKey]) continue;
      map[placed.y][placed.x] = TILE.DOOR;
      validated[tileKey(placed.x, placed.y)] = placed;
      perRoom[roomKey] = true;
    }
    return validated;
  }

  function isPassableForVisibility(currentState, x, y) {
    var tile = currentState.map[y][x];
    if (tile === TILE.WALL) return false;
    if (tile === TILE.DOOR) {
      var door = currentState.doors[tileKey(x, y)];
      return !!(door && door.open);
    }
    return true;
  }

  function normalizeDungeonPlacement(map, rooms, heroes, enemies, doorSpots) {
    var minX = map[0].length - 1;
    var minY = map.length - 1;
    var found = false;
    for (var y = 1; y < map.length - 1; y++) {
      for (var x = 1; x < map[0].length - 1; x++) {
        if (map[y][x] !== TILE.WALL) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          found = true;
        }
      }
    }
    if (!found) return;

    var shiftX = 1 - minX;
    var shiftY = 1 - minY;
    if (!shiftX && !shiftY) return;

    var newMap = createFilledMap(map[0].length, map.length);
    for (var yy = 1; yy < map.length - 1; yy++) {
      for (var xx = 1; xx < map[0].length - 1; xx++) {
        if (map[yy][xx] === TILE.WALL) continue;
        newMap[yy + shiftY][xx + shiftX] = map[yy][xx];
      }
    }
    for (var row = 0; row < map.length; row++) map[row] = newMap[row].slice();

    function shiftPoint(pt) {
      pt.x += shiftX;
      pt.y += shiftY;
      if (pt.cx !== undefined) pt.cx += shiftX;
      if (pt.cy !== undefined) pt.cy += shiftY;
      if (pt.thresholdX !== undefined) pt.thresholdX += shiftX;
      if (pt.thresholdY !== undefined) pt.thresholdY += shiftY;
    }

    for (var r = 0; r < rooms.length; r++) shiftPoint(rooms[r]);
    for (var h = 0; h < heroes.length; h++) shiftPoint(heroes[h]);
    for (var e = 0; e < enemies.length; e++) shiftPoint(enemies[e]);

    var shiftedDoors = {};
    for (var key in doorSpots) {
      var door = doorSpots[key];
      shiftPoint(door);
      shiftedDoors[tileKey(door.x, door.y)] = door;
    }
    for (var oldKey in doorSpots) delete doorSpots[oldKey];
    for (var newKey in shiftedDoors) doorSpots[newKey] = shiftedDoors[newKey];
  }

  function computeVisibility(currentState) {
    var visible = {};
    var starts = currentState.heroes && currentState.heroes.length ? currentState.heroes.slice() : [ { x: currentState.rooms[0].cx, y: currentState.rooms[0].cy } ];

    for (var s = 0; s < starts.length; s++) {
      var partial = floodFill(currentState.map, { x: starts[s].x, y: starts[s].y }, function (x, y) {
        return isPassableForVisibility(currentState, x, y);
      });
      for (var partialKey in partial) visible[partialKey] = true;
    }

    for (var key in visible) {
      var parts = key.split(',');
      var x = parseInt(parts[0], 10);
      var y = parseInt(parts[1], 10);
      var ns = neighbors4(x, y);
      for (var i = 0; i < ns.length; i++) {
        var nx = ns[i][0], ny = ns[i][1];
        if (ny < 0 || ny >= currentState.height || nx < 0 || nx >= currentState.width) continue;
        if (currentState.map[ny][nx] === TILE.DOOR) visible[tileKey(nx, ny)] = true;
      }
    }

    // Also reveal wall tiles adjacent to any visible tile (room boundaries)
    var wallReveal = {};
    for (var vk in visible) {
      var vp = vk.split(',');
      var vx = parseInt(vp[0], 10);
      var vy = parseInt(vp[1], 10);
      var wns = neighbors4(vx, vy);
      for (var wi = 0; wi < wns.length; wi++) {
        var wnx = wns[wi][0], wny = wns[wi][1];
        if (wny < 0 || wny >= currentState.height || wnx < 0 || wnx >= currentState.width) continue;
        if (currentState.map[wny][wnx] === TILE.WALL) wallReveal[tileKey(wnx, wny)] = true;
      }
    }
    for (var wrk in wallReveal) visible[wrk] = true;

    currentState.visible = visible;
  }

  /* ===================================================================
     ROOM TYPES — 12 distinct dungeon room archetypes
     Each has: id, name, bg color, floor texture SVG, decoration SVGs
     =================================================================== */
  var ROOM_TYPES = [
    { id:'cripta', name:'Cripta', bg:'#6a6272',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><rect x="1" y="1" width="30" height="30" rx="2" fill="rgba(0,0,0,.12)"/><rect x="33" y="33" width="30" height="30" rx="2" fill="rgba(0,0,0,.12)"/><rect x="33" y="1" width="30" height="30" rx="2" fill="rgba(255,255,255,.08)"/><rect x="1" y="33" width="30" height="30" rx="2" fill="rgba(255,255,255,.08)"/><path d="M0 32h64M32 0v64" stroke="rgba(0,0,0,.18)" stroke-width="2"/><path d="M1 31h62M31 1v62" stroke="rgba(255,255,255,.06)" stroke-width="1"/></svg>'
    },
    { id:'biblioteca', name:'Biblioteca', bg:'#8a6a4a',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><rect x="1" y="1" width="62" height="14" rx="1" fill="rgba(0,0,0,.1)"/><rect x="1" y="17" width="62" height="14" rx="1" fill="rgba(255,255,255,.07)"/><rect x="1" y="33" width="62" height="14" rx="1" fill="rgba(0,0,0,.1)"/><rect x="1" y="49" width="62" height="14" rx="1" fill="rgba(255,255,255,.07)"/><path d="M0 16h64M0 32h64M0 48h64" stroke="rgba(0,0,0,.2)" stroke-width="1.5"/><path d="M0 17h64M0 33h64M0 49h64" stroke="rgba(255,255,255,.06)" stroke-width=".8"/></svg>'
    },
    { id:'armeria', name:'Armería', bg:'#7a8088',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><rect x="1" y="1" width="30" height="30" fill="rgba(255,255,255,.07)"/><rect x="33" y="1" width="30" height="30" fill="rgba(0,0,0,.1)"/><rect x="1" y="33" width="30" height="30" fill="rgba(0,0,0,.1)"/><rect x="33" y="33" width="30" height="30" fill="rgba(255,255,255,.07)"/><path d="M32 0v64M0 32h64" stroke="rgba(0,0,0,.22)" stroke-width="2"/><path d="M31 0v64M0 31h64" stroke="rgba(255,255,255,.08)" stroke-width="1"/><circle cx="32" cy="32" r="3" fill="rgba(255,255,255,.06)"/></svg>'
    },
    { id:'trono', name:'Sala del Trono', bg:'#a89030',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><path d="M32 0L64 32L32 64L0 32Z" fill="rgba(0,0,0,.1)"/><path d="M32 4L60 32L32 60L4 32Z" fill="rgba(255,255,255,.06)"/><path d="M32 0L64 32L32 64L0 32Z" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2"/><path d="M0 0h64v64H0z" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="1.5"/></svg>'
    },
    { id:'mazmorra', name:'Mazmorra', bg:'#4a4e56',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><rect x="1" y="1" width="20" height="30" rx="2" fill="rgba(0,0,0,.14)"/><rect x="23" y="1" width="20" height="30" rx="2" fill="rgba(255,255,255,.06)"/><rect x="43" y="1" width="20" height="30" rx="2" fill="rgba(0,0,0,.10)"/><rect x="11" y="33" width="20" height="30" rx="2" fill="rgba(255,255,255,.06)"/><rect x="33" y="33" width="20" height="30" rx="2" fill="rgba(0,0,0,.14)"/><rect x="53" y="33" width="10" height="30" rx="1" fill="rgba(255,255,255,.05)"/><rect x="1" y="33" width="8" height="30" rx="1" fill="rgba(0,0,0,.08)"/><path d="M0 32h64" stroke="rgba(0,0,0,.2)" stroke-width="2"/><path d="M22 0v32M44 0v32M11 32v32M33 32v32M53 32v32" stroke="rgba(0,0,0,.15)" stroke-width="1.5"/></svg>'
    },
    { id:'cocina', name:'Cocina', bg:'#b08050',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><rect x="1" y="1" width="30" height="30" rx="1" fill="rgba(255,255,255,.1)"/><rect x="33" y="1" width="30" height="30" rx="1" fill="rgba(0,0,0,.08)"/><rect x="1" y="33" width="30" height="30" rx="1" fill="rgba(0,0,0,.08)"/><rect x="33" y="33" width="30" height="30" rx="1" fill="rgba(255,255,255,.1)"/><path d="M32 0v64M0 32h64" stroke="rgba(0,0,0,.2)" stroke-width="2"/><path d="M33 0v64M0 33h64" stroke="rgba(255,255,255,.05)" stroke-width=".8"/></svg>'
    },
    { id:'laboratorio', name:'Laboratorio', bg:'#4a7a5a',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><polygon points="32,2 60,18 60,46 32,62 4,46 4,18" fill="rgba(0,0,0,.1)" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/><polygon points="32,8 54,21 54,43 32,56 10,43 10,21" fill="rgba(255,255,255,.06)"/><path d="M32 2v60M4 18l56 28M60 18L4 46" stroke="rgba(0,0,0,.08)" stroke-width=".8"/></svg>'
    },
    { id:'templo', name:'Templo', bg:'#6a80a8',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><rect x="1" y="1" width="62" height="62" rx="4" fill="rgba(255,255,255,.06)"/><rect x="4" y="4" width="56" height="56" rx="2" fill="rgba(0,0,0,.08)"/><path d="M0 32h64M32 0v64" stroke="rgba(255,255,255,.1)" stroke-width="1.5"/><path d="M16 16h32v32H16z" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="1"/></svg>'
    },
    { id:'jardin', name:'Jardín', bg:'#5a8848',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><rect x="1" y="1" width="19" height="19" rx="6" fill="rgba(0,0,0,.1)"/><rect x="22" y="1" width="19" height="19" rx="6" fill="rgba(255,255,255,.07)"/><rect x="43" y="1" width="19" height="19" rx="6" fill="rgba(0,0,0,.08)"/><rect x="1" y="22" width="19" height="19" rx="6" fill="rgba(255,255,255,.06)"/><rect x="22" y="22" width="19" height="19" rx="6" fill="rgba(0,0,0,.12)"/><rect x="43" y="22" width="19" height="19" rx="6" fill="rgba(255,255,255,.07)"/><rect x="1" y="43" width="19" height="19" rx="6" fill="rgba(0,0,0,.08)"/><rect x="22" y="43" width="19" height="19" rx="6" fill="rgba(255,255,255,.06)"/><rect x="43" y="43" width="19" height="19" rx="6" fill="rgba(0,0,0,.1)"/><path d="M21 0v64M42 0v64M0 21h64M0 42h64" stroke="rgba(0,0,0,.12)" stroke-width="1.2"/></svg>'
    },
    { id:'forja', name:'Forja', bg:'#8a4a30',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><rect x="1" y="1" width="30" height="14" rx="1" fill="rgba(0,0,0,.12)"/><rect x="33" y="1" width="30" height="14" rx="1" fill="rgba(255,255,255,.06)"/><rect x="17" y="17" width="30" height="14" rx="1" fill="rgba(0,0,0,.1)"/><rect x="49" y="17" width="14" height="14" rx="1" fill="rgba(255,255,255,.06)"/><rect x="1" y="17" width="14" height="14" rx="1" fill="rgba(255,255,255,.05)"/><rect x="1" y="33" width="30" height="14" rx="1" fill="rgba(255,255,255,.06)"/><rect x="33" y="33" width="30" height="14" rx="1" fill="rgba(0,0,0,.12)"/><rect x="17" y="49" width="30" height="14" rx="1" fill="rgba(255,255,255,.06)"/><rect x="1" y="49" width="14" height="14" rx="1" fill="rgba(0,0,0,.1)"/><rect x="49" y="49" width="14" height="14" rx="1" fill="rgba(0,0,0,.08)"/><path d="M0 16h64M0 32h64M0 48h64" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/><path d="M32 0v16M16 16v16M48 16v16M32 32v16M16 48v16M48 48v16" stroke="rgba(0,0,0,.15)" stroke-width="1.2"/></svg>'
    },
    { id:'bodega', name:'Bodega', bg:'#6a5038',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><rect x="1" y="1" width="62" height="20" rx="1" fill="rgba(0,0,0,.1)"/><rect x="1" y="23" width="62" height="18" rx="1" fill="rgba(255,255,255,.07)"/><rect x="1" y="43" width="62" height="20" rx="1" fill="rgba(0,0,0,.1)"/><path d="M0 22h64M0 42h64" stroke="rgba(0,0,0,.2)" stroke-width="2"/><path d="M0 23h64M0 43h64" stroke="rgba(255,255,255,.05)" stroke-width=".8"/><path d="M20 0v22M44 0v22M32 22v20M20 42v22M44 42v22" stroke="rgba(0,0,0,.12)" stroke-width="1"/></svg>'
    },
    { id:'mapas', name:'Sala de Mapas', bg:'#a89868',
      texture:'<svg viewBox="0 0 64 64" class="room-tex"><rect x="1" y="1" width="30" height="30" rx="3" fill="rgba(0,0,0,.09)"/><rect x="33" y="1" width="30" height="30" rx="3" fill="rgba(255,255,255,.07)"/><rect x="1" y="33" width="30" height="30" rx="3" fill="rgba(255,255,255,.07)"/><rect x="33" y="33" width="30" height="30" rx="3" fill="rgba(0,0,0,.09)"/><path d="M32 0v64M0 32h64" stroke="rgba(0,0,0,.16)" stroke-width="2"/><path d="M31 0v64M0 31h64" stroke="rgba(255,255,255,.06)" stroke-width=".8"/><path d="M16 16l32 32M48 16L16 48" stroke="rgba(0,0,0,.05)" stroke-width=".6"/></svg>'
    }
  ];

  function weightedDecoChoice(rng, decos) {
    if (!decos || !decos.length) return '';
    var total = 0;
    for (var d = 0; d < decos.length; d++) total += decos[d].w;
    var roll = rng() * total;
    var acc = 0;
    for (var d2 = 0; d2 < decos.length; d2++) {
      acc += decos[d2].w;
      if (roll <= acc) return decos[d2].svg;
    }
    return decos[0].svg;
  }


function generateDungeon(width, height, enemyCount, heroCount, roomCount, style) {
  var rng = createRng();
  width = clamp(width, 18, 80);
  height = clamp(height, 10, 50);
  enemyCount = clamp(enemyCount, 0, 40);
  heroCount = clamp(heroCount, 1, 4);
  roomCount = clamp(roomCount, 2, 25);

  var map = createFilledMap(width, height);

  /* =========================================================
     BSP TREE — subdivide the interior into rooms
     ========================================================= */
  var bspNodes = [];
  function BSPNode(x, y, w, h, parent) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.left = null; this.right = null;
    this.splitAxis = null; // 'h' or 'v'
    this.splitPos = 0;
    this.parent = parent || null;
    this.roomIndex = -1;
    this.id = bspNodes.length;
    bspNodes.push(this);
  }

  // The BSP covers the ENTIRE board — rooms extend to the edges, no wall border
  var root = new BSPNode(0, 0, width, height, null);
  var leaves = [root];
  var MIN_ROOM = 3; // minimum room dimension in tiles

  while (leaves.length < roomCount) {
    // Sort: split the largest leaf first
    leaves.sort(function (a, b) { return (b.w * b.h) - (a.w * a.h); });
    var didSplit = false;

    for (var li = 0; li < leaves.length && leaves.length < roomCount; li++) {
      var leaf = leaves[li];
      var canH = leaf.h >= MIN_ROOM * 2 + 1;
      var canV = leaf.w >= MIN_ROOM * 2 + 1;
      if (!canH && !canV) continue;

      var axis;
      if (canH && canV) {
        if (leaf.w > leaf.h * 1.3) axis = 'v';
        else if (leaf.h > leaf.w * 1.3) axis = 'h';
        else axis = rng() < 0.5 ? 'h' : 'v';
      } else {
        axis = canV ? 'v' : 'h';
      }

      var pos;
      if (axis === 'v') {
        var minP = leaf.x + MIN_ROOM;
        var maxP = leaf.x + leaf.w - MIN_ROOM - 1;
        if (minP > maxP) continue;
        // Asymmetric splits: bias towards 30/70 or 40/60 for varied room sizes
        var range = maxP - minP;
        var bias = rng();
        if (bias < 0.35) pos = randomInt(rng, minP, minP + Math.floor(range * 0.35));
        else if (bias < 0.7) pos = randomInt(rng, maxP - Math.floor(range * 0.35), maxP);
        else pos = randomInt(rng, minP, maxP);
        leaf.splitAxis = 'v';
        leaf.splitPos = pos;
        leaf.left  = new BSPNode(leaf.x, leaf.y, pos - leaf.x, leaf.h, leaf);
        leaf.right = new BSPNode(pos + 1, leaf.y, leaf.x + leaf.w - pos - 1, leaf.h, leaf);
      } else {
        var minP = leaf.y + MIN_ROOM;
        var maxP = leaf.y + leaf.h - MIN_ROOM - 1;
        if (minP > maxP) continue;
        var range = maxP - minP;
        var bias = rng();
        if (bias < 0.35) pos = randomInt(rng, minP, minP + Math.floor(range * 0.35));
        else if (bias < 0.7) pos = randomInt(rng, maxP - Math.floor(range * 0.35), maxP);
        else pos = randomInt(rng, minP, maxP);
        leaf.splitAxis = 'h';
        leaf.splitPos = pos;
        leaf.left  = new BSPNode(leaf.x, leaf.y, leaf.w, pos - leaf.y, leaf);
        leaf.right = new BSPNode(leaf.x, pos + 1, leaf.w, leaf.y + leaf.h - pos - 1, leaf);
      }

      leaves.splice(li, 1, leaf.left, leaf.right);
      didSplit = true;
      break; // restart loop after split
    }
    if (!didSplit) break; // no more splits possible
  }

  /* =========================================================
     Sort leaves spatially: top-left → bottom-right
     Start room = first leaf, boss room = last leaf
     ========================================================= */
  leaves.sort(function (a, b) {
    return (a.y + a.x * 0.5) - (b.y + b.x * 0.5);
  });

  var rooms = [];
  var roomIndexMap = {};  // tileKey -> room index
  var roomColorMap = {};  // tileKey -> hex color string
  var roomTypeMap = {};   // tileKey -> room type id
  var decorationMap = {}; // tileKey -> SVG string
  var textureMap = {};    // room index -> texture SVG string

  // Shuffle room type assignment so adjacent rooms get different types
  var typeOrder = [];
  for (var ti = 0; ti < ROOM_TYPES.length; ti++) typeOrder.push(ti);
  for (var ts = typeOrder.length - 1; ts > 0; ts--) {
    var tj = randomInt(rng, 0, ts);
    var tt = typeOrder[ts]; typeOrder[ts] = typeOrder[tj]; typeOrder[tj] = tt;
  }

  for (var i = 0; i < leaves.length; i++) {
    var lf = leaves[i];
    var typeIdx = typeOrder[i % typeOrder.length];
    var roomType = ROOM_TYPES[typeIdx];
    var room = {
      x: lf.x, y: lf.y, w: lf.w, h: lf.h,
      cx: lf.x + Math.floor(lf.w / 2),
      cy: lf.y + Math.floor(lf.h / 2),
      kind: 'room',
      roomType: roomType.id,
      roomTypeIndex: typeIdx
    };
    rooms.push(room);
    lf.roomIndex = i;
    textureMap[i] = roomType.texture;

    // Carve floor and record mappings
    var roomFloorCells = [];
    for (var ry = lf.y; ry < lf.y + lf.h; ry++) {
      for (var rx = lf.x; rx < lf.x + lf.w; rx++) {
        map[ry][rx] = TILE.FLOOR;
        var tk = tileKey(rx, ry);
        roomIndexMap[tk] = i;
        roomColorMap[tk] = roomType.bg;
        roomTypeMap[tk] = roomType.id;
        roomFloorCells.push(tk);
      }
    }
  }

  // Tag start / boss rooms
  var startRoom = rooms[0];
  startRoom.kind = 'start';
  startRoom.specialStart = true;

  var bossRoom = rooms[rooms.length - 1];
  bossRoom.kind = 'boss';
  bossRoom.specialBoss = true;
  bossRoom.specialExit = true;

  // Force boss room to "trono" type
  var tronoType = ROOM_TYPES[3]; // trono
  bossRoom.roomType = tronoType.id;
  bossRoom.roomTypeIndex = 3;
  textureMap[rooms.length - 1] = tronoType.texture;
  for (var by = bossRoom.y; by < bossRoom.y + bossRoom.h; by++) {
    for (var bx = bossRoom.x; bx < bossRoom.x + bossRoom.w; bx++) {
      var bk = tileKey(bx, by);
      roomColorMap[bk] = tronoType.bg;
      roomTypeMap[bk] = tronoType.id;
    }
  }

  /* =========================================================
     DOOR PLACEMENT — Tree connectivity:
     1. Collect all possible room-pair connections from BSP walls
     2. Build main path from start → boss
     3. Connect remaining rooms as branches
     4. Add a few extra shortcuts (~20%)
     5. Place exactly 1 door per chosen connection
     ========================================================= */
  var doors = {};

  function placeBSPDoor(cand) {
    var k = tileKey(cand.x, cand.y);
    if (doors[k]) return;
    var side, thX, thY;
    if (cand.axis === 'v') {
      side = 'right'; thX = cand.x - 1; thY = cand.y;
    } else {
      side = 'bottom'; thX = cand.x; thY = cand.y - 1;
    }
    map[cand.y][cand.x] = TILE.DOOR;
    doors[k] = {
      x: cand.x, y: cand.y,
      side: side,
      roomIndex: cand.roomA,
      connectionTo: cand.roomB,
      open: false,
      thresholdX: thX,
      thresholdY: thY
    };
  }

  // Step 1: Collect all possible connections from BSP split walls
  var allPairCandidates = {}; // "roomA:roomB" -> [candidates]

  function collectCandidatesOnSplit(node) {
    if (!node || !node.left || !node.right) return;

    var candidates = [];
    if (node.splitAxis === 'v') {
      var sx = node.splitPos;
      for (var sy = node.y; sy < node.y + node.h; sy++) {
        if (map[sy][sx] !== TILE.WALL) continue;
        var hasL = sx > 0 && map[sy][sx - 1] === TILE.FLOOR;
        var hasR = sx < width - 1 && map[sy][sx + 1] === TILE.FLOOR;
        if (hasL && hasR) {
          var li2 = roomIndexMap[tileKey(sx - 1, sy)];
          var ri2 = roomIndexMap[tileKey(sx + 1, sy)];
          if (li2 !== undefined && ri2 !== undefined && li2 !== ri2) {
            candidates.push({ x: sx, y: sy, axis: 'v', roomA: li2, roomB: ri2 });
          }
        }
      }
    } else {
      var sy2 = node.splitPos;
      for (var sx2 = node.x; sx2 < node.x + node.w; sx2++) {
        if (map[sy2][sx2] !== TILE.WALL) continue;
        var hasT = sy2 > 0 && map[sy2 - 1][sx2] === TILE.FLOOR;
        var hasB = sy2 < height - 1 && map[sy2 + 1][sx2] === TILE.FLOOR;
        if (hasT && hasB) {
          var ti2 = roomIndexMap[tileKey(sx2, sy2 - 1)];
          var bi2 = roomIndexMap[tileKey(sx2, sy2 + 1)];
          if (ti2 !== undefined && bi2 !== undefined && ti2 !== bi2) {
            candidates.push({ x: sx2, y: sy2, axis: 'h', roomA: ti2, roomB: bi2 });
          }
        }
      }
    }

    for (var c = 0; c < candidates.length; c++) {
      var cd = candidates[c];
      var pk = Math.min(cd.roomA, cd.roomB) + ':' + Math.max(cd.roomA, cd.roomB);
      if (!allPairCandidates[pk]) allPairCandidates[pk] = [];
      allPairCandidates[pk].push(cd);
    }

    collectCandidatesOnSplit(node.left);
    collectCandidatesOnSplit(node.right);
  }

  collectCandidatesOnSplit(root);

  // Step 2: Build adjacency graph
  var adjacency = {};
  for (var i = 0; i < rooms.length; i++) adjacency[i] = [];
  for (var pk in allPairCandidates) {
    var parts = pk.split(':');
    var a = parseInt(parts[0], 10);
    var b = parseInt(parts[1], 10);
    adjacency[a].push(b);
    adjacency[b].push(a);
  }

  // Step 3: BFS from start(0) to boss(last) to find main path
  var startIdx = 0;
  var bossIdx = rooms.length - 1;
  var bfsQueue = [startIdx];
  var bfsParent = {};
  bfsParent[startIdx] = -1;
  var bfsVisited = {};
  bfsVisited[startIdx] = true;
  var qi = 0;
  while (qi < bfsQueue.length) {
    var cur = bfsQueue[qi++];
    var neighbors = adjacency[cur] || [];
    for (var ni = 0; ni < neighbors.length; ni++) {
      var nb = neighbors[ni];
      if (bfsVisited[nb]) continue;
      bfsVisited[nb] = true;
      bfsParent[nb] = cur;
      bfsQueue.push(nb);
    }
  }

  // Reconstruct main path
  var mainPath = [];
  var trace = bossIdx;
  while (trace !== -1 && bfsParent[trace] !== undefined) {
    mainPath.unshift(trace);
    trace = bfsParent[trace];
  }

  // Step 4: Build connection tree
  var chosenConnections = {}; // "a:b" -> true
  function addConnection(a, b) {
    var k = Math.min(a, b) + ':' + Math.max(a, b);
    chosenConnections[k] = true;
  }

  // Add main path connections
  for (var mi = 1; mi < mainPath.length; mi++) {
    addConnection(mainPath[mi - 1], mainPath[mi]);
  }

  // Connect any unconnected rooms to nearest connected room (branches)
  var connected = {};
  for (var pi = 0; pi < mainPath.length; pi++) connected[mainPath[pi]] = true;

  for (var ri = 0; ri < rooms.length; ri++) {
    if (connected[ri]) continue;
    // Find a neighbor that IS connected
    var neighbors2 = adjacency[ri] || [];
    var found = false;
    for (var n2 = 0; n2 < neighbors2.length; n2++) {
      if (connected[neighbors2[n2]]) {
        addConnection(ri, neighbors2[n2]);
        connected[ri] = true;
        found = true;
        break;
      }
    }
    if (!found) {
      // BFS to find nearest connected room
      var bfs2 = [ri];
      var vis2 = {};
      vis2[ri] = true;
      var par2 = {};
      par2[ri] = -1;
      var found2 = -1;
      var q2 = 0;
      while (q2 < bfs2.length && found2 < 0) {
        var c2 = bfs2[q2++];
        var nb2 = adjacency[c2] || [];
        for (var j2 = 0; j2 < nb2.length; j2++) {
          if (vis2[nb2[j2]]) continue;
          vis2[nb2[j2]] = true;
          par2[nb2[j2]] = c2;
          if (connected[nb2[j2]]) { found2 = nb2[j2]; break; }
          bfs2.push(nb2[j2]);
        }
      }
      if (found2 >= 0) {
        // Trace back and connect the whole chain
        var t2 = found2;
        while (par2[t2] !== undefined && par2[t2] !== -1) {
          addConnection(t2, par2[t2]);
          connected[t2] = true;
          t2 = par2[t2];
        }
        connected[ri] = true;
      }
    }
  }

  // Step 5: Add a few extra shortcut connections (~20% of room count)
  var extraCount = Math.max(1, Math.floor(rooms.length * 0.2));
  var extraPairs = [];
  for (var epk in allPairCandidates) {
    if (!chosenConnections[epk]) extraPairs.push(epk);
  }
  // Shuffle extras
  for (var ei = extraPairs.length - 1; ei > 0; ei--) {
    var ej = randomInt(rng, 0, ei);
    var tmp = extraPairs[ei]; extraPairs[ei] = extraPairs[ej]; extraPairs[ej] = tmp;
  }
  for (var ek = 0; ek < Math.min(extraCount, extraPairs.length); ek++) {
    chosenConnections[extraPairs[ek]] = true;
  }

  // Step 6: Place doors only for chosen connections
  for (var cpk in chosenConnections) {
    var group = allPairCandidates[cpk];
    if (!group || !group.length) continue;
    var mid = Math.floor(group.length / 2);
    placeBSPDoor(group[mid]);
  }

  /* =========================================================
     ENTITY PLACEMENT
     ========================================================= */
  function key(x, y) { return x + ',' + y; }
  var used = {};

  function adjacentToDoor(x, y) {
    var ns = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
    for (var i = 0; i < ns.length; i++) {
      if (map[ns[i][1]] && map[ns[i][1]][ns[i][0]] === TILE.DOOR) return true;
    }
    return false;
  }

  function availableCellsInRoom(room) {
    var out = [];
    for (var y = room.y; y < room.y + room.h; y++) {
      for (var x = room.x; x < room.x + room.w; x++) {
        if (map[y][x] === TILE.FLOOR && !used[key(x, y)]) out.push({ x: x, y: y });
      }
    }
    return out;
  }

  function availableCellsForEnemy(room) {
    return availableCellsInRoom(room).filter(function(c) { return !adjacentToDoor(c.x, c.y); });
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var si = copy.length - 1; si > 0; si--) {
      var sj = randomInt(rng, 0, si);
      var tmp = copy[si]; copy[si] = copy[sj]; copy[sj] = tmp;
    }
    return copy;
  }

  // --- Heroes ---
  var heroes = [];
  var heroCells = availableCellsInRoom(startRoom);
  for (var h = 0; h < heroCount; h++) {
    var hs = heroCells[h % heroCells.length];
    var ht = heroTemplates[h % heroTemplates.length];
    heroes.push(syncHeroDerivedStats({
      id: ht.id + '_' + (h + 1), label: ht.label, name: ht.name,
      hp: ht.hp, maxHp: ht.maxHp, attackBase: ht.atk, defenseBase: ht.def,
      atk: ht.atk, def: ht.def, moveBonus: ht.moveBonus,
      baseRange: ht.range || 1, range: ht.range || 1,
      equipment: createHeroEquipment(), inventory: createHeroInventory(),
      effects: [], x: hs.x, y: hs.y
    }));
    used[key(hs.x, hs.y)] = true;
  }

  // --- Exit in boss room ---
  var exitChoices = availableCellsInRoom(bossRoom);
  if (exitChoices.length) {
    var exitPos = exitChoices[exitChoices.length - 1];
    map[exitPos.y][exitPos.x] = TILE.EXIT;
    used[key(exitPos.x, exitPos.y)] = true;
  }

  // --- Chests ---
  var chestLootByCoord = {};
  var totalChestsToPlace = heroCount + 2;
  var chestPlan = chestDistribution(totalChestsToPlace);
  function nextChestTier() { return chestPlan.length ? chestPlan.shift() : 'normal'; }

  var nonStartRooms = rooms.slice(1).slice().sort(function (a, b) {
    var da = Math.abs(a.cx - startRoom.cx) + Math.abs(a.cy - startRoom.cy);
    var db = Math.abs(b.cx - startRoom.cx) + Math.abs(b.cy - startRoom.cy);
    return db - da;
  });

  var placedChests = 0;
  for (var ci = 0; ci < nonStartRooms.length && placedChests < totalChestsToPlace; ci++) {
    var chestCells = availableCellsInRoom(nonStartRooms[ci]);
    if (!chestCells.length) continue;
    var chestPos = chestCells[randomInt(rng, 0, chestCells.length - 1)];
    var chestTier = nextChestTier();
    var loot = resolveChestLoot(rng, chestTier);
    map[chestPos.y][chestPos.x] = TILE.CHEST;
    used[key(chestPos.x, chestPos.y)] = true;
    nonStartRooms[ci].specialChest = true;
    nonStartRooms[ci].chestCount = (nonStartRooms[ci].chestCount || 0) + 1;
    chestLootByCoord[tileKey(chestPos.x, chestPos.y)] = {
      x: chestPos.x, y: chestPos.y, tier: chestTier, loot: loot, opened: false,
      roomIndex: rooms.indexOf(nonStartRooms[ci])
    };
    placedChests++;
  }

  // Extra chests in larger rooms if needed
  if (placedChests < totalChestsToPlace) {
    var bigRooms = nonStartRooms.slice().sort(function (a, b) { return (b.w * b.h) - (a.w * a.h); });
    var safety = 0;
    while (placedChests < totalChestsToPlace && bigRooms.length && safety < 200) {
      var brRoom = bigRooms[safety % bigRooms.length];
      var brCells = availableCellsInRoom(brRoom);
      if (brCells.length) {
        var brPos = brCells[randomInt(rng, 0, brCells.length - 1)];
        var brTier = nextChestTier();
        var brLoot = resolveChestLoot(rng, brTier);
        map[brPos.y][brPos.x] = TILE.CHEST;
        used[key(brPos.x, brPos.y)] = true;
        brRoom.chestCount = (brRoom.chestCount || 0) + 1;
        chestLootByCoord[tileKey(brPos.x, brPos.y)] = {
          x: brPos.x, y: brPos.y, tier: brTier, loot: brLoot, opened: false,
          roomIndex: rooms.indexOf(brRoom)
        };
        placedChests++;
      }
      safety++;
    }
  }

  // --- Traps ---
  var trapRooms = rooms.slice(1, rooms.length - 1);
  var trapsToPlace = Math.min(3, Math.floor(trapRooms.length / 2));
  var trapRoomsShuffled = shuffle(trapRooms);
  for (var tr = 0; tr < trapRoomsShuffled.length && trapsToPlace > 0; tr++) {
    var trapRoom = trapRoomsShuffled[tr];
    if (trapRoom.specialChest) continue;
    var trapCells = availableCellsInRoom(trapRoom);
    if (!trapCells.length) continue;
    var trapPos = trapCells[randomInt(rng, 0, trapCells.length - 1)];
    map[trapPos.y][trapPos.x] = TILE.TRAP;
    used[key(trapPos.x, trapPos.y)] = true;
    trapsToPlace--;
  }

  // --- Armory ---
  var armoryRooms = rooms.slice(1, rooms.length - 1).sort(function (a, b) {
    var da = Math.abs(a.cx - startRoom.cx) + Math.abs(a.cy - startRoom.cy);
    var db = Math.abs(b.cx - startRoom.cx) + Math.abs(b.cy - startRoom.cy);
    return db - da;
  });
  for (var ar = 0; ar < armoryRooms.length; ar++) {
    if (armoryRooms[ar].specialChest || armoryRooms[ar].specialBoss) continue;
    var armoryCells = availableCellsInRoom(armoryRooms[ar]);
    if (!armoryCells.length) continue;
    var armoryPos = armoryCells[Math.floor(armoryCells.length / 2)];
    map[armoryPos.y][armoryPos.x] = TILE.ARMORY;
    used[key(armoryPos.x, armoryPos.y)] = true;
    armoryRooms[ar].specialArmory = true;
    break;
  }

  // --- Enemies (distributed across non-start, non-boss rooms) ---
  // The boss counts as 1 enemy toward enemyCount, so we place enemyCount-1 normal enemies.
  var normalEnemyCount = Math.max(0, enemyCount - 1);
  var enemies = [];
  var enemyRooms = rooms.slice(1, rooms.length - 1); // exclude start AND boss room
  var enemyPlaced = 0;
  for (var er = 0; er < enemyRooms.length && enemyPlaced < normalEnemyCount; er++) {
    var eCells = shuffle(availableCellsForEnemy(enemyRooms[er]));
    for (var rc = 0; rc < eCells.length && enemyPlaced < normalEnemyCount; rc++) {
      var epos = eCells[rc];
      var tpl = enemyTemplates[enemyPlaced % enemyTemplates.length];
      enemies.push({
        id: 'enemy_' + (enemyPlaced + 1), label: tpl.label, type: tpl.type,
        hp: tpl.hp, maxHp: tpl.maxHp, atk: tpl.atk, def: tpl.def, move: tpl.move,
        x: epos.x, y: epos.y, boss: false
      });
      used[key(epos.x, epos.y)] = true;
      enemyPlaced++;
      break; // 1 per room first pass
    }
  }
  // Fill remaining normal enemies in rooms that have space (still exclude boss room)
  if (enemyPlaced < normalEnemyCount) {
    var fillRooms = shuffle(rooms.slice(1, rooms.length - 1));
    for (var fr = 0; fr < fillRooms.length && enemyPlaced < normalEnemyCount; fr++) {
      var fCells = shuffle(availableCellsForEnemy(fillRooms[fr]));
      for (var fc = 0; fc < fCells.length && enemyPlaced < normalEnemyCount; fc++) {
        var fpos = fCells[fc];
        var ftpl = enemyTemplates[enemyPlaced % enemyTemplates.length];
        enemies.push({
          id: 'enemy_' + (enemyPlaced + 1), label: ftpl.label, type: ftpl.type,
          hp: ftpl.hp, maxHp: ftpl.maxHp, atk: ftpl.atk, def: ftpl.def, move: ftpl.move,
          x: fpos.x, y: fpos.y, boss: false
        });
        used[key(fpos.x, fpos.y)] = true;
        enemyPlaced++;
      }
    }
  }

  // --- Boss ---
  var bossChoices = availableCellsInRoom(bossRoom);
  if (bossChoices.length) {
    var bossPos = bossChoices[Math.floor(bossChoices.length / 2)];
    var bossHp = 8 + heroCount * 2;
    enemies.push({
      id: 'enemy_boss', label: 'J', type: 'caos',
      hp: bossHp, maxHp: bossHp, atk: 4, def: 3, move: 2,
      boss: true, x: bossPos.x, y: bossPos.y
    });
    used[key(bossPos.x, bossPos.y)] = true;
  }

  /* =========================================================
     VALIDATE & RETURN
     ========================================================= */
  var validation = validateGeneratedLevel(map, rooms, heroes, doors, enemies);

  var generated = {
    width: width,
    height: height,
    rooms: rooms,
    map: map,
    heroes: heroes,
    enemies: enemies,
    doors: doors,
    chests: chestLootByCoord,
    inventory: createInventoryState(),
    visible: {},
    roomColorMap: roomColorMap,
    roomIndexMap: roomIndexMap,
    roomTypeMap: roomTypeMap,
    decorationMap: decorationMap,
    textureMap: textureMap,
    meta: {
      start: 1,
      boss: 1,
      medium: Math.max(0, rooms.length - 2),
      secondary: 0,
      style: style,
      doorCount: Object.keys(doors).length,
      validation: validation,
      layoutMode: 'bsp',
      grid: leaves.length + ' salas'
    }
  };

  computeVisibility(generated);
  return generated;
}




  function tileClass(tile, fogged, door, tx, ty) {
    if (fogged) return 'fog';
    if (tile === TILE.WALL) return 'wall';
    if (tile === TILE.FLOOR) return 'floor';
    if (tile === TILE.DOOR) return 'door ' + (door && door.open ? 'door-open' : 'door-closed') + ' ' + (door && doorNormal(door.side).axis === 'v' ? 'door-v' : 'door-h');
    if (tile === TILE.EXIT) return 'exit';
    if (tile === TILE.TRAP) return 'trap';
    if (tile === TILE.CHEST) {
      var chestKey = tileKey(tx, ty);
      var chestInfo = current && current.chests && current.chests[chestKey];
      var chestTier = chestInfo ? (chestInfo.tier || 'normal') : 'normal';
      return 'chest chest-' + chestTier;
    }
    return 'floor';
  }

  function tileGlyph(tile, door) {
    if (tile === TILE.WALL) return iconSvg('wall', 'tile-symbol');
    if (tile === TILE.DOOR) return iconSvg(door && door.open ? 'doorOpen' : 'doorClosed', 'tile-symbol');
    if (tile === TILE.EXIT) return iconSvg('exit', 'tile-symbol');
    if (tile === TILE.TRAP) return iconSvg('trap', 'tile-symbol');
    if (tile === TILE.CHEST) return iconSvg('chest', 'tile-symbol');
    if (tile === TILE.KEY) return iconSvg('key', 'tile-symbol');
    if (tile === TILE.ARMORY) return iconSvg('armory', 'tile-symbol');
    if (tile === TILE.FLOOR) return '';
    return '';
  }

  function fitBoard() {
    if (!current) return;
    var wrap = document.querySelector('.board-wrap');
    var minTile = 10;
    var maxTile;
    var gap;
    if (current.width <= 18 && current.height <= 12) {
      maxTile = 100; gap = 1;
    } else if (current.width <= 24 && current.height <= 16) {
      maxTile = 80; gap = 1;
    } else if (current.width <= 36 && current.height <= 24) {
      maxTile = 60; gap = 1;
    } else {
      maxTile = 50; gap = 1;
    }

    var availW = Math.max(120, wrap.clientWidth);
    var availH = Math.max(120, wrap.clientHeight);
    var tileSize = Math.floor(Math.min(
      (availW - gap * Math.max(0, current.width - 1)) / current.width,
      (availH - gap * Math.max(0, current.height - 1)) / current.height
    ));
    tileSize = clamp(tileSize, minTile, maxTile);

    board.style.gap = gap + 'px';
    board.style.gridTemplateColumns = 'repeat(' + current.width + ', ' + tileSize + 'px)';
    board.style.setProperty('--tile-size', tileSize + 'px');
    board.style.setProperty('--pawn-font-size', Math.max(8, Math.floor(tileSize * 0.42)) + 'px');
    board.style.setProperty('--badge-font-size', Math.max(6, Math.floor(tileSize * 0.24)) + 'px');
    // Tile dimensions and font-size are set via CSS using var(--tile-size) / var(--pawn-font-size)
    // No need to loop over children
  }

  function heroDisplayName(hero) {
    return hero ? ((hero.name || hero.id.split('_')[0]) + ' [' + hero.label + ']') : '';
  }

  function updateTurnInfo() {
    if (!current || !current.turn || !current.heroes || !current.heroes.length) {
      if (turnInfoEl) turnInfoEl.textContent = '—';
      if (turnPhaseEl) { turnPhaseEl.textContent = ''; turnPhaseEl.className = 'turn-phase idle'; }
      rollBtn.disabled = true;
      endTurnBtn.disabled = true;
      return;
    }
    var completed = ensureObjectives().completed;
    var moveLeft = current.turn.movePoints || 0;
    var enemyPhase = isEnemyPhaseActive();
    var moving = isMovementAnimationActive();
    var round = current.turn.round || 1;

    var stateText;
    if (completed) stateText = '✓ Misión completada';
    else if (enemyPhase) stateText = '⚠ Fase enemiga...';
    else if (moving) stateText = '↗ Moviendo...';
    else if (!current.turn.rolled) stateText = 'Tira para moverte';
    else if (moveLeft > 0) stateText = moveLeft + ' paso' + (moveLeft !== 1 ? 's' : '') + ' restantes';
    else stateText = current.turn.attacked ? 'Fin de acciones' : 'Sin movimiento · puedes atacar';

    if (turnInfoEl) turnInfoEl.textContent = '';
    if (turnPhaseEl) {
      turnPhaseEl.textContent = enemyPhase ? 'Fase enemiga' : ('Turno de héroes');
      turnPhaseEl.className = 'turn-phase ' + (enemyPhase ? 'enemy' : 'hero');
    }
    rollBtn.disabled = completed || !!current.turn.rolled || enemyPhase || moving;
    endTurnBtn.disabled = completed || enemyPhase || moving;
  }

  function resetTurnState() {
    if (!current || !current.heroes || !current.heroes.length) return;
    current.turn = { round:1, heroIndex:0, movePoints:0, rolled:false, attacked:false, abilityUsed:false, movedThisTurn:false };
    current.selectedHeroId = current.heroes[0].id;
    current.distanceMap = {};
    current.reachable = {};
    current.attackable = {};
    current.enemyPhaseActive = false;
    current.enemyActingId = null;
    current.movementAnimationActive = false;
    current.heroAnimatingId = null;
    updateTurnInfo();
  }

  function getActiveHero() {
    if (!current || !current.turn || !current.heroes || !current.heroes.length) return null;
    var idx = clamp(current.turn.heroIndex || 0, 0, current.heroes.length - 1);
    return current.heroes[idx];
  }

  function isActiveHero(hero) {
    var active = getActiveHero();
    return !!(hero && active && hero.id === active.id);
  }

  function rollMovement() {
    if (!current || !current.turn || ensureObjectives().completed || isInputLocked()) return;
    var hero = getActiveHero();
    if (!hero || current.turn.rolled) return;
    var die1 = randomInt(Math.random, 1, 6);
    var die2 = randomInt(Math.random, 1, 6);
    current.turn.movePoints = die1 + die2 + (hero.moveBonus || 0);
    current.turn.rolled = true;
    current.selectedHeroId = hero.id;
    current.reachable = computeReachableTiles(hero, current.turn.movePoints);
    current.attackable = computeAttackableTiles(hero);
    setStatus(heroDisplayName(hero) + ' puede moverse ' + current.turn.movePoints + ' casillas (' + die1 + '+' + die2 + (hero.moveBonus ? '+' + hero.moveBonus : '') + ').');
    updateTurnInfo();
    render();
  }

  function endTurn() {
    if (!current || !current.turn || !current.heroes || !current.heroes.length || ensureObjectives().completed || isInputLocked()) return;
    current.turn.heroIndex++;
    if (current.turn.heroIndex >= current.heroes.length) {
      current.turn.heroIndex = 0;
      current.turn.round++;
      setStatus('Fase enemiga en curso...');
      updateTurnInfo();
      render();
      runEnemyPhase(function () {
        if (isGameOver()) {
          updateTurnInfo();
          render();
          return;
        }
        current.turn.movePoints = 0;
        current.turn.rolled = false;
        current.turn.attacked = false;
        current.turn.abilityUsed = false;
        current.turn.movedThisTurn = false;
        tickHeroEffects(current.heroes[current.turn.heroIndex]);
        current.selectedHeroId = current.heroes[current.turn.heroIndex].id;
        current.reachable = {};
        current.attackable = {};
        setStatus('Turno de ' + heroDisplayName(getActiveHero()) + '. Tira movimiento para continuar.');
        updateTurnInfo();
        render();
      });
      return;
    }
    current.turn.movePoints = 0;
    current.turn.rolled = false;
    current.turn.attacked = false;
    current.turn.abilityUsed = false;
    current.scrollTargeting = null;
    current.scrollTargetTiles = {};
    current.turn.movedThisTurn = false;
    tickHeroEffects(current.heroes[current.turn.heroIndex]);
    current.selectedHeroId = current.heroes[current.turn.heroIndex].id;
    current.reachable = {};
    current.attackable = {};
    setStatus('Turno de ' + heroDisplayName(getActiveHero()) + '. Tira movimiento para continuar.');
    updateTurnInfo();
    render();
    saveGame();
  }

  function computeDistanceMap(hero, steps) {
    var distance = {};
    if (!current || !hero) return distance;

    // Build O(1) position lookup maps to avoid O(n) linear scans per BFS node
    var heroPos = {};
    var enemyPos = {};
    var i;
    if (current.heroes) {
      for (i = 0; i < current.heroes.length; i++) {
        var h = current.heroes[i];
        heroPos[h.x + ',' + h.y] = h;
      }
    }
    if (current.enemies) {
      for (i = 0; i < current.enemies.length; i++) {
        var e = current.enemies[i];
        enemyPos[e.x + ',' + e.y] = e;
      }
    }

    var q = [{ x: hero.x, y: hero.y, d: 0 }];
    var qi = 0;
    distance[tileKey(hero.x, hero.y)] = 0;

    while (qi < q.length) {
      var curNode = q[qi++];
      if (curNode.d >= steps) continue;
      var ns = neighbors4(curNode.x, curNode.y);
      for (var j = 0; j < ns.length; j++) {
        var nx = ns[j][0], ny = ns[j][1];
        if (ny < 0 || ny >= current.height || nx < 0 || nx >= current.width) continue;
        var key = tileKey(nx, ny);
        if (!current.visible[key]) continue;
        var tile = current.map[ny][nx];
        var door = current.doors[key] || null;
        if (!isWalkableTile(tile, door)) continue;
        if (enemyPos[key]) continue;
        var blockingHero = heroPos[key];
        if (blockingHero && blockingHero.id !== hero.id) continue;
        var nd = curNode.d + 1;
        if (distance[key] !== undefined && distance[key] <= nd) continue;
        distance[key] = nd;
        q.push({ x: nx, y: ny, d: nd });
      }
    }
    return distance;
  }


  function reconstructPathFromDistance(hero, targetX, targetY) {
    var path = [];
    if (!current || !hero || !current.distanceMap) return path;
    var key = tileKey(targetX, targetY);
    if (current.distanceMap[key] === undefined) return path;
    var cx = targetX;
    var cy = targetY;
    while (!(cx === hero.x && cy === hero.y)) {
      path.unshift({ x: cx, y: cy });
      var curDist = current.distanceMap[tileKey(cx, cy)];
      var ns = neighbors4(cx, cy);
      var found = false;
      for (var i = 0; i < ns.length; i++) {
        var nx = ns[i][0], ny = ns[i][1];
        var nKey = tileKey(nx, ny);
        if (current.distanceMap[nKey] === curDist - 1) {
          cx = nx;
          cy = ny;
          found = true;
          break;
        }
      }
      if (!found) return [];
    }
    return path;
  }

  function getHeroById(id) {
    if (!current || !current.heroes) return null;
    for (var i = 0; i < current.heroes.length; i++) {
      if (current.heroes[i].id === id) return current.heroes[i];
    }
    return null;
  }

  function getHeroAt(x, y) {
    if (!current || !current.heroes) return null;
    for (var i = 0; i < current.heroes.length; i++) {
      var hero = current.heroes[i];
      if (hero.x === x && hero.y === y) return hero;
    }
    return null;
  }

  function getEnemyAt(x, y) {
    if (!current || !current.enemies) return null;
    for (var i = 0; i < current.enemies.length; i++) {
      var enemy = current.enemies[i];
      if (enemy.x === x && enemy.y === y) return enemy;
    }
    return null;
  }

  function isAdjacent(a, b) {
    return !!a && !!b && (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1);
  }

  function getAdjacentEnemies(hero) {
    var list = [];
    if (!current || !hero || !current.enemies) return list;
    for (var i = 0; i < current.enemies.length; i++) {
      var enemy = current.enemies[i];
      if (enemy.hp > 0 && isAdjacent(hero, enemy) && current.visible[tileKey(enemy.x, enemy.y)]) list.push(enemy);
    }
    return list;
  }

  function computeAttackableTiles(hero) {
    var attackable = {};
    if (!current || !hero || !current.enemies) return attackable;
    var range = getHeroRange(hero);
    for (var i = 0; i < current.enemies.length; i++) {
      var enemy = current.enemies[i];
      if (enemy.hp <= 0 || !current.visible[tileKey(enemy.x, enemy.y)]) continue;
      var dist = Math.abs(hero.x - enemy.x) + Math.abs(hero.y - enemy.y);
      if (dist <= range) attackable[tileKey(enemy.x, enemy.y)] = true;
    }
    return attackable;
  }

  var BOSS_LOOT_TABLE = [
    'Espada del alba', 'Espada del caos', 'Coraza de dragón', 'Corona de combate',
    'Escudo del cruzado', 'Talismán del héroe', 'Martillo de guerra', 'Hacha doble',
    'Armadura de placas', 'Bastón de poder', 'Anillo de fuerza', 'Anillo de protección'
  ];

  function dropBossLoot(bossX, bossY) {
    if (!current || !current.heroes || !current.heroes.length) return;
    var itemName = BOSS_LOOT_TABLE[randomInt(Math.random, 0, BOSS_LOOT_TABLE.length - 1)];
    var item = makeItemDefinition(itemName);
    // Give to nearest living hero
    var bestHero = null;
    var bestDist = Infinity;
    for (var i = 0; i < current.heroes.length; i++) {
      var h = current.heroes[i];
      if (h.hp <= 0) continue;
      var d = Math.abs(h.x - bossX) + Math.abs(h.y - bossY);
      if (d < bestDist) { bestDist = d; bestHero = h; }
    }
    if (!bestHero) return;
    if (!bestHero.inventory) bestHero.inventory = createHeroInventory();
    if (!bestHero.inventory.backpack) bestHero.inventory.backpack = [];
    bestHero.inventory.backpack.push(item);
    syncHeroDerivedStats(bestHero);
    // Also add gold
    if (!current.inventory) current.inventory = createInventoryState();
    var bossGold = randomInt(Math.random, 150, 300);
    current.inventory.gold += bossGold;
    pushCombatLog('👑 El boss ha soltado: ' + itemName + ' + ' + bossGold + ' oro.');
    showToast('👑 Boss drop: ' + itemName + ' + ' + bossGold + ' oro', 'toast-loot');
    addCombatFx(bossX, bossY, '👑', 'block');
  }

  function removeDeadEnemies() {
    if (!current || !current.enemies) return;
    // Check for dying boss before removing
    for (var bi = 0; bi < current.enemies.length; bi++) {
      var en = current.enemies[bi];
      if (en.hp <= 0 && en.boss && !en._dropped) {
        en._dropped = true;
        dropBossLoot(en.x, en.y);
      }
    }
    var before = current.enemies.length;
    current.enemies = current.enemies.filter(function (enemy) { return enemy.hp > 0; });
    var removed = before - current.enemies.length;
    if (removed > 0) ensureStats().enemiesDefeated += removed;
  }

  function removeDeadHeroes() {
    if (!current || !current.heroes) return;
    current.heroes = current.heroes.filter(function (hero) { return hero.hp > 0; });
    if (current.turn && current.heroes.length) current.turn.heroIndex = clamp(current.turn.heroIndex || 0, 0, current.heroes.length - 1);
  }

  function getEnemyById(id) {
    if (!current || !current.enemies) return null;
    for (var i = 0; i < current.enemies.length; i++) {
      if (current.enemies[i].id === id) return current.enemies[i];
    }
    return null;
  }

  function isGameOver() {
    return !current || !current.heroes || !current.heroes.length;
  }

  function getLivingHeroAt(x, y) {
    var hero = getHeroAt(x, y);
    return hero && hero.hp > 0 ? hero : null;
  }

  function isWalkableTile(tile, door) {
    if (tile === TILE.WALL) return false;
    if (tile === TILE.CHEST) return false;
    if (tile === TILE.DOOR) return !!(door && door.open);
    return true;
  }

  function isAdjacentTo(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2) === 1;
  }

  function isChestAt(x, y) {
    return !!(current && current.map && current.map[y] && current.map[y][x] === TILE.CHEST);
  }

  function getReachableAdjacentChestTile(hero, chestX, chestY) {
    if (!current || !hero || !current.turn) return null;
    current.reachable = computeReachableTiles(hero, current.turn.movePoints);
    var best = null;
    var bestCost = Infinity;
    var ns = neighbors4(chestX, chestY);
    for (var i = 0; i < ns.length; i++) {
      var nx = ns[i][0], ny = ns[i][1];
      if (ny < 0 || ny >= current.height || nx < 0 || nx >= current.width) continue;
      var nKey = tileKey(nx, ny);
      if (!current.reachable[nKey]) continue;
      var cost = current.distanceMap && current.distanceMap[nKey] !== undefined ? current.distanceMap[nKey] : Infinity;
      if (cost < bestCost) {
        bestCost = cost;
        best = { x:nx, y:ny, cost:cost };
      }
    }
    return best;
  }

  function buildDistanceFrom(startX, startY, passableFn) {
    var dist = {};
    var q = [{ x:startX, y:startY, d:0 }];
    var qi = 0;
    dist[tileKey(startX, startY)] = 0;
    while (qi < q.length) {
      var cur = q[qi++];
      var ns = neighbors4(cur.x, cur.y);
      for (var i = 0; i < ns.length; i++) {
        var nx = ns[i][0], ny = ns[i][1];
        if (ny < 0 || ny >= current.height || nx < 0 || nx >= current.width) continue;
        var key = tileKey(nx, ny);
        if (dist[key] !== undefined) continue;
        if (!passableFn(nx, ny)) continue;
        dist[key] = cur.d + 1;
        q.push({ x:nx, y:ny, d:cur.d + 1 });
      }
    }
    return dist;
  }

  function nextStepTowardsEnemy(enemy, targetHero) {
    if (!current || !enemy || !targetHero) return null;
    var dist = buildDistanceFrom(targetHero.x, targetHero.y, function (x, y) {
      var key = tileKey(x, y);
      var tile = current.map[y][x];
      var door = current.doors[key] || null;
      if (!isWalkableTile(tile, door)) return false;
      var otherEnemy = getEnemyAt(x, y);
      if (otherEnemy && otherEnemy !== enemy) return false;
      var hero = getHeroAt(x, y);
      if (hero && hero !== targetHero) return false;
      return true;
    });
    var best = null;
    var bestDist = Infinity;
    var ns = neighbors4(enemy.x, enemy.y);
    for (var i = 0; i < ns.length; i++) {
      var nx = ns[i][0], ny = ns[i][1];
      if (ny < 0 || ny >= current.height || nx < 0 || nx >= current.width) continue;
      var key = tileKey(nx, ny);
      var tile = current.map[ny][nx];
      var door = current.doors[key] || null;
      if (!isWalkableTile(tile, door)) continue;
      if (getEnemyAt(nx, ny)) continue;
      var hero = getHeroAt(nx, ny);
      if (hero && hero !== targetHero) continue;
      if (dist[key] === undefined) continue;
      if (dist[key] < bestDist) {
        bestDist = dist[key];
        best = { x:nx, y:ny };
      }
    }
    return best;
  }


  function nextStepAwayFromEnemy(enemy, threat) {
    if (!current || !enemy || !threat) return null;
    var dist = buildDistanceFrom(threat.x, threat.y, function (x, y) {
      var key = tileKey(x, y);
      var tile = current.map[y][x];
      var door = current.doors[key] || null;
      if (!isWalkableTile(tile, door)) return false;
      var otherEnemy = getEnemyAt(x, y);
      if (otherEnemy && otherEnemy !== enemy) return false;
      return true;
    });
    var best = null;
    var bestDist = -1;
    var ns = neighbors4(enemy.x, enemy.y);
    for (var i = 0; i < ns.length; i++) {
      var nx = ns[i][0], ny = ns[i][1];
      if (ny < 0 || ny >= current.height || nx < 0 || nx >= current.width) continue;
      var key = tileKey(nx, ny);
      var tile = current.map[ny][nx];
      var door = current.doors[key] || null;
      if (!isWalkableTile(tile, door)) continue;
      if (getEnemyAt(nx, ny)) continue;
      if (getHeroAt(nx, ny)) continue;
      if (dist[key] === undefined) continue;
      if (dist[key] > bestDist) {
        bestDist = dist[key];
        best = { x: nx, y: ny };
      }
    }
    return best;
  }

  function visibleHeroesForEnemy(enemy) {
    var list = [];
    if (!current || !current.heroes || !current.heroes.length) return list;
    var distMap = buildDistanceFrom(enemy.x, enemy.y, function (x, y) {
      var key = tileKey(x, y);
      var tile = current.map[y][x];
      var door = current.doors[key] || null;
      if (!isWalkableTile(tile, door)) return false;
      var otherEnemy = getEnemyAt(x, y);
      if (otherEnemy && otherEnemy !== enemy) return false;
      return true;
    });
    for (var i = 0; i < current.heroes.length; i++) {
      var hero = current.heroes[i];
      if (hero.hp <= 0) continue;
      var key = tileKey(hero.x, hero.y);
      if (!current.visible[key] || distMap[key] === undefined) continue;
      list.push({ hero: hero, dist: distMap[key] });
    }
    return list;
  }

  function selectTargetForEnemy(enemy) {
    var candidates = visibleHeroesForEnemy(enemy);
    if (!candidates.length) return null;
    if (enemy.boss) {
      candidates.sort(function (a, b) {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return a.hero.hp - b.hero.hp;
      });
      return candidates[0].hero;
    }
    if (enemy.type === 'caos') {
      candidates.sort(function (a, b) {
        if (a.hero.hp !== b.hero.hp) return a.hero.hp - b.hero.hp;
        return a.dist - b.dist;
      });
      return candidates[0].hero;
    }
    if (enemy.type === 'goblin') {
      candidates.sort(function (a, b) {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return a.hero.hp - b.hero.hp;
      });
      return candidates[0].hero;
    }
    if (enemy.type === 'esqueleto') {
      candidates.sort(function (a, b) {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return b.hero.def - a.hero.def;
      });
      return candidates[0].hero;
    }
    if (enemy.type === 'orco') {
      candidates.sort(function (a, b) {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return b.hero.hp - a.hero.hp;
      });
      return candidates[0].hero;
    }
    if (enemy.type === 'troll') {
      // Troll targets the hero with the most HP (wants a worthy fight)
      candidates.sort(function (a, b) {
        if (b.hero.hp !== a.hero.hp) return b.hero.hp - a.hero.hp;
        return a.dist - b.dist;
      });
      return candidates[0].hero;
    }
    if (enemy.type === 'arana') {
      // Araña targets hero with lowest DEF (finds gaps in armor)
      candidates.sort(function (a, b) {
        var defA = getHeroDefense(a.hero);
        var defB = getHeroDefense(b.hero);
        if (defA !== defB) return defA - defB;
        return a.dist - b.dist;
      });
      return candidates[0].hero;
    }
    if (enemy.type === 'licantropo') {
      // Licántropo targets the weakest hero, then nearest
      candidates.sort(function (a, b) {
        if (a.hero.hp !== b.hero.hp) return a.hero.hp - b.hero.hp;
        return a.dist - b.dist;
      });
      return candidates[0].hero;
    }
    candidates.sort(function (a, b) {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return a.hero.hp - b.hero.hp;
    });
    return candidates[0].hero;
  }

  function getEnemyMoveBudget(enemy, target) {
    if (!enemy) return 0;
    if (enemy.boss) {
      var enraged = enemy.hp <= Math.ceil(enemy.maxHp / 2);
      return enraged ? (enemy.move || 2) + 1 : (enemy.move || 2);
    }
    if (enemy.type === 'goblin') return Math.max(1, (enemy.move || 2));
    if (enemy.type === 'esqueleto') return 1;
    if (enemy.type === 'orco') {
      if (target && Math.abs(enemy.x - target.x) + Math.abs(enemy.y - target.y) <= 2) return 1;
      return enemy.move || 2;
    }
    if (enemy.type === 'caos') return enemy.move || 2;
    if (enemy.type === 'troll') {
      // Troll rages when wounded, gains +1 move
      var trollEnraged = enemy.hp <= Math.ceil(enemy.maxHp / 2);
      return trollEnraged ? (enemy.move || 1) + 1 : (enemy.move || 1);
    }
    if (enemy.type === 'arana') return enemy.move || 4;
    if (enemy.type === 'licantropo') {
      // Licántropo frenzy when wounded, gains +1 move
      var licEnraged = enemy.hp <= Math.ceil(enemy.maxHp / 2);
      return licEnraged ? (enemy.move || 3) + 1 : (enemy.move || 3);
    }
    return enemy.move || 2;
  }

  function getEnemyAttackProfile(enemy, target) {
    var dice = enemy.atk || 2;
    var threshold = 4;
    var tag = '';
    if (!enemy) return { dice: dice, threshold: threshold, tag: tag };
    if (enemy.boss) {
      var enraged = enemy.hp <= Math.ceil(enemy.maxHp / 2);
      if (enraged) {
        dice += 2;
        threshold = 3;
        tag = '💀 Furia oscura';
        if (!enemy._rageAnnounced) {
          enemy._rageAnnounced = true;
          pushCombatLog('¡El Jefe del Caos entra en FURIA OSCURA! Ataque y precisión aumentados.');
        }
      } else if (current && current.turn && current.turn.round % 3 === 0) {
        dice += 1;
        tag = 'Golpe oscuro';
      }
    } else if (enemy.type === 'orco' && target && target.hp <= Math.max(2, Math.floor((target.maxHp || target.hp) / 2))) {
      dice += 1;
      tag = 'Embate brutal';
    } else if (enemy.type === 'caos' && target && target.hp <= 3) {
      dice += 1;
      tag = 'Caza al débil';
    } else if (enemy.type === 'licantropo') {
      var licFrenzy = enemy.hp <= Math.ceil(enemy.maxHp / 2);
      if (licFrenzy) {
        dice += 2;
        threshold = 3;
        tag = '🐺 Furia bestial';
        if (!enemy._rageAnnounced) {
          enemy._rageAnnounced = true;
          pushCombatLog('¡El Licántropo entra en FURIA BESTIAL! Ataque devastador.');
        }
      }
    } else if (enemy.type === 'troll' && target && target.hp > Math.ceil((target.maxHp || target.hp) / 2)) {
      dice += 1;
      tag = 'Aplastante';
    } else if (enemy.type === 'arana') {
      tag = 'Veneno';
    }
    return { dice: dice, threshold: threshold, tag: tag };
  }

  function nearestVisibleHero(enemy) {
    return selectTargetForEnemy(enemy);
  }

  function attackEnemyAt(x, y) {
    if (!current || !current.turn || ensureObjectives().completed) return false;
    var hero = ensureSelectedHero();
    var enemy = getEnemyAt(x, y);
    var range = hero ? getHeroRange(hero) : 1;
    var dist = hero && enemy ? Math.abs(hero.x - enemy.x) + Math.abs(hero.y - enemy.y) : 99;
    if (!hero || !enemy || !isActiveHero(hero) || !current.turn.rolled || current.turn.attacked || dist > range) return false;

    var heroType = hero.id.split('_')[0];
    var isMago = heroType === 'mago';
    var targets = isMago ? [] : [enemy];

    // Mago: explosión arcana — ataca a todos los enemigos en rango
    if (isMago) {
      for (var mi = 0; mi < current.enemies.length; mi++) {
        var e = current.enemies[mi];
        if (e.hp <= 0 || !current.visible[tileKey(e.x, e.y)]) continue;
        var d = Math.abs(hero.x - e.x) + Math.abs(hero.y - e.y);
        if (d <= range) targets.push(e);
      }
      if (!targets.length) return false;
    }

    var totalDamage = 0;
    var killed = 0;
    var lines = [];

    for (var ti = 0; ti < targets.length; ti++) {
      var t = targets[ti];
      var atk = rollCombatDice(getHeroAttack(hero) || 2, 4);
      var defTarget = t.boss ? 5 : 6;
      var def = rollCombatDice(t.def || 1, defTarget);
      var damage = Math.max(0, atk.hits - def.hits);
      t.hp -= damage;
      totalDamage += damage;
      if (t.hp <= 0) killed++;
      addCombatFx(hero.x, hero.y, '⚔', 'attack');
      addCombatFx(t.x, t.y, damage > 0 ? ((t.hp <= 0) ? ('CRIT -' + damage) : (damage >= 3 ? ('CRIT -' + damage) : ('-' + damage))) : '🛡', damage > 0 ? (t.hp <= 0 ? 'kill' : (damage >= 3 ? 'crit' : 'damage')) : 'block');
      var line = heroDisplayName(hero) + ' ataca a ' + unitDisplayName(t) + ': ' + atk.hits + ' impacto(s) vs ' + def.hits + ' defensa(s)';
      if (isMago && targets.length > 1) line += ' [Explosión arcana]';
      if (t.hp <= 0) line += '. Derrotado.';
      else line += '. Daño ' + damage + '. Le quedan ' + t.hp + '/' + t.maxHp + ' PV.';
      lines.push(line);
    }

    var stats = ensureStats();
    stats.heroAttacks++;
    stats.damageDealt += totalDamage;

    current.turn.attacked = true;

    // Arquero: disparo libre — puede moverse antes Y después de atacar
    // Resto: si atacó ANTES de moverse, conserva los puntos. Si atacó DESPUÉS, se quedan a 0.
    if (heroType !== 'arquero') {
      if (current.turn.movedThisTurn) {
        current.turn.movePoints = 0;
      }
      // si no se ha movido aún, conserva movePoints para poder moverse después
    }

    // Bárbaro: frenesí — si mató algún enemigo, puede atacar una vez más
    if (heroType === 'barbaro' && killed > 0 && !current.turn.abilityUsed) {
      current.turn.attacked = false;
      current.turn.abilityUsed = true;
      lines.push('⚡ Frenesí: ' + heroDisplayName(hero) + ' puede atacar de nuevo.');
    }

    removeDeadEnemies();
    computeVisibility(current);
    current.reachable = computeReachableTiles(hero, current.turn.movePoints);
    current.attackable = computeAttackableTiles(hero);

    var summary = lines.join(' ');
    setStatus(summary);
    lines.forEach(function(l) { pushCombatLog(l); });

    recordCombat({
      actorSide: 'hero',
      attacker: heroDisplayName(hero),
      defender: targets.map(function(t) { return unitDisplayName(t); }).join(', '),
      attackRolls: [], defenseRolls: [],
      attackThreshold: 4, defenseThreshold: 6,
      hits: totalDamage, blocks: 0,
      damage: totalDamage, defeated: killed > 0
    });

    updateTurnInfo();
    render();
    return true;
  }

  function runEnemyPhase(onComplete) {
    if (!current || !current.enemies || !current.enemies.length || ensureObjectives().completed || isGameOver()) {
      if (onComplete) onComplete('');
      return;
    }
    var delay = 600;
    var log = [];
    var queue = current.enemies.filter(function (enemy) {
      return enemy && enemy.hp > 0 && current.visible && current.visible[tileKey(enemy.x, enemy.y)];
    }).map(function (enemy) { return enemy.id; });
    current.enemyPhaseActive = true;
    current.movementAnimationActive = false;
    current.enemyActingId = null;
    current.heroAnimatingId = null;
    updateTurnInfo();
    render();

    function finishPhase(summary) {
      removeDeadHeroes();
      removeDeadEnemies();
      computeVisibility(current);
      current.enemyPhaseActive = false;
      current.movementAnimationActive = false;
      current.enemyActingId = null;
      current.heroAnimatingId = null;
      if (isGameOver()) {
        setStatus('Todos los héroes han caído. Fin de la partida.');
        current.reachable = {};
        current.attackable = {};
        updateCombatLog();
        updateTurnInfo();
        render();
        if (onComplete) onComplete('');
        return;
      }
      var finalSummary = summary || (log.length ? ('Fase enemiga: ' + log.join(' ')) : 'Fase enemiga: los enemigos no han podido actuar.');
      setStatus(finalSummary);
      if (log.length) pushCombatLog('--- Fin de fase enemiga ---');
      updateTurnInfo();
      render();
      if (onComplete) onComplete(finalSummary);
    }

    function nextEnemy(index) {
      if (!current || ensureObjectives().completed || isGameOver() || index >= queue.length) {
        finishPhase('');
        return;
      }
      var enemy = getEnemyById(queue[index]);
      if (!enemy || enemy.hp <= 0) {
        nextEnemy(index + 1);
        return;
      }
      current.enemyActingId = enemy.id;
      updateTurnInfo();
      render();

      // Troll: regenera 1 PV al inicio de su turno
      if (enemy.type === 'troll' && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + 1);
        addCombatFx(enemy.x, enemy.y, '+1', 'block');
        pushCombatLog(unitDisplayName(enemy) + ' regenera 1 PV. Vida: ' + enemy.hp + '/' + enemy.maxHp + '.');
        computeVisibility(current);
        render();
      }

      // Boss: invoca un goblin servidor cada 5 rondas
      if (enemy.boss && current.turn && current.turn.round > 0 && current.turn.round % 5 === 0) {
        enemy._summonedRounds = enemy._summonedRounds || {};
        if (!enemy._summonedRounds[current.turn.round]) {
          enemy._summonedRounds[current.turn.round] = true;
          var summonNs = neighbors4(enemy.x, enemy.y);
          var spawnPos = null;
          for (var sni = 0; sni < summonNs.length; sni++) {
            var sx = summonNs[sni][0], sy = summonNs[sni][1];
            if (sy < 0 || sy >= current.height || sx < 0 || sx >= current.width) continue;
            var sTile = current.map[sy][sx];
            var sDoor = current.doors[tileKey(sx, sy)] || null;
            if (!isWalkableTile(sTile, sDoor)) continue;
            if (getEnemyAt(sx, sy) || getHeroAt(sx, sy)) continue;
            spawnPos = { x: sx, y: sy };
            break;
          }
          if (spawnPos) {
            current.enemies.push({
              id: 'enemy_s' + Date.now(), label: 'g', type: 'goblin',
              hp: 2, maxHp: 2, atk: 2, def: 1, move: 3,
              x: spawnPos.x, y: spawnPos.y, boss: false
            });
            pushCombatLog('¡El Jefe del Caos invoca un Goblin servidor!');
            setStatus('¡El Jefe del Caos invoca un Goblin servidor!');
            computeVisibility(current);
            render();
          }
        }
      }

      var target = nearestVisibleHero(enemy);
      if (!target) {
        setStatus(unitDisplayName(enemy) + ' no encuentra a ningún héroe y mantiene la posición.');
        setTimeout(function () { nextEnemy(index + 1); }, delay);
        return;
      }

      var isFleeing = enemy.type === 'goblin' && enemy.hp === 1;
      var moveBudget = getEnemyMoveBudget(enemy, target);
      var moved = 0;

      function resolveAttackOrEnd() {
        if (isFleeing) {
          current.movementAnimationActive = false;
          var fleeLine = unitDisplayName(enemy) + ' huye despavorido' + (moved > 0 ? ' ' + moved + ' casilla' + (moved === 1 ? '' : 's') : '') + '.';
          log.push(fleeLine);
          pushCombatLog(fleeLine);
          setStatus(fleeLine);
          setTimeout(function () { nextEnemy(index + 1); }, delay);
          return;
        }
        target = getHeroById(target.id) || nearestVisibleHero(enemy);
        if (target && isAdjacent(enemy, target)) {
          var attackProfile = getEnemyAttackProfile(enemy, target);
          var atk = rollCombatDice(attackProfile.dice, attackProfile.threshold);
          var defenseThreshold = 5;
          var def = rollCombatDice(getHeroDefense(target) || 2, defenseThreshold);
          var dmg = Math.max(0, atk.hits - def.hits);
          // Enano: armadura sólida — absorbe 1 punto de daño por golpe
          var enanoAbsorb = 0;
          if (target.id && target.id.split('_')[0] === 'enano' && dmg > 0) {
            enanoAbsorb = 1;
            dmg = Math.max(0, dmg - 1);
          }
          target.hp -= dmg;
          // Araña: aplica veneno si impacta
          if (enemy.type === 'arana' && dmg > 0) {
            if (!target.effects) target.effects = [];
            var hasPoison = target.effects.some(function (e) { return e.effect === 'poison'; });
            if (!hasPoison) {
              target.effects.push({ effect: 'poison', value: 1, duration: 2, label: 'Veneno' });
              pushCombatLog(heroDisplayName(target) + ' ha sido envenenado. Perderá 1 PV por turno durante 2 turnos.');
            }
          }
          var stats = ensureStats();
          stats.enemyAttacks++;
          stats.damageTaken += dmg;
          addCombatFx(enemy.x, enemy.y, '⚔', 'attack');
          addCombatFx(target.x, target.y, dmg > 0 ? ((target.hp <= 0) ? ('CRIT -' + dmg) : (dmg >= 3 ? ('CRIT -' + dmg) : ('-' + dmg))) : '🛡', dmg > 0 ? (target.hp <= 0 ? 'kill' : (dmg >= 3 ? 'crit' : 'damage')) : 'block');
          recordCombat({
            actorSide:'enemy',
            attacker:unitDisplayName(enemy),
            defender:heroDisplayName(target),
            attackRolls:atk.rolls,
            defenseRolls:def.rolls,
            attackThreshold:attackProfile.threshold,
            defenseThreshold:defenseThreshold,
            hits:atk.hits,
            blocks:def.hits,
            damage:dmg,
            defeated:target.hp <= 0
          });
          var line = unitDisplayName(enemy) + ' ataca a ' + heroDisplayName(target) + ': ' + atk.hits + ' impacto(s) vs ' + def.hits + ' defensa(s). Daño ' + dmg + '.';
          if (enanoAbsorb > 0) line += ' 🛡 Armadura sólida absorbe 1.';
          if (attackProfile.tag) line += ' ' + attackProfile.tag + '.';
          log.push(line);
          pushCombatLog(line);
          setStatus(line);
          removeDeadHeroes();
          current.movementAnimationActive = false;
          computeVisibility(current);
          updateTurnInfo();
          render();
          setTimeout(function () { nextEnemy(index + 1); }, delay + 600);
          return;
        }
        current.movementAnimationActive = false;
        if (moved > 0) {
          var moveDesc = enemy.type === 'goblin' ? ' con rapidez.' :
            enemy.type === 'esqueleto' ? ' con paso pesado.' :
            enemy.type === 'caos' ? ' acechando al más débil.' :
            enemy.type === 'troll' ? ' con pasos retumbantes.' :
            enemy.type === 'arana' ? ' con sigilo venenoso.' :
            enemy.type === 'licantropo' ? ' aullando hacia su presa.' : '.';
          var moveLine = unitDisplayName(enemy) + ' avanza ' + moved + ' casilla' + (moved === 1 ? '' : 's') + moveDesc;
          log.push(moveLine);
          setStatus(moveLine);
        }
        setTimeout(function () { nextEnemy(index + 1); }, delay);
      }

      function moveStep() {
        if (!current || ensureObjectives().completed || isGameOver()) {
          finishPhase('');
          return;
        }
        target = getHeroById(target.id) || nearestVisibleHero(enemy);
        if (!target || moveBudget <= 0 || (!isFleeing && isAdjacent(enemy, target))) {
          resolveAttackOrEnd();
          return;
        }
        var step = isFleeing
          ? nextStepAwayFromEnemy(enemy, target)
          : nextStepTowardsEnemy(enemy, target);
        if (!step || (step.x === enemy.x && step.y === enemy.y) || (!isFleeing && step.x === target.x && step.y === target.y)) {
          resolveAttackOrEnd();
          return;
        }
        current.movementAnimationActive = true;
        enemy.x = step.x;
        enemy.y = step.y;
        moveBudget--;
        moved++;
        computeVisibility(current);
        var moveMsg = isFleeing
          ? unitDisplayName(enemy) + ' huye despavorido...'
          : unitDisplayName(enemy) + ' avanza hacia ' + heroDisplayName(target) + '...';
        setStatus(moveMsg);
        updateTurnInfo();
        render();
        setTimeout(moveStep, delay);
      }

      moveStep();
    }

    nextEnemy(0);
  }

  function computeReachableTiles(hero, steps) {
    var reachable = {};
    if (!current || !hero || steps <= 0) {
      current.distanceMap = {};
      return reachable;
    }
    current.distanceMap = computeDistanceMap(hero, steps);
    for (var key in current.distanceMap) {
      if (key !== tileKey(hero.x, hero.y)) reachable[key] = true;
    }
    return reachable;
  }

  function ensureSelectedHero() {
    if (!current || !current.heroes || !current.heroes.length) return null;
    var active = getActiveHero();
    if (active) {
      current.selectedHeroId = active.id;
      return active;
    }
    var selected = getHeroById(current.selectedHeroId);
    if (selected) return selected;
    current.selectedHeroId = current.heroes[0].id;
    return current.heroes[0];
  }

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function showToast(message, kind) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast ' + (kind || 'toast-info');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { toast.classList.add('toast-show'); }, 10);
    setTimeout(function() {
      toast.classList.remove('toast-show');
      setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
    }, 4000);
  }

  function ensureObjectives() {
    if (!current) return { chestRequired:false, totalChests:0, chestOpened:false, openedChests:0, completed:false };
    if (!current.objectives) {
      var totalChests = countTiles(current.map, TILE.CHEST);
      current.objectives = {
        chestRequired: totalChests > 0,
        totalChests: totalChests,
        chestOpened: totalChests === 0,
        openedChests: 0,
        completed: false
      };
    }
    if (current.objectives.totalChests == null) current.objectives.totalChests = countTiles(current.map, TILE.CHEST);
    if (current.objectives.openedChests == null) current.objectives.openedChests = current.objectives.chestOpened ? current.objectives.totalChests : 0;
    current.objectives.chestRequired = current.objectives.totalChests > 0;
    current.objectives.chestOpened = current.objectives.openedChests >= current.objectives.totalChests;
    return current.objectives;
  }

  function objectiveText() {
    var objectives = ensureObjectives();
    if (objectives.completed) return 'Nivel completado.';
    if (objectives.chestRequired && !objectives.chestOpened) return 'Objetivo: abrir todos los cofres (' + objectives.openedChests + '/' + objectives.totalChests + ') y luego alcanzar la salida.';
    return 'Objetivo: alcanzar la salida.';
  }

  function interactTile(hero, x, y) {
    var tile = current.map[y][x];
    var objectives = ensureObjectives();
    if (tile === TILE.CHEST) {
      objectives.openedChests = Math.min(objectives.totalChests, (objectives.openedChests || 0) + 1);
      objectives.chestOpened = objectives.openedChests >= objectives.totalChests;
      var chestKey = tileKey(x, y);
      var chestData = current.chests && current.chests[chestKey] ? current.chests[chestKey] : { tier:'normal', loot: resolveChestLoot(Math.random, 'normal') };
      var loot = chestData.loot || resolveChestLoot(Math.random, chestData.tier || 'normal');
      var lootMessage = applyChestLoot(hero, loot);
      current.map[y][x] = TILE.FLOOR;
      if (current.chests && current.chests[chestKey]) current.chests[chestKey].opened = true;
      pushCombatLog(heroDisplayName(hero) + ' abre ' + tierLabel(chestData.tier || 'normal').toLowerCase() + ': ' + loot.text + '.');
      showToast(loot.rewardType === 'trap' ? '💀 ' + loot.text : '📦 ' + loot.text, loot.rewardType === 'trap' ? 'toast-danger' : 'toast-loot');
      if (hero.hp <= 0) {
        setStatus(heroDisplayName(hero) + ' abre un cofre, pero cae derrotado. ' + lootMessage);
      } else if (objectives.chestOpened) {
        setStatus(heroDisplayName(hero) + ' ha abierto el último cofre. ' + lootMessage + ' Ya puedes ir a la salida.');
      } else {
        setStatus(heroDisplayName(hero) + ' abre un cofre (' + objectives.openedChests + '/' + objectives.totalChests + '). ' + lootMessage);
      }
      return true;
    }
    if (tile === TILE.TRAP) {
      var trapDmg = randomInt(Math.random, 1, 3);
      hero.hp = Math.max(0, hero.hp - trapDmg);
      current.map[y][x] = TILE.FLOOR;
      addCombatFx(hero.x, hero.y, '💀 -' + trapDmg, 'damage');
      pushCombatLog(heroDisplayName(hero) + ' cae en una trampa: pierde ' + trapDmg + ' PV.');
      showToast('💀 Trampa: -' + trapDmg + ' PV', 'toast-danger');
      if (hero.hp <= 0) {
        setStatus(heroDisplayName(hero) + ' ha caído en una trampa y ha muerto. ¡' + trapDmg + ' daño!');
        removeDeadHeroes();
        computeVisibility(current);
      } else {
        setStatus(heroDisplayName(hero) + ' cae en una trampa. -' + trapDmg + ' PV. Le quedan ' + hero.hp + '/' + hero.maxHp + '.');
      }
      if (ensureStats) ensureStats().damageTaken += trapDmg;
      return true;
    }
    if (tile === TILE.ARMORY) {
      var armoryItems = ['Daga afilada', 'Espada corta', 'Hacha de mano', 'Maza de hierro', 'Arco corto', 'Lanza corta', 'Escudo de madera', 'Broquel ligero', 'Casco ligero', 'Armadura ligera', 'Poción de curación pequeña', 'Poción de curación media', 'Poción de vigor', 'Poción de defensa'];
      var picked = armoryItems[randomInt(Math.random, 0, armoryItems.length - 1)];
      var armoryItem = makeItemDefinition(picked);
      current.map[y][x] = TILE.FLOOR;
      var armDetail = '';
      if (!hero.inventory) hero.inventory = createHeroInventory();
      if (armoryItem.type === 'weapon' || armoryItem.type === 'shield' || armoryItem.type === 'armor' || armoryItem.type === 'helmet' || armoryItem.type === 'accessory') {
        if (!hero.inventory.backpack) hero.inventory.backpack = [];
        hero.inventory.backpack.push(armoryItem);
        armDetail = picked + ' guardado en mochila.';
      } else if (armoryItem.type === 'potion') {
        hero.inventory.potions.push(armoryItem);
        armDetail = heroDisplayName(hero) + ' recoge ' + picked + '.';
      }
      addCombatFx(hero.x, hero.y, '⚒', 'block');
      pushCombatLog(heroDisplayName(hero) + ' encuentra armería: ' + picked + '.');
      showToast('⚒ Armería: ' + picked, 'toast-loot');
      setStatus(heroDisplayName(hero) + ' usa la armería. ' + armDetail);
      return true;
    }
    if (tile === TILE.EXIT) {
      if (objectives.chestRequired && !objectives.chestOpened) {
        setStatus(heroDisplayName(hero) + ' ha encontrado la salida, pero antes debe abrir todos los cofres (' + objectives.openedChests + '/' + objectives.totalChests + ').');
        return true;
      }
      objectives.completed = true;
      setStatus('Nivel completado. ' + heroDisplayName(hero) + ' ha escapado por la salida.');
      return true;
    }
    setStatus('Turno de ' + heroDisplayName(hero) + '. Muévete, ataca a un enemigo adyacente o abre una puerta adyacente. ' + objectiveText());
    return false;
  }

  function spawnFootprint(x, y) {
    var tileEl = board.querySelector('[data-x="' + x + '"][data-y="' + y + '"]');
    if (!tileEl) return;
    var fp = document.createElement('div');
    fp.className = 'footprint';
    tileEl.appendChild(fp);
    setTimeout(function() { fp.classList.add('footprint-fade'); }, 10);
    setTimeout(function() { if (fp.parentNode) fp.parentNode.removeChild(fp); }, 500);
  }

  function moveSelectedHeroTo(x, y) {
    if (!current || !current.turn || isInputLocked()) return;
    var hero = ensureSelectedHero();
    if (!hero || !isActiveHero(hero)) return;
    if (!current.turn.rolled || current.turn.movePoints <= 0) {
      setStatus('Primero debes tirar movimiento para ' + heroDisplayName(hero) + '.');
      updateTurnInfo();
      render();
      return;
    }

    var pendingChestInteraction = null;
    if (isChestAt(x, y)) {
      if (isAdjacentTo(hero.x, hero.y, x, y)) {
        interactTile(hero, x, y);
        updateTurnInfo();
        render();
        return;
      }
      var adjacentStep = getReachableAdjacentChestTile(hero, x, y);
      if (!adjacentStep) {
        setStatus('No puedes abrir ese cofre todavía. Acércate a una casilla adyacente libre.');
        updateTurnInfo();
        render();
        return;
      }
      pendingChestInteraction = { x:x, y:y };
      x = adjacentStep.x;
      y = adjacentStep.y;
    }

    var key = tileKey(x, y);
    current.reachable = computeReachableTiles(hero, current.turn.movePoints);
    if (!current.reachable[key]) return;
    var cost = current.distanceMap && current.distanceMap[key] !== undefined ? current.distanceMap[key] : 0;
    if (cost <= 0 || cost > current.turn.movePoints) return;
    var path = reconstructPathFromDistance(hero, x, y);
    if (!path.length) return;
    var stepDelay = 220;
    current.movementAnimationActive = true;
    current.heroAnimatingId = hero.id;
    updateTurnInfo();
    render();

    function finishHeroMove() {
      current.movementAnimationActive = false;
      current.heroAnimatingId = null;
      current.turn.movePoints -= cost;
      current.turn.movedThisTurn = true;
      // Si ya atacó antes de moverse, consumir el movimiento restante ahora
      if (current.turn.attacked) {
        current.turn.movePoints = 0;
      }
      computeVisibility(current);
      current.reachable = computeReachableTiles(hero, current.turn.movePoints);
      current.attackable = computeAttackableTiles(hero);
      interactTile(hero, x, y);
      if (pendingChestInteraction && isChestAt(pendingChestInteraction.x, pendingChestInteraction.y) && isAdjacentTo(hero.x, hero.y, pendingChestInteraction.x, pendingChestInteraction.y)) {
        interactTile(hero, pendingChestInteraction.x, pendingChestInteraction.y);
      }
      if (ensureObjectives().completed) {
        current.turn.movePoints = 0;
        current.reachable = {};
        current.attackable = {};
      }
      if (current.turn.movePoints <= 0 && !ensureObjectives().completed && !current.turn.attacked) {
        setStatus(heroDisplayName(hero) + ' ha agotado su movimiento. Puedes atacar si estás junto a un enemigo o pulsar fin de turno.');
      } else if (!ensureObjectives().completed) {
        setStatus(heroDisplayName(hero) + ' se ha movido. ' + objectiveText());
      }
      updateTurnInfo();
      render();
    }

    function moveHeroStep(index) {
      if (!current || index >= path.length) {
        finishHeroMove();
        return;
      }
      var prevX = hero.x;
      var prevY = hero.y;
      hero.x = path[index].x;
      hero.y = path[index].y;
      computeVisibility(current);
      setStatus(heroDisplayName(hero) + ' se mueve...');
      updateTurnInfo();
      render();
      // Añadir huella en la casilla anterior
      spawnFootprint(prevX, prevY);
      // Escalar el pawn animando brevemente
      var pawnEl = board.querySelector('[data-x="' + hero.x + '"][data-y="' + hero.y + '"] .pawn');
      if (pawnEl) {
        pawnEl.style.transition = 'transform 0.1s ease-out';
        pawnEl.style.transform = 'translateY(-20%) scale(1.12)';
        pawnEl.style.filter = 'drop-shadow(0 6px 10px rgba(77,163,255,.6))';
        setTimeout(function() {
          if (pawnEl) {
            pawnEl.style.transform = '';
            pawnEl.style.filter = '';
          }
        }, 100);
      }
      setTimeout(function () { moveHeroStep(index + 1); }, stepDelay);
    }

    moveHeroStep(0);
  }

  function selectHero(hero) {
    if (!current || !hero) return;
    if (!isActiveHero(hero)) {
      setStatus('Ahora mismo el turno es de ' + heroDisplayName(getActiveHero()) + '.');
      updateTurnInfo();
      render();
      return;
    }
    current.selectedHeroId = hero.id;
    current.reachable = computeReachableTiles(hero, current.turn ? current.turn.movePoints : 0);
    current.attackable = computeAttackableTiles(hero);
    setStatus('Héroe activo seleccionado: ' + heroDisplayName(hero) + '. PV ' + hero.hp + '/' + hero.maxHp + ', ataque ' + getHeroAttack(hero) + ', defensa ' + getHeroDefense(hero) + '. Movimiento restante: ' + ((current.turn && current.turn.movePoints) || 0) + '.');
    updateTurnInfo();
    render();
  }

  function render() {
    if (!current) return;
    var now = Date.now();

    // ── Purge expired fx ──
    if (current.floatingFx) current.floatingFx = current.floatingFx.filter(function (fx) { return fx.until > now; });
    if (current.tileFx) {
      for (var tileFxKey in current.tileFx) {
        if (current.tileFx[tileFxKey].until <= now) delete current.tileFx[tileFxKey];
      }
    }

    var heroIndex = buildEntityIndex(current.heroes);
    var enemyIndex = buildEntityIndex(current.enemies);
    var selectedHero = ensureSelectedHero();
    var _obj = ensureObjectives(); // cache — called multiple times per render
    // reachable/attackable are updated by event handlers (roll, move, openDoor, endTurn, etc.)
    // — no need to recompute them on every render call.

    // ── Rebuild tile grid only when map dimensions change (not every frame) ──
    if (!_tileEls || _tileElsW !== current.width || _tileElsH !== current.height) {
      board.innerHTML = '';
      board.style.gridTemplateColumns = 'repeat(' + current.width + ', var(--tile-size))';
      _tileEls = new Array(current.width * current.height);
      _tileHTMLCache = new Array(current.width * current.height);
      var frag = document.createDocumentFragment();
      for (var ty = 0; ty < current.height; ty++) {
        for (var tx = 0; tx < current.width; tx++) {
          var t = document.createElement('div');
          t.dataset.x = String(tx);
          t.dataset.y = String(ty);
          frag.appendChild(t);
          _tileEls[ty * current.width + tx] = t;
        }
      }
      board.appendChild(frag);
      _tileElsW = current.width;
      _tileElsH = current.height;
    }

    // ── Update each tile in-place (no createElement, no appendChild inside loop) ──
    for (var y = 0; y < current.height; y++) {
      for (var x = 0; x < current.width; x++) {
        var tile = _tileEls[y * current.width + x];
        var cell = current.map[y][x];
        var coordKey = tileKey(x, y);
        var hero = heroIndex[coordKey] || null;
        var enemy = enemyIndex[coordKey] || null;
        var door = current.doors[coordKey] || null;
        var fogged = !current.visible[coordKey];
        var isActiveTurn = !!(hero && selectedHero && hero.id === selectedHero.id && isActiveHero(hero) && !isEnemyPhaseActive());
        var isSelected = !!(selectedHero && hero && hero.id === selectedHero.id);
        var isReachable = !!current.reachable[coordKey];
        var isAttackable = !!(current.attackable && current.attackable[coordKey]);
        var isScrollTarget = !!(current.scrollTargetTiles && current.scrollTargetTiles[coordKey]);
        var isEnemyActive = !!(enemy && !fogged && current.enemyActingId && enemy.id === current.enemyActingId);
        var isHeroAnimating = !!(hero && current.heroAnimatingId && hero.id === current.heroAnimatingId);
        var tileFx = current.tileFx && current.tileFx[coordKey] ? current.tileFx[coordKey] : null;

        tile.className = 'tile ' + tileClass(cell, fogged, door, x, y) +
          (isSelected ? ' tile-selected' : '') +
          (isReachable ? ' tile-reachable' : '') +
          (isAttackable ? ' tile-attackable' : '') +
          (isScrollTarget ? ' tile-scroll-target' : '') +
          (isEnemyActive ? ' tile-enemy-active' : '') +
          (isHeroAnimating ? ' tile-hero-active tile-hero-moving' : '') +
          (tileFx ? (' ' + (tileFx.kind === 'block' ? 'tile-block' : 'tile-hit')) : '');

        // Room floor color (static per tile; set once on fog lift, cheap to repeat)
        if (!fogged && cell === TILE.FLOOR && current.roomColorMap && current.roomColorMap[coordKey]) {
          tile.style.background = current.roomColorMap[coordKey];
        } else if (fogged || cell !== TILE.FLOOR) {
          tile.style.background = '';
        }

        // ── Build inner HTML as a string — one innerHTML write per tile ──
        var inner = '';

        if (!fogged && cell === TILE.FLOOR && current.textureMap && current.roomIndexMap) {
          var roomIdx = current.roomIndexMap[coordKey];
          if (roomIdx !== undefined && current.textureMap[roomIdx]) {
            inner += '<div class="room-tex-wrap">' + current.textureMap[roomIdx] + '</div>';
          }
        }

        if (!fogged) {
          if (hero) {
            var heroType2 = hero.id.split('_')[0];
            var abilityReady = isActiveTurn && heroAbilityReady(hero);
            inner += '<div class="pawn hero pawn-hero-' + heroType2 + (tileFx && tileFx.kind !== 'block' ? ' pawn-hit' : '') + '">' +
              heroIconForId(heroType2) +
              (abilityReady ? '<div class="ability-indicator" title="' + heroAbilityLabel(heroType2) + '">✦</div>' : '') +
              '</div>' +
              '<div class="cell-hp-bar hero"><div class="cell-hp-fill" style="width:' +
              Math.max(0, Math.min(100, Math.round((hero.hp / Math.max(1, hero.maxHp || hero.hp)) * 100))) +
              '%"></div></div>';
          } else if (enemy) {
            inner += '<div class="pawn ' +
              (enemy.boss ? 'boss' : ('enemy pawn-enemy-' + enemy.type)) +
              (tileFx && tileFx.kind !== 'block' ? ' pawn-hit' : '') +
              (isEnemyActive ? ' pawn-attack' : '') + '">' +
              enemyIconForType(enemy.type, enemy.boss) +
              '</div>' +
              '<div class="cell-hp-bar enemy"><div class="cell-hp-fill" style="width:' +
              Math.max(0, Math.min(100, Math.round((enemy.hp / Math.max(1, enemy.maxHp || enemy.hp)) * 100))) +
              '%"></div></div>';
          } else {
            var glyph = tileGlyph(cell, door);
            if (glyph) inner += glyph;
          }

          // Floating fx for this tile
          if (current.floatingFx && current.floatingFx.length) {
            for (var fxi = 0; fxi < current.floatingFx.length; fxi++) {
              var fx = current.floatingFx[fxi];
              if (fx.key !== coordKey) continue;
              inner += '<div class="floating-fx ' + fx.kind +
                (/^CRIT\b/.test(fx.text) ? ' crit-text' : '') + '"' +
                (fx.text === '⚔' ? ' aria-label="Ataque"' : fx.text === '🛡' ? ' aria-label="Bloqueo"' : '') +
                '>' + fx.text + '</div>';
            }
          }
        }

        var cacheIdx = y * current.width + x;
        if (!_tileHTMLCache || _tileHTMLCache[cacheIdx] !== inner) {
          tile.innerHTML = inner;
          if (_tileHTMLCache) _tileHTMLCache[cacheIdx] = inner;
        }

        // Tooltip
        if (door && !fogged) {
          tile.title = door.open ? 'Puerta abierta' : 'Puerta cerrada';
        } else if (hero && !fogged) {
          tile.title = heroDisplayName(hero) + ' | PV ' + hero.hp + '/' + hero.maxHp + ' | ATQ ' + getHeroAttack(hero) + ' | DEF ' + getHeroDefense(hero) + ' | Alcance ' + getHeroRange(hero);
        } else if (enemy && !fogged) {
          tile.title = unitDisplayName(enemy) + ' | PV ' + enemy.hp + '/' + enemy.maxHp + ' | ATQ ' + enemy.atk + ' | DEF ' + enemy.def;
        } else if (cell === TILE.CHEST && !fogged) {
          var chestData = current.chests && current.chests[coordKey] ? current.chests[coordKey] : null;
          tile.title = chestData ? tierLabel(chestData.tier) : 'Cofre';
        } else {
          tile.title = '';
        }
      }
    }

    if (isGameOver()) {
      setStatus('Todos los héroes han caído. Fin de la partida.');
    } else if (!statusEl || !statusEl.textContent || /^Mapa generado\./.test(statusEl.textContent)) {
      setStatus('Mapa generado. Tira movimiento, mueve al héroe activo y abre puertas adyacentes para revelar nuevas salas. ' + objectiveText());
    }
    updateTurnInfo();
    if (summaryEl) { summaryEl.innerHTML =
      '<div class="summary-card">' +
        '<div class="summary-title">Mazmorra</div>' +
        '<div class="summary-grid">' +
          '<div class="summary-stat"><span class="k">Estilo</span><span class="v">' + escapeHtml(current.meta.style) + '</span></div>' +
          '<div class="summary-stat"><span class="k">Puertas</span><span class="v">' + current.meta.doorCount + '</span></div>' +
          '<div class="summary-stat"><span class="k">Inicio</span><span class="v">' + current.meta.start + '</span></div>' +
          '<div class="summary-stat"><span class="k">Final / jefe</span><span class="v">' + current.meta.boss + '</span></div>' +
          '<div class="summary-stat"><span class="k">Enemigos vivos</span><span class="v">' + (current.enemies ? current.enemies.length : 0) + '</span></div>' +
          '<div class="summary-stat"><span class="k">Salas medias</span><span class="v">' + current.meta.medium + '</span></div>' +
          '<div class="summary-stat"><span class="k">Salas secundarias</span><span class="v">' + current.meta.secondary + '</span></div>' +
          '<div class="summary-stat"><span class="k">Validación</span><span class="v">' + ((current.meta.validation && current.meta.validation.ok) ? 'OK' : 'Revisar') + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="summary-card">' +
        '<div class="summary-title">Objetivos</div>' +
        '<div class="summary-grid">' +
          '<div class="summary-stat"><span class="k">Meta actual</span><span class="v">' + escapeHtml(objectiveText()) + '</span></div>' +
          '<div class="summary-stat"><span class="k">Cofres</span><span class="v">' + (_obj.chestRequired ? (_obj.openedChests + '/' + _obj.totalChests) : '0/0') + '</span></div>' +
          '<div class="summary-stat"><span class="k">Salida</span><span class="v">' + (_obj.completed ? 'Completada' : 'Pendiente') + '</span></div>' +
          '<div class="summary-stat"><span class="k">Estado</span><span class="v">' + (isGameOver() ? 'Derrota' : (_obj.completed ? 'Victoria' : 'En curso')) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="summary-card">' +
        '<div class="summary-title">Héroe activo</div>' +
        '<div class="summary-hero">' +
          '<span class="k">Ficha</span>' +
          '<span class="v">' + (selectedHero ? (escapeHtml(heroDisplayName(selectedHero)) + ' · PV ' + selectedHero.hp + '/' + selectedHero.maxHp + ' · ATQ ' + getHeroAttack(selectedHero) + ' · DEF ' + getHeroDefense(selectedHero) + ' · Alcance ' + getHeroRange(selectedHero)) : '-') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="summary-card">' +
        '<div class="summary-title">Botín de cofres</div>' +
        '<div class="summary-grid">' +
          '<div class="summary-stat"><span class="k">Oro</span><span class="v">' + ((current.inventory && current.inventory.gold) || 0) + '</span></div>' +
          '<div class="summary-stat"><span class="k">Trampas</span><span class="v">' + ((current.inventory && current.inventory.trapsTriggered) || 0) + '</span></div>' +
          '<div class="summary-stat"><span class="k">Últimos hallazgos</span><span class="v">' + ((current.inventory && current.inventory.openedChestRewards && current.inventory.openedChestRewards.length) ? current.inventory.openedChestRewards.map(function (entry) { return escapeHtml(entry.text); }).join(' · ') : 'Todavía no se ha abierto ningún cofre') + '</span></div>' +
        '</div>' +
        '<div class="summary-loot-list">' +
          inventoryBuckets().map(function (bucket) {
            return '<div class="summary-loot-row"><span class="k">' + bucket.label + '</span><span class="v">' + inventoryListHtml(current.inventory ? current.inventory[bucket.key] : []) + '</span></div>';
          }).join('') +
        '</div>' +
      '</div>';
    }
    updateCombatLog();
    updateCombatPreview();
    updateActiveHeroCard();
    updateEndOverlay();
    fitBoard();
  }

  function openDoorAt(x, y) {
    if (!current || !current.turn) return false;
    var key = tileKey(x, y);
    var door = current.doors[key];
    var hero = ensureSelectedHero();
    if (!door || door.open || !current.visible[key] || !hero || !isActiveHero(hero) || !isAdjacent(hero, { x: x, y: y })) return false;
    door.open = true;
    ensureStats().doorsOpened++;
    computeVisibility(current);
    current.reachable = computeReachableTiles(hero, current.turn.movePoints || 0);
    current.attackable = computeAttackableTiles(hero);
    setStatus('Puerta abierta por ' + heroDisplayName(hero) + '. La nueva zona ha quedado revelada.');
    updateTurnInfo();
    render();
    return true;
  }

  function generate() {
    var width = clamp(parseInt(widthEl.value || '30', 10), 18, 80);
    var height = clamp(parseInt(heightEl.value || '20', 10), 10, 50);
    var enemyCount = clamp(parseInt(enemyEl.value || '4', 10), 0, 40);
    var heroCount = clamp(parseInt(heroEl.value || '1', 10), 1, 4);
    var extraRooms = clamp(parseInt(extraRoomsEl.value || '15', 10), 1, 25);
    var style = styleEl.value || 'classic';
    current = generateDungeon(width, height, enemyCount, heroCount, extraRooms, style);
    current.reachable = {};
    current.attackable = {};
    current.distanceMap = {};
    var generatedChestTotal = countTiles(current.map, TILE.CHEST);
    current.objectives = { chestRequired: generatedChestTotal > 0, totalChests: generatedChestTotal, chestOpened: generatedChestTotal === 0, openedChests: 0, completed: false };
    current.combatLog = [];
    current.lastCombat = null;
    current.floatingFx = [];
    current.tileFx = {};
    current.stats = {
      enemiesDefeated: 0,
      doorsOpened: 0,
      heroAttacks: 0,
      enemyAttacks: 0,
      damageDealt: 0,
      damageTaken: 0
    };
    current.enemyPhaseActive = false;
    current.enemyActingId = null;
    current.movementAnimationActive = false;
    current.heroAnimatingId = null;
    _tileEls = null; // force tile grid rebuild on next render
    pushCombatLog('Nueva partida generada.');
    if (statusEl) statusEl.textContent = '';
    resetTurnState();
    setStatus('Mapa generado. Empieza ' + heroDisplayName(getActiveHero()) + '. Pulsa en tirar movimiento. ' + objectiveText());
    render();
  }

  var SAVE_KEY = 'hq_save_v1';

  function saveGame() {
    if (!current) return;
    try {
      var saveData = JSON.stringify({
        state: current,
        savedAt: Date.now()
      });
      localStorage.setItem(SAVE_KEY, saveData);
      setStatus('Partida guardada. ' + objectiveText());
    } catch(e) {
      setStatus('Error al guardar la partida.');
    }
  }

  function loadGame() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { setStatus('No hay partida guardada.'); return; }
      var saveData = JSON.parse(raw);
      if (!saveData || !saveData.state) { setStatus('Guardado corrupto.'); return; }
      current = saveData.state;
      if (!current || !current.map || !current.heroes || !current.rooms) {
        localStorage.removeItem(SAVE_KEY);
        setStatus('Guardado inválido eliminado. Generando nueva partida.');
        generate();
        return;
      }
      // Restaurar campos volátiles que no deben persistir
      current.movementAnimationActive = false;
      current.heroAnimatingId = null;
      current.enemyPhaseActive = false;
      current.enemyActingId = null;
      current.floatingFx = [];
      current.tileFx = {};
      computeVisibility(current);
      var hero = getActiveHero();
      current.reachable = computeReachableTiles(hero, current.turn ? current.turn.movePoints : 0);
      current.attackable = computeAttackableTiles(hero);
      var d = new Date(saveData.savedAt);
      var timeStr = d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0');
      setStatus('Partida cargada (guardada a las ' + timeStr + '). ' + objectiveText());
      updateTurnInfo();
      render();
    } catch(e) {
      setStatus('Error al cargar la partida.');
    }
  }

  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch(e) { return false; }
  }

  board.addEventListener('click', function (ev) {
    var tile = ev.target.closest('.tile');
    if (!tile || !current || isInputLocked()) return;
    var x = parseInt(tile.dataset.x, 10);
    var y = parseInt(tile.dataset.y, 10);

    // Scroll targeting mode
    if (current.scrollTargeting) {
      var key = tileKey(x, y);
      if (current.scrollTargetTiles && current.scrollTargetTiles[key]) {
        fireScrollAtEnemy(current.scrollTargeting.heroId, current.scrollTargeting.scrollIndex, x, y);
      } else {
        // Cancel targeting
        current.scrollTargeting = null;
        current.scrollTargetTiles = {};
        setStatus('Lanzamiento cancelado.');
        render();
      }
      return;
    }

    var hero = getHeroAt(x, y);
    if (hero) {
      selectHero(hero);
      return;
    }
    if (attackEnemyAt(x, y)) return;
    if (openDoorAt(x, y)) return;
    moveSelectedHeroTo(x, y);
  });

  /* =========================================================
     SHOP SYSTEM — 10 random items with prices
     ========================================================= */
  var SHOP_CATALOG = [
    // ── Weapons (price ~ ATQ*40 + ALC*25) ──
    { name:'Daga afilada', price:25 },         // +1 ATQ
    { name:'Daga envenenada', price:30 },       // +1 ATQ
    { name:'Espada corta', price:30 },          // +1 ATQ
    { name:'Hacha de mano', price:28 },         // +1 ATQ
    { name:'Maza de hierro', price:28 },        // +1 ATQ
    { name:'Arco corto', price:50 },            // +1 ATQ +1 ALC
    { name:'Lanza corta', price:55 },           // +1 ATQ +1 ALC
    { name:'Bastón arcano', price:55 },         // +1 ATQ +1 ALC
    { name:'Espada ancha', price:70 },          // +2 ATQ
    { name:'Hacha de guerra', price:75 },       // +2 ATQ
    { name:'Maza pesada', price:70 },           // +2 ATQ
    { name:'Ballesta ligera', price:85 },       // +1 ATQ +2 ALC
    { name:'Arco largo', price:90 },            // +1 ATQ +3 ALC
    { name:'Lanza larga', price:80 },           // +1 ATQ +2 ALC
    { name:'Ballesta pesada', price:120 },      // +2 ATQ +2 ALC
    { name:'Bastón de poder', price:130 },      // +2 ATQ +2 ALC
    { name:'Espada larga', price:100 },         // +2 ATQ
    { name:'Hacha doble', price:140 },          // +3 ATQ
    { name:'Martillo de guerra', price:150 },   // +3 ATQ
    { name:'Espada del caos', price:160 },      // +3 ATQ
    { name:'Espada del alba', price:250 },      // +4 ATQ
    // ── Shields (price ~ DEF*40 + ATQ*35) ──
    { name:'Broquel ligero', price:20 },        // +1 DEF
    { name:'Escudo de madera', price:25 },      // +1 DEF
    { name:'Escudo de hierro', price:65 },      // +2 DEF
    { name:'Escudo reforzado', price:70 },      // +2 DEF
    { name:'Escudo de torre', price:130 },      // +3 DEF
    { name:'Escudo del cruzado', price:170 },   // +3 DEF +1 ATQ
    // ── Helmets ──
    { name:'Casco ligero', price:25 },          // +1 DEF
    { name:'Casco de hierro', price:60 },       // +2 DEF
    { name:'Yelmo de acero', price:65 },        // +2 DEF
    { name:'Capucha arcana', price:80 },        // +1 DEF +1 ATQ
    { name:'Corona de combate', price:140 },    // +3 DEF
    // ── Armor ──
    { name:'Armadura ligera', price:35 },       // +1 DEF
    { name:'Cota de malla', price:80 },         // +2 DEF
    { name:'Túnica encantada', price:90 },      // +1 DEF +1 ATQ
    { name:'Armadura de placas', price:150 },   // +3 DEF
    { name:'Coraza de dragón', price:250 },     // +4 DEF
    // ── Accessories ──
    { name:'Capa de sombras', price:30 },       // +1 DEF
    { name:'Amuleto menor', price:35 },         // +1 ATQ
    { name:'Botas de velocidad', price:50 },    // +2 MOV
    { name:'Amuleto mayor', price:80 },         // +1 ATQ +1 DEF
    { name:'Anillo de fuerza', price:85 },      // +2 ATQ
    { name:'Anillo de protección', price:85 },  // +2 DEF
    { name:'Talismán del héroe', price:160 },   // +1 ATQ +1 DEF +1 ALC
    // ── Potions (price ~ heal*10 or buff*duration*12) ──
    { name:'Antídoto', price:5 },               // heal 1
    { name:'Poción de curación pequeña', price:10 },  // heal 2
    { name:'Poción de curación media', price:20 },    // heal 3
    { name:'Poción de curación grande', price:35 },   // heal 4
    { name:'Poción suprema de curación', price:60 },  // heal 6
    { name:'Elixir de vida', price:90 },              // heal 8
    { name:'Poción de vigor', price:15 },       // +1 ATQ ×2t
    { name:'Poción de defensa', price:15 },     // +1 DEF ×2t
    { name:'Poción de fuerza', price:25 },      // +1 ATQ ×3t
    { name:'Poción de resistencia', price:25 }, // +1 DEF ×3t
    { name:'Poción de velocidad', price:25 },   // +1 ALC ×3t
    { name:'Poción de piel de piedra', price:45 }, // +2 DEF ×3t
    { name:'Poción de fuerza mayor', price:50 },   // +2 ATQ ×3t
    { name:'Poción de furia', price:55 },          // +3 ATQ ×2t
    { name:'Poción de invisibilidad', price:45 },  // +3 DEF ×1t
    // ── Scrolls (price ~ damage*12 + range*5 + area*20) ──
    { name:'Pergamino de curación', price:15 },    // heal 2
    { name:'Pergamino de fuego', price:20 },       // 2 dmg r2
    { name:'Pergamino de escudo', price:22 },      // +2 DEF ×1t
    { name:'Pergamino de rayo', price:40 },        // 3 dmg r3
    { name:'Pergamino de explosión', price:55 },   // 4 dmg r2 area
    { name:'Pergamino de ventisca', price:65 },    // 3 dmg r3 area
    { name:'Pergamino de terremoto', price:100 },  // 6 dmg r2 area2
    { name:'Pergamino épico', price:85 },          // 5 dmg r4
    // ── Keys ──
    { name:'Llave pequeña', price:8 },
    { name:'Llave de sala', price:12 }
  ];

  var currentShop = null; // { items: [{name, price, sold},...] }

  function generateShop() {
    var pool = SHOP_CATALOG.slice();
    // Shuffle
    for (var si = pool.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1));
      var tmp = pool[si]; pool[si] = pool[sj]; pool[sj] = tmp;
    }
    var items = [];
    for (var i = 0; i < Math.min(10, pool.length); i++) {
      // Slightly randomize price ±20%
      var basePrice = pool[i].price;
      var variance = Math.floor(basePrice * 0.2);
      var finalPrice = basePrice + Math.floor(Math.random() * (variance * 2 + 1)) - variance;
      finalPrice = Math.max(1, finalPrice);
      items.push({ name: pool[i].name, price: finalPrice, sold: false });
    }
    currentShop = { items: items };
  }

  function itemStatsText(name) {
    var item = makeItemDefinition(name);
    var bits = [];
    if (item.attackBonus) bits.push('+' + item.attackBonus + ' ATQ');
    if (item.defenseBonus) bits.push('+' + item.defenseBonus + ' DEF');
    if (item.rangeBonus) bits.push('+' + item.rangeBonus + ' ALC');
    if (item.moveBonus) bits.push('+' + item.moveBonus + ' MOV');
    if (item.effect === 'heal') bits.push('Cura ' + (item.value || 0) + ' PV');
    if (item.effect === 'buff_attack') bits.push('+' + (item.value||0) + ' ATQ × ' + (item.duration||0) + 't');
    if (item.effect === 'buff_defense') bits.push('+' + (item.value||0) + ' DEF × ' + (item.duration||0) + 't');
    if (item.effect === 'buff_range') bits.push('+' + (item.value||0) + ' ALC × ' + (item.duration||0) + 't');
    if (item.effect === 'damage') bits.push(item.value + ' daño · rango ' + (item.range||1));
    return bits.join(' · ') || '—';
  }

  function itemTypeLabel(name) {
    var item = makeItemDefinition(name);
    var labels = { weapon:'Arma', shield:'Escudo', helmet:'Casco', armor:'Armadura', accessory:'Accesorio', potion:'Poción', scroll:'Pergamino', key:'Llave', special:'Especial' };
    return labels[item.type] || 'Objeto';
  }

  function renderShop() {
    if (!shopItemsEl || !currentShop) return;
    var gold = (current && current.inventory) ? current.inventory.gold : 0;
    if (shopGoldEl) shopGoldEl.textContent = '💰 ' + gold + ' oro';

    shopItemsEl.innerHTML = currentShop.items.map(function (entry, idx) {
      var canAfford = gold >= entry.price && !entry.sold;
      return '<div class="shop-item' + (entry.sold ? ' sold' : '') + '" data-idx="' + idx + '">' +
        '<div class="shop-item-info">' +
          '<div class="shop-item-name">' + escapeHtml(entry.name) + '</div>' +
          '<div class="shop-item-stats">' + itemStatsText(entry.name) + '</div>' +
          '<div class="shop-item-type">' + itemTypeLabel(entry.name) + '</div>' +
        '</div>' +
        '<button class="shop-buy-btn" data-idx="' + idx + '"' + (!canAfford ? ' disabled' : '') + '>' +
          (entry.sold ? 'Vendido' : entry.price + ' 💰') +
        '</button>' +
      '</div>';
    }).join('');
  }

  function openShop() {
    if (!current || !current.heroes || !current.heroes.length) return;
    generateShop(); // fresh 10 items every time
    renderShop();
    if (shopOverlayEl) shopOverlayEl.classList.remove('hidden');
  }

  function closeShop() {
    if (shopOverlayEl) shopOverlayEl.classList.add('hidden');
  }

  function buyShopItem(index) {
    if (!current || !currentShop || !currentShop.items[index]) return;
    var entry = currentShop.items[index];
    if (entry.sold) return;
    var gold = (current && current.inventory) ? current.inventory.gold : 0;
    if (gold < entry.price) return;

    var hero = ensureSelectedHero() || getActiveHero();
    if (!hero) return;

    current.inventory.gold -= entry.price;
    entry.sold = true;

    var item = makeItemDefinition(entry.name);
    if (!hero.inventory) hero.inventory = createHeroInventory();

    if (item.type === 'weapon' || item.type === 'shield' || item.type === 'armor' || item.type === 'helmet' || item.type === 'accessory') {
      if (!hero.inventory.backpack) hero.inventory.backpack = [];
      hero.inventory.backpack.push(item);
      showToast('🛒 Comprado: ' + entry.name + ' → mochila', 'toast-loot');
    } else if (item.type === 'potion') {
      hero.inventory.potions.push(item);
      showToast('🛒 Comprado: ' + entry.name, 'toast-loot');
    } else if (item.type === 'scroll') {
      hero.inventory.scrolls.push(item);
      showToast('🛒 Comprado: ' + entry.name, 'toast-loot');
    } else if (item.type === 'key') {
      hero.inventory.keys.push(item);
      showToast('🛒 Comprado: ' + entry.name, 'toast-loot');
    } else {
      hero.inventory.specials.push(item);
      showToast('🛒 Comprado: ' + entry.name, 'toast-loot');
    }

    syncHeroDerivedStats(hero);
    pushCombatLog(heroDisplayName(hero) + ' compra ' + entry.name + ' por ' + entry.price + ' oro.');
    renderShop();
    render();
  }

  // Shop event delegation
  if (shopOverlayEl) {
    shopOverlayEl.addEventListener('click', function (ev) {
      var buyBtn = ev.target.closest('.shop-buy-btn');
      if (buyBtn) {
        buyShopItem(parseInt(buyBtn.dataset.idx, 10));
        return;
      }
      // Click on overlay background closes shop
      if (ev.target === shopOverlayEl) closeShop();
    });
  }
  if (shopCloseBtn) shopCloseBtn.addEventListener('click', closeShop);

  generateBtn.addEventListener('click', function () {
    currentShop = null; // reset shop on new game
    generate();
  });
  if (endRestartBtn) endRestartBtn.addEventListener('click', function () {
    currentShop = null;
    generate();
  });
  fitBtn.addEventListener('click', fitBoard);
  rollBtn.addEventListener('click', rollMovement);
  if (shopBtn) shopBtn.addEventListener('click', openShop);
  endTurnBtn.addEventListener('click', endTurn);
  var _resizeTimer = null;
  window.addEventListener('resize', function () {
    if (_resizeTimer) clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(fitBoard, 80);
  });

  var saveBtn = document.getElementById('saveBtn');
  var loadBtn = document.getElementById('loadBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveGame);
  if (loadBtn) loadBtn.addEventListener('click', loadGame);

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.inv-use-btn');
    if (!btn || !current || isInputLocked()) return;
    var heroId = btn.dataset.hero;
    var type = btn.dataset.type;
    var hero = getHeroById(heroId);
    if (!hero) return;
    if (type === 'potion') usePotion(hero, parseInt(btn.dataset.index, 10));
    else if (type === 'scroll') useScroll(hero, parseInt(btn.dataset.index, 10));
    else if (type === 'equip') equipFromBackpack(hero, parseInt(btn.dataset.index, 10));
    else if (type === 'unequip') unequipSlot(hero, btn.dataset.slot);
  });

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.log-filter-btn');
    if (!btn) return;
    var filter = btn.dataset.filter;
    if (filter === 'clear') {
      if (current) current.combatLog = [];
      updateCombatLog();
    } else if (filter) {
      logFilter = filter;
      updateCombatLog();
    }
  });

  populateLegendIcons();
  var loaded = false;
  if (hasSave()) {
    try {
      loadGame();
      loaded = !!(current && current.map && current.heroes);
    } catch(e) { loaded = false; }
  }
  if (!loaded) generate();
})();
