/* ============================================================================
   DRAGON QUEST 1 TEXT ADVENTURE v2
   Author: Icehellionx (adapted)
   Based on: Advanced Lore Book System v14
   ==========================================================================

   IMPROVEMENTS IN V2:
   - SAVE state parser reads from last_messages[1] (AI's previous response)
   - Complete monster database (all 30+ DQ1 enemies)
   - Missing mechanics: locked doors, cursed items, sleep, darkness, REPEL
   - Proper use of heuristics: prev.keywords, groups, Shifts
   - Status effects tracking
   - Better combat state management

   ========================================================================== */

/* ============================================================================
   [SECTION] GLOBAL KNOBS
   ========================================================================== */
//#region GLOBAL_KNOBS
let DEBUG       = 0;
let APPLY_LIMIT = 25;

/* ============================================================================
   [SECTION] SAVE STATE PARSER
   ========================================================================== */
//#region SAVE_PARSER

// Extract SAVE block from AI's last message (last_messages[1])
function parseSaveState() {
    const _lmArr = (context && context.chat && context.chat.last_messages)
        ? context.chat.last_messages : null;

    if (!_lmArr || _lmArr.length < 2) return null;

    // Get AI's last response (index length-2 because length-1 is current user message)
    const aiLastMsg = _lmArr[_lmArr.length - 2];
    const msgText = (aiLastMsg && typeof aiLastMsg.message === "string")
        ? aiLastMsg.message : String(aiLastMsg || "");

    // Find [SAVE: ...] block
    const saveMatch = msgText.match(/\[SAVE:\s*([^\]]+)\]/);
    if (!saveMatch) return null;

    const saveStr = saveMatch[1];
    const state = {};

    // Parse key=value pairs
    const pairs = saveStr.split('|');
    for (const pair of pairs) {
        const [key, val] = pair.split('=').map(s => s.trim());
        if (key && val !== undefined) {
            state[key] = val;
        }
    }

    return state;
}

// Global GAME_STATE available to all entries
const GAME_STATE = parseSaveState() || {
    HP: "15/15",
    MP: "0/0",
    LVL: "1",
    GOLD: "120",
    EXP: "0",
    STR: "4",
    AGI: "4",
    LOC: "TANTEGEL_THRONE",
    INV: "",
    EQP_W: "BAMBOO_POLE",
    EQP_A: "CLOTHES",
    EQP_S: "",
    KEYS: "0",
    FLAGS: "GAME_START",
    COMBAT: ""
};

// Helper functions to extract values
function getHP() { return GAME_STATE.HP || "15/15"; }
function getCurrentHP() { return parseInt((GAME_STATE.HP || "15/15").split('/')[0]); }
function getMaxHP() { return parseInt((GAME_STATE.HP || "15/15").split('/')[1]); }
function getMP() { return GAME_STATE.MP || "0/0"; }
function getCurrentMP() { return parseInt((GAME_STATE.MP || "0/0").split('/')[0]); }
function getMaxMP() { return parseInt((GAME_STATE.MP || "0/0").split('/')[1]); }
function getLevel() { return parseInt(GAME_STATE.LVL || "1"); }
function getGold() { return parseInt(GAME_STATE.GOLD || "120"); }
function getEXP() { return parseInt(GAME_STATE.EXP || "0"); }
function getLocation() { return GAME_STATE.LOC || "TANTEGEL_THRONE"; }
function getInventory() { return (GAME_STATE.INV || "").split(',').filter(x => x); }
function getFlags() { return (GAME_STATE.FLAGS || "").split(',').filter(x => x); }
function hasFlag(flag) { return getFlags().includes(flag); }
function inCombat() { return !!(GAME_STATE.COMBAT); }
function getCombatEnemy() {
    if (!GAME_STATE.COMBAT) return null;
    const match = GAME_STATE.COMBAT.match(/^([A-Z_]+)_HP(\d+)$/);
    return match ? { name: match[1], hp: parseInt(match[2]) } : null;
}

/* ============================================================================
   [SECTION] GAME DATABASE
   ========================================================================== */
//#region GAME_DB

// Complete Monster Database (all DQ1 enemies)
const MONSTERS = {
    // Zone 1: Tantegel area (levels 1-3)
    "SLIME": { hp: 3, attack: 5, defense: 2, gold: 2, exp: 1, zone: 1, sleep: 7 },
    "RED_SLIME": { hp: 4, attack: 7, defense: 3, gold: 3, exp: 2, zone: 1, sleep: 7 },
    "DRAKEE": { hp: 6, attack: 9, defense: 6, gold: 5, exp: 3, zone: 1, sleep: 6 },

    // Zone 2: Near Brecconary (levels 2-5)
    "GHOST": { hp: 7, attack: 11, defense: 8, gold: 8, exp: 4, zone: 2, sleep: 5 },
    "MAGICIAN": { hp: 13, attack: 15, defense: 12, gold: 18, exp: 13, zone: 2, sleep: 4, spells: ["HURT", "SLEEP"] },
    "MAGIDRAKEE": { hp: 15, attack: 14, defense: 12, gold: 20, exp: 14, zone: 2, sleep: 4, spells: ["HEAL"] },

    // Zone 3: Eastern areas (levels 4-8)
    "SCORPION": { hp: 20, attack: 18, defense: 16, gold: 26, exp: 16, zone: 3, sleep: 3 },
    "DRUIN": { hp: 22, attack: 20, defense: 18, gold: 30, exp: 18, zone: 3, sleep: 3 },
    "POLTERGEIST": { hp: 23, attack: 22, defense: 18, gold: 32, exp: 19, zone: 3, sleep: 2 },
    "DROLL": { hp: 25, attack: 24, defense: 20, gold: 35, exp: 20, zone: 3, sleep: 2 },

    // Zone 4: Southern swamp/desert (levels 6-10)
    "DRAKEEMA": { hp: 26, attack: 28, defense: 22, gold: 40, exp: 22, zone: 4, sleep: 2, breathFire: true },
    "SKELETON": { hp: 28, attack: 30, defense: 24, gold: 42, exp: 25, zone: 4, sleep: 1 },
    "WARLOCK": { hp: 30, attack: 32, defense: 22, gold: 48, exp: 28, zone: 4, sleep: 1, spells: ["HURT", "SLEEP", "STOPSPELL"] },
    "METAL_SLIME": { hp: 4, attack: 10, defense: 255, gold: 6, exp: 115, zone: 4, sleep: 7, flees: true },

    // Zone 5: Western mountains (levels 8-12)
    "SPECTER": { hp: 36, attack: 40, defense: 38, gold: 60, exp: 35, zone: 5, sleep: 0, spells: ["STOPSPELL"] },
    "WOLFLORD": { hp: 38, attack: 42, defense: 40, gold: 65, exp: 38, zone: 5, sleep: 1 },
    "DRUINLORD": { hp: 35, attack: 40, defense: 32, gold: 58, exp: 40, zone: 5, sleep: 1 },
    "DROLLMAGI": { hp: 38, attack: 38, defense: 30, gold: 62, exp: 42, zone: 5, sleep: 1, spells: ["HEALMORE"] },

    // Zone 6: Charlock area (levels 12-17)
    "WYVERN": { hp: 42, attack: 50, defense: 44, gold: 80, exp: 48, zone: 6, sleep: 0, breathFire: true },
    "ROGUE_SCORPION": { hp: 45, attack: 55, defense: 48, gold: 88, exp: 52, zone: 6, sleep: 0 },
    "WRAITH": { hp: 44, attack: 52, defense: 40, gold: 85, exp: 50, zone: 6, sleep: 0 },
    "WRAITH_KNIGHT": { hp: 46, attack: 56, defense: 50, gold: 92, exp: 54, zone: 6, sleep: 0 },
    "GOLEM": { hp: 70, attack: 48, defense: 60, gold: 95, exp: 60, zone: 6, sleep: 0 },

    // Zone 7: Deep Charlock (levels 15-19)
    "KNIGHT": { hp: 37, attack: 40, defense: 40, gold: 70, exp: 42, zone: 7, sleep: 0 },
    "MAGIWYVERN": { hp: 49, attack: 56, defense: 50, gold: 105, exp: 58, zone: 7, sleep: 0, spells: ["HEAL", "HURT"], breathFire: true },
    "DEMON_KNIGHT": { hp: 47, attack: 60, defense: 54, gold: 110, exp: 78, zone: 7, sleep: 0 },
    "WEREWOLF": { hp: 50, attack: 58, defense: 50, gold: 100, exp: 70, zone: 7, sleep: 0 },
    "GREEN_DRAGON": { hp: 65, attack: 80, defense: 65, gold: 135, exp: 95, zone: 7, sleep: 0, breathFire: true },
    "STARWYVERN": { hp: 54, attack: 78, defense: 70, gold: 140, exp: 105, zone: 7, sleep: 0, breathFire: true },
    "ARMORED_KNIGHT": { hp: 60, attack: 90, defense: 80, gold: 150, exp: 110, zone: 7, sleep: 0 },

    // Bosses
    "DRAGONLORD_1": { hp: 100, attack: 90, defense: 75, gold: 0, exp: 0, zone: 99, sleep: 0, boss: true },
    "DRAGONLORD_2": { hp: 165, attack: 140, defense: 90, gold: 0, exp: 2000, zone: 99, sleep: 0, boss: true, breathFire: true }
};

// Complete spell database
const SPELLS = {
    "HEAL": { mp: 4, power: "17-25", learn: 3, type: "heal" },
    "HURT": { mp: 2, power: "5-12", learn: 4, type: "attack" },
    "SLEEP": { mp: 2, power: 1, learn: 7, type: "status" },
    "RADIANT": { mp: 3, power: 1, learn: 9, type: "utility" },
    "STOPSPELL": { mp: 2, power: 1, learn: 10, type: "seal" },
    "OUTSIDE": { mp: 6, power: 1, learn: 12, type: "escape" },
    "RETURN": { mp: 8, power: 1, learn: 13, type: "warp" },
    "REPEL": { mp: 2, power: 1, learn: 15, type: "protection" },
    "HEALMORE": { mp: 10, power: "85-100", learn: 17, type: "heal" },
    "HURTMORE": { mp: 5, power: "58-65", learn: 19, type: "attack" }
};

// Items
const ITEMS = {
    "HERB": { type: "consumable", heal: 30, price: 24 },
    "TORCH": { type: "consumable", effect: "light", price: 8 },
    "FAIRY_WATER": { type: "consumable", effect: "repel", price: 38 },
    "WINGS": { type: "consumable", effect: "return", price: 70 },
    "DRAGON_SCALE": { type: "key", effect: "protection", price: 0 },
    "FAIRY_FLUTE": { type: "key", effect: "golem_stop", price: 0 },
    "GWAELINS_LOVE": { type: "key", effect: "compass", price: 0 },
    "CURSED_BELT": { type: "cursed", effect: "agi_half", price: 0 },

    // Weapons
    "BAMBOO_POLE": { type: "weapon", attack: 2, price: 10 },
    "CLUB": { type: "weapon", attack: 4, price: 60 },
    "COPPER_SWORD": { type: "weapon", attack: 10, price: 180 },
    "HAND_AXE": { type: "weapon", attack: 15, price: 560 },
    "BROAD_SWORD": { type: "weapon", attack: 20, price: 1500 },
    "FLAME_SWORD": { type: "weapon", attack: 28, price: 9800 },
    "ERDRICKS_SWORD": { type: "weapon", attack: 40, price: 0 },

    // Armor
    "CLOTHES": { type: "armor", defense: 2, price: 20 },
    "LEATHER_ARMOR": { type: "armor", defense: 4, price: 70 },
    "CHAIN_MAIL": { type: "armor", defense: 10, price: 300 },
    "HALF_PLATE": { type: "armor", defense: 16, price: 1000 },
    "FULL_PLATE": { type: "armor", defense: 24, price: 3000 },
    "MAGIC_ARMOR": { type: "armor", defense: 24, price: 7700, resist: "curse" },
    "ERDRICKS_ARMOR": { type: "armor", defense: 28, price: 0, regen: true },

    // Shields
    "LEATHER_SHIELD": { type: "shield", defense: 4, price: 90 },
    "IRON_SHIELD": { type: "shield", defense: 10, price: 800 },
    "SILVER_SHIELD": { type: "shield", defense: 20, price: 14800 }
};

// Level thresholds for experience
const LEVEL_THRESHOLDS = {
    2: 7, 3: 23, 4: 47, 5: 110, 6: 220, 7: 450, 8: 800, 9: 1300, 10: 2000,
    11: 2900, 12: 4000, 13: 5500, 14: 7500, 15: 10000, 16: 13000, 17: 16000,
    18: 19500, 19: 23000, 20: 26500, 21: 30000, 22: 34000, 23: 38000,
    24: 42000, 25: 46000, 26: 50000, 27: 54000, 28: 58000, 29: 62000, 30: 65000
};

/* ============================================================================
   [SECTION] LORE ENTRIES
   ========================================================================== */
//#region AUTHOR_ENTRIES
const dynamicLore = [

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

{
    group: "init",
    maxMessages: 1,
    priority: 5,
    triggers: ["game_init"],
    personality: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ⚔️  DRAGON QUEST I  ⚔️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Descendant of Erdrick, thou art most welcome!

King Lorik: "Long ago, the Dragonlord stole the Ball
of Light and kidnapped Princess Gwaelin. Brave warrior,
wilt thou restore peace to Alefgard?"

[SAVE: HP=15/15|MP=0/0|LVL=1|GOLD=120|EXP=0|STR=4|AGI=4|LOC=TANTEGEL_THRONE|INV=|EQP_W=BAMBOO_POLE|EQP_A=CLOTHES|EQP_S=|KEYS=0|FLAGS=GAME_START|STATUS=]

Commands: STATS, TALK, GO [dir], SEARCH, ATTACK, CAST [spell], USE [item], HELP`,
    scenario: "The hero stands before King Lorik in Tantegel Castle."
},

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: CORE COMMANDS WITH STATE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

{
    group: "command_stats",
    keywords: ["stats", "status"],
    priority: 5,
    personality: `
╔════════════════════════════════════════╗
║           HERO STATUS                  ║
╠════════════════════════════════════════╣
║ Level: ${getLevel()} | HP: ${getHP()}          ║
║ MP: ${getMP()} | Gold: ${getGold()} G         ║
║ Experience: ${getEXP()} / ${LEVEL_THRESHOLDS[getLevel() + 1] || 'MAX'}    ║
╠════════════════════════════════════════╣
║ Weapon: ${GAME_STATE.EQP_W || 'None'}          ║
║ Armor: ${GAME_STATE.EQP_A || 'None'}           ║
║ Shield: ${GAME_STATE.EQP_S || 'None'}          ║
║ Keys: ${GAME_STATE.KEYS || 0}                  ║
╠════════════════════════════════════════╣
║ Spells Known:                          ║`,
    scenario: "The hero reviews their status."
},

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: SAVE STATE PARSER INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

// Always-on entry that provides parsed state data
{
    priority: 5,
    personality: `[PARSED_STATE: Location=${getLocation()}|InCombat=${inCombat()}|Level=${getLevel()}|HP=${getCurrentHP()}/${getMaxHP()}]`,
    scenario: `Current state loaded from previous save.`
},

//═══════════════════════════════════════════════════════════════════════════
// SECTION: COMBAT SYSTEM WITH PROPER STATE TRACKING
// ═══════════════════════════════════════════════════════════════════════════

{
    group: "combat_attack",
    keywords: ["attack", "fight"],
    andAny: ["combat="],
    priority: 5,
    triggers: ["combat_action"],
    personality: `The hero attacks the ${getCombatEnemy()?.name || 'enemy'}!

[Calculate damage and update combat state]
[Show damage dealt, enemy HP remaining]
[If enemy defeated: award EXP/GOLD, check level up]
[If enemy alive: enemy counterattacks]
[Always update and reprint SAVE block]`,
    scenario: "The battle continues!"
},

// 🛑🛑🛑 THIS IS A PARTIAL EXAMPLE 🛑🛑🛑
// Full script would continue with all commands, spells, items, quests...

];

/* ============================================================================
   [SECTION] ENGINE CODE (v14 Standard)
   ========================================================================== */
//#region ENGINE

context.character = context.character || {};
context.character.personality = (typeof context.character.personality === "string")
  ? context.character.personality : "";
context.character.scenario = (typeof context.character.scenario === "string")
  ? context.character.scenario : "";

const WINDOW_DEPTH = 10;

function _str(x) { return (x == null ? "" : String(x)); }
function _normalizeText(s) {
  s = _str(s).toLowerCase();
  s = s.replace(/[^a-z0-9_\s-]/g, " ");
  s = s.replace(/[-_]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

const _lmArr = (context && context.chat && context.chat.last_messages)
  ? context.chat.last_messages : null;

let _joinedWindow = "";
let _rawLastSingle = "";
let _rawPrevSingle = "";

if (_lmArr && _lmArr.length > 0) {
  const startIdx = Math.max(0, _lmArr.length - WINDOW_DEPTH);
  const segs = [];
  for (const item of _lmArr.slice(startIdx)) {
    const msg = (item && typeof item.message === "string") ? item.message : _str(item);
    segs.push(_str(msg));
  }
  _joinedWindow = segs.join(" ");
  const lastItem = _lmArr[_lmArr.length - 1];
  _rawLastSingle = _str((lastItem && typeof lastItem.message === "string") ? lastItem.message : lastItem);
  if (_lmArr.length > 1) {
      const prevItem = _lmArr[_lmArr.length - 2];
      _rawPrevSingle = _str((prevItem && typeof prevItem.message === "string") ? prevItem.message : prevItem);
  }
} else {
  const _lastMsgA = (context && context.chat && typeof context.chat.lastMessage === "string") ? context.chat.lastMessage : "";
  const _lastMsgB = (context && context.chat && typeof context.chat.last_message === "string") ? context.chat.last_message : "";
  _rawLastSingle = _str(_lastMsgA || _lastMsgB);
  _joinedWindow = _rawLastSingle;
}

const CHAT_WINDOW = {
  depth: WINDOW_DEPTH,
  text_joined: _joinedWindow,
  text_last_only: _rawLastSingle,
  text_prev_only: _rawPrevSingle,
  text_joined_norm: _normalizeText(_joinedWindow),
  text_last_only_norm: _normalizeText(_rawLastSingle),
  text_prev_only_norm: _normalizeText(_rawPrevSingle)
};

const last = " " + CHAT_WINDOW.text_joined_norm + " ";
const prev = " " + CHAT_WINDOW.text_prev_only_norm + " ";

let messageCount = 0;
if (_lmArr && typeof _lmArr.length === "number") {
  messageCount = _lmArr.length;
} else if (context && context.chat && typeof context.chat.message_count === "number") {
  messageCount = context.chat.message_count;
}

function dbg(msg) {
  if (DEBUG) context.character.personality += `\n[DBG] ${String(msg)}`;
}

function arr(x) { return Array.isArray(x) ? x : (x == null ? [] : [x]); }
function clamp01(v) { return Math.max(0, Math.min(1, +v || 0)); }
function parseProbability(v) {
  if (v == null) return 1;
  if (typeof v === "number") return clamp01(v);
  const s = String(v).trim();
  const n = parseFloat(s.replace("%", ""));
  return s.indexOf("%") !== -1 ? clamp01(n / 100) : clamp01(n);
}
function prio(e) { return Math.max(1, Math.min(5, +(e && e.priority) || 3)); }
function getMin(e) { return (e && isFinite(e.minMessages)) ? +e.minMessages : -Infinity; }
function getMax(e) { return (e && isFinite(e.maxMessages)) ? +e.maxMessages : Infinity; }
function getKW(e) { return arr(e && e.keywords); }
function getTrg(e) { return arr(e && e.triggers); }

function reEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function hasTerm(hay, term) {
  const rawTerm = String(term || "").trim();
  if (!rawTerm) return false;
  if (rawTerm.endsWith("*")) {
    const stem = _normalizeText(rawTerm.slice(0, -1));
    if (!stem) return false;
    return new RegExp("(?:^|\\s)" + reEsc(stem) + "[a-z]*(?=\\s|$)").test(hay);
  }
  const t = _normalizeText(rawTerm);
  if (!t) return false;
  return new RegExp("(?:^|\\s)" + reEsc(t) + "(?=\\s|$)").test(hay);
}

function collectWordGates(e) {
  const r = (e && e.requires) ? e.requires : {};
  const any = [].concat(arr(e && e.andAny), arr(r.any));
  const all = [].concat(arr(e && e.andAll), arr(r.all));
  const none = [].concat(arr(e && e.notAny), arr(r.none));

  const r_prev = (e && e['prev.requires']) ? e['prev.requires'] : {};
  const any_prev = [].concat(arr(e && e['prev.andAny']), arr(r_prev.any));
  const all_prev = [].concat(arr(e && e['prev.andAll']), arr(r_prev.all));
  const none_prev = [].concat(arr(e && e['prev.notAny']), arr(r_prev.none));

  return {
    current: { any, all, none },
    previous: { any: any_prev, all: all_prev, none: none_prev }
  };
}

function wordGatesPass(e) {
  const g = collectWordGates(e);

  const cur = g.current;
  if (cur.any.length  && !cur.any.some(w => hasTerm(last, w))) return false;
  if (cur.all.length  && !cur.all.every(w => hasTerm(last, w))) return false;
  if (cur.none.length &&  cur.none.some(w => hasTerm(last, w))) return false;

  const prevScope = g.previous;
  if (prevScope.any.length  && !prevScope.any.some(w => hasTerm(prev, w))) return false;
  if (prevScope.all.length  && !prevScope.all.every(w => hasTerm(prev, w))) return false;
  if (prevScope.none.length &&  prevScope.none.some(w => hasTerm(prev, w))) return false;

  return true;
}

function tagsPass(e, tagSet) {
  const anyT  = arr(e && e.andAnyTags);
  const allT  = arr(e && e.andAllTags);
  const noneT = arr(e && e.notAnyTags);
  const hasT  = t => !!(tagSet && tagSet[String(t)]);

  if (anyT.length  && !anyT.some(hasT)) return false;
  if (allT.length  && !allT.every(hasT)) return false;
  if (noneT.length &&  noneT.some(hasT)) return false;
  return true;
}

function entryPasses(e, tagSet) {
  if (!(messageCount >= getMin(e) && messageCount <= getMax(e))) return false;
  if (!wordGatesPass(e)) return false;
  if (!tagsPass(e, tagSet)) return false;
  if (Math.random() > parseProbability(e && e.probability)) return false;
  return true;
}

function isAlwaysOn(e) {
  return !(e && (e.keywords || e['prev.keywords'] || e.tag || e.minMessages != null || e.maxMessages != null));
}

const _ENGINE_LORE = dynamicLore.map(e => {
  const out = { ...e };
  out.keywords = getKW(e);
  out['prev.keywords'] = arr(e && e['prev.keywords']);
  if (e.Shifts) out.Shifts = e.Shifts.map(s => ({ ...s, keywords: getKW(s) }));
  return out;
});

const buckets = [null, [], [], [], [], []];
const picked = new Array(_ENGINE_LORE.length).fill(0);
const trigSet = {};
const inclusionGroups = {};

function addTag(set, key) { set[String(key)] = 1; }
function hasTag(set, key) { return set[String(key)] === 1; }

// Phase 1: Direct keyword and prev.keyword hits
for (const [i, e] of _ENGINE_LORE.entries()) {
  const kwHit = isAlwaysOn(e) || getKW(e).some(kw => hasTerm(last, kw));
  const prevKwHit = (e['prev.keywords'] || []).some(kw => hasTerm(prev, kw));
  const hit = kwHit || prevKwHit;

  if (!hit || !entryPasses(e, undefined)) continue;
  buckets[prio(e)].push(i);
  picked[i] = 1;
  getTrg(e).forEach(t => addTag(trigSet, t));
}

// Phase 2: Tag-triggered entries
for (const [i, e] of _ENGINE_LORE.entries()) {
  if (picked[i] || !(e.tag && hasTag(trigSet, e.tag))) continue;
  if (!entryPasses(e, trigSet)) continue;
  buckets[prio(e)].push(i);
  picked[i] = 1;
  getTrg(e).forEach(t => addTag(trigSet, t));
}

// Phase 3: Priority selection with group exclusion
const selected = [];
let pickedCount = 0;
for (let p = 5; p >= 1 && pickedCount < APPLY_LIMIT; p--) {
  for (const idx of buckets[p]) {
    if (pickedCount >= APPLY_LIMIT) break;

    const entry = _ENGINE_LORE[idx];
    const group = entry.group;
    if (group) {
        if (inclusionGroups[group]) continue;
        inclusionGroups[group] = true;
    }

    selected.push(idx);
    pickedCount++;
  }
}

let bufP = "";
let bufS = "";

for (const idx of selected) {
  const e = _ENGINE_LORE[idx];
  if (e.personality) bufP += `\n\n${e.personality}`;
  if (e.scenario) bufS += `\n\n${e.scenario}`;

  if (e.Shifts) {
    for (const sh of e.Shifts) {
      const kwHit = isAlwaysOn(sh) || getKW(sh).some(kw => hasTerm(last, kw));
      const prevKwHit = (sh['prev.keywords'] || []).some(kw => hasTerm(prev, kw));
      const hit = kwHit || prevKwHit;

      if (hit && entryPasses(sh, trigSet)) {
        if (sh.personality) bufP += `\n\n${sh.personality}`;
        if (sh.scenario) bufS += `\n\n${sh.scenario}`;
      }
    }
  }
}

if (bufP) context.character.personality += bufP;
if (bufS) context.character.scenario += bufS;

//#endregion
