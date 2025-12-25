/* ============================================================================
   DRAGON QUEST 1 TEXT ADVENTURE - FINAL VERSION
   Author: Icehellionx (adapted)

   FINAL IMPROVEMENTS:
   ✅ Derived tags from SAVE state (persistent state tracking)
   ✅ Fixed combat/death/location gates (tag-based, not user input)
   ✅ Added EQUIPMENT and EXITS databases
   ✅ Robust SAVE parser with validation
   ✅ Damage clamping and proper math
   ✅ Shop state persistence via STATUS field
   ✅ Wiki references removed - canon guidance instead
   ✅ minMessages guards to prevent turn-1 spam
   ✅ SAVE validation warnings for LLM
   ========================================================================== */

/* ============================================================================
   [SECTION] GLOBAL KNOBS
   ========================================================================== */
//#region GLOBAL_KNOBS
let DEBUG       = 0;
let APPLY_LIMIT = 15;

/* ============================================================================
   [SECTION] SAVE STATE PARSER & VALIDATION
   ========================================================================== */
//#region SAVE_PARSER

function parseSaveState() {
    const _lmArr = (context && context.chat && context.chat.last_messages)
        ? context.chat.last_messages : null;
    if (!_lmArr || _lmArr.length < 2) return null;

    // Try last AI message (index -2 if user is -1)
    let aiLastMsg = _lmArr[_lmArr.length - 2];
    let msgText = (aiLastMsg && typeof aiLastMsg.message === "string")
        ? aiLastMsg.message : String(aiLastMsg || "");

    // Fallback: search backwards for SAVE block
    if (!msgText.includes("[SAVE:")) {
        for (let i = _lmArr.length - 1; i >= 0; i--) {
            const item = _lmArr[i];
            const txt = (item && typeof item.message === "string") ? item.message : String(item || "");
            if (txt.includes("[SAVE:")) {
                msgText = txt;
                break;
            }
        }
    }

    // Match SAVE block (non-greedy, handles multiline)
    const saveMatch = msgText.match(/\[SAVE:\s*([^\]]+?)\]/);
    if (!saveMatch) return null;

    const saveStr = saveMatch[1].replace(/\s+/g, ' ').trim();
    const state = {};

    // Split by | but only at top level
    const pairs = saveStr.split('|');
    for (const pair of pairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) continue;
        const key = pair.substring(0, eqIdx).trim();
        const val = pair.substring(eqIdx + 1).trim();
        if (key && val !== undefined) state[key] = val;
    }
    return state;
}

// Check if last AI message has valid SAVE block
function checkSaveBlockPresent() {
    const _lmArr = (context && context.chat && context.chat.last_messages) || [];
    if (_lmArr.length < 2) return true; // First turn, no check needed

    const aiLastMsg = _lmArr[_lmArr.length - 2];
    const msgText = (aiLastMsg && typeof aiLastMsg.message === "string")
        ? aiLastMsg.message : String(aiLastMsg || "");

    return msgText.includes("[SAVE:");
}

const DEFAULT_SAVE = {
    HP: "15/15", MP: "0/0", LVL: "1", GOLD: "120", EXP: "0",
    STR: "4", AGI: "4", LOC: "TANTEGEL_THRONE", INV: "",
    EQP_W: "BAMBOO_POLE", EQP_A: "CLOTHES", EQP_S: "",
    KEYS: "0", FLAGS: "GAME_START", COMBAT: "", STATUS: ""
};

let GAME_STATE = parseSaveState() || {...DEFAULT_SAVE};

// Validate and repair SAVE
function validateSave(state) {
    for (const key in DEFAULT_SAVE) {
        if (!(key in state) || state[key] === undefined || state[key] === null) {
            state[key] = DEFAULT_SAVE[key];
        }
    }
    return state;
}

GAME_STATE = validateSave(GAME_STATE);

// Helper functions with NaN guards
function getHP() { return GAME_STATE.HP || "15/15"; }
function getCurrentHP() {
    const parts = (GAME_STATE.HP || "15/15").split('/');
    const val = parseInt(parts[0]);
    return isNaN(val) ? 15 : val;
}
function getMaxHP() {
    const parts = (GAME_STATE.HP || "15/15").split('/');
    const val = parseInt(parts[1]);
    return isNaN(val) ? 15 : val;
}
function getMP() { return GAME_STATE.MP || "0/0"; }
function getCurrentMP() {
    const parts = (GAME_STATE.MP || "0/0").split('/');
    const val = parseInt(parts[0]);
    return isNaN(val) ? 0 : val;
}
function getMaxMP() {
    const parts = (GAME_STATE.MP || "0/0").split('/');
    const val = parseInt(parts[1]);
    return isNaN(val) ? 0 : val;
}
function getLevel() {
    const val = parseInt(GAME_STATE.LVL || "1");
    return isNaN(val) ? 1 : val;
}
function getGold() {
    const val = parseInt(GAME_STATE.GOLD || "120");
    return isNaN(val) ? 120 : val;
}
function getLocation() { return (GAME_STATE.LOC || "TANTEGEL_THRONE").toUpperCase(); }
function getFlags() { return (GAME_STATE.FLAGS || "").split(',').map(f => f.trim()).filter(x => x); }
function hasFlag(flag) { return getFlags().map(f => f.toUpperCase()).includes(flag.toUpperCase()); }
function inCombat() { return !!(GAME_STATE.COMBAT && GAME_STATE.COMBAT.trim()); }
function getStatus() { return GAME_STATE.STATUS || ""; }

/* ============================================================================
   [SECTION] GAME DATABASE
   ========================================================================== */
//#region GAME_DB

const MONSTERS = {
    "SLIME": { hp: 3, attack: 5, defense: 2, gold: 2, exp: 1, zone: 1 },
    "RED_SLIME": { hp: 4, attack: 7, defense: 3, gold: 3, exp: 2, zone: 1 },
    "DRAKEE": { hp: 6, attack: 9, defense: 6, gold: 5, exp: 3, zone: 1 },
    "GHOST": { hp: 7, attack: 11, defense: 8, gold: 8, exp: 4, zone: 2 },
    "MAGICIAN": { hp: 13, attack: 15, defense: 12, gold: 18, exp: 13, zone: 2, spells: ["HURT"] },
    "SCORPION": { hp: 20, attack: 18, defense: 16, gold: 26, exp: 16, zone: 3 },
    "DRUIN": { hp: 22, attack: 20, defense: 18, gold: 30, exp: 18, zone: 3 },
    "METAL_SLIME": { hp: 4, attack: 10, defense: 255, gold: 6, exp: 115, zone: 4, flees: true },
    "KNIGHT": { hp: 37, attack: 40, defense: 40, gold: 70, exp: 42, zone: 7 },
    "MAGIWYVERN": { hp: 49, attack: 56, defense: 50, gold: 105, exp: 58, zone: 7, breathFire: true },
    "DEMON_KNIGHT": { hp: 47, attack: 60, defense: 54, gold: 110, exp: 78, zone: 7 },
    "DRAGONLORD_1": { hp: 100, attack: 90, defense: 75, gold: 0, exp: 0, zone: 99, boss: true },
    "DRAGONLORD_2": { hp: 165, attack: 140, defense: 90, gold: 0, exp: 2000, zone: 99, boss: true, breathFire: true }
};

const EQUIPMENT = {
    // Weapons
    "BAMBOO_POLE": { type: "weapon", attack: 2, defense: 0, price: 10 },
    "CLUB": { type: "weapon", attack: 4, defense: 0, price: 60 },
    "COPPER_SWORD": { type: "weapon", attack: 10, defense: 0, price: 180 },
    "HAND_AXE": { type: "weapon", attack: 15, defense: 0, price: 560 },
    "BROAD_SWORD": { type: "weapon", attack: 20, defense: 0, price: 1500 },
    "FLAME_SWORD": { type: "weapon", attack: 28, defense: 0, price: 9800 },
    "ERDRICKS_SWORD": { type: "weapon", attack: 40, defense: 0, price: 0 },

    // Armor
    "CLOTHES": { type: "armor", attack: 0, defense: 2, price: 20 },
    "LEATHER_ARMOR": { type: "armor", attack: 0, defense: 4, price: 70 },
    "CHAIN_MAIL": { type: "armor", attack: 0, defense: 10, price: 300 },
    "HALF_PLATE": { type: "armor", attack: 0, defense: 16, price: 1000 },
    "FULL_PLATE": { type: "armor", attack: 0, defense: 24, price: 3000 },
    "MAGIC_ARMOR": { type: "armor", attack: 0, defense: 24, price: 7700, special: "hp_regen" },
    "ERDRICKS_ARMOR": { type: "armor", attack: 0, defense: 28, price: 0, special: "hp_regen" },

    // Shields
    "LEATHER_SHIELD": { type: "shield", attack: 0, defense: 4, price: 90 },
    "IRON_SHIELD": { type: "shield", attack: 0, defense: 10, price: 800 },
    "SILVER_SHIELD": { type: "shield", attack: 0, defense: 20, price: 14800 }
};

const LEVEL_THRESHOLDS = {
    2: 7, 3: 23, 4: 47, 5: 110, 6: 220, 7: 450, 8: 800, 9: 1300, 10: 2000,
    11: 2900, 12: 4000, 13: 5500, 14: 7500, 15: 10000, 16: 13000, 17: 16000,
    18: 19500, 19: 23000, 20: 26500, 21: 30000
};

const LOCATION_DESCRIPTIONS = {
    TANTEGEL_THRONE: "The grand throne room of Tantegel Castle. King Lorik sits upon his throne. Stairs descend to the basement.",
    TANTEGEL_COURTYARD: "Castle courtyard with a magical healing spring in the center.",
    TANTEGEL_BASEMENT: "Dark basement beneath the castle.",
    BRECCONARY: "A small village. Shops line the street. Townspeople go about their business.",
    GARINHAM: "A fortified town. Guards patrol the streets.",
    RIMULDAR: "A mountain town with skilled merchants.",
    CANTLIN: "A seaside town near the final dungeon.",
    OVERWORLD: "Open wilderness stretches in all directions. Monsters roam freely.",
    CAVE: "Dark cave passages. Moisture drips from the ceiling.",
    CHARLOCK_ENTRANCE: "The dark gates of Charlock Castle loom before you.",
    CHARLOCK_THRONE: "The Dragonlord's throne room. Darkness emanates from the walls."
};

const EXITS = {
    TANTEGEL_THRONE: { north: null, south: "TANTEGEL_COURTYARD", east: null, west: null, down: "TANTEGEL_BASEMENT" },
    TANTEGEL_COURTYARD: { north: "TANTEGEL_THRONE", south: "OVERWORLD", east: null, west: null },
    TANTEGEL_BASEMENT: { up: "TANTEGEL_THRONE" },
    BRECCONARY: { north: "OVERWORLD", south: "OVERWORLD", east: "OVERWORLD", west: "OVERWORLD" },
    GARINHAM: { north: "OVERWORLD", south: "OVERWORLD", east: "OVERWORLD", west: "OVERWORLD" },
    RIMULDAR: { north: "OVERWORLD", south: "OVERWORLD", east: "OVERWORLD", west: "OVERWORLD" },
    CANTLIN: { north: "OVERWORLD", south: "OVERWORLD", east: "OVERWORLD", west: "OVERWORLD" },
    OVERWORLD: { north: "OVERWORLD", south: "OVERWORLD", east: "OVERWORLD", west: "OVERWORLD" },
    CHARLOCK_ENTRANCE: { north: "CHARLOCK_THRONE", south: "OVERWORLD" },
    CHARLOCK_THRONE: { south: "CHARLOCK_ENTRANCE" }
};

/* ============================================================================
   [SECTION] CANON GUIDANCE
   ========================================================================== */
//#region CANON

const CANON_GUIDANCE = `
When portraying Dragon Quest I content, favor accuracy from these sources in order:
1. Dragon Quest I (NES/Famicom original, 1986)
2. Dragon Quest I (Game Boy Color remake, 1999)
3. Dragon Quest I (Mobile/Switch remakes)
4. Official strategy guides and manuals

Key canon principles:
- Slimes are blue, cute, mascot-like enemies
- Metal Slimes are rare, shiny, flee quickly, give massive EXP
- Dragonlord has two forms: humanoid mage, then dragon
- Princess Gwaelin gives "Gwaelin's Love" compass item
- Erdrick is the legendary hero ancestor
- Ball of Light was stolen by Dragonlord, causing darkness
- Alefgard is the kingdom name
- Tantegel Castle is the starting location

When uncertain, favor portrayals from primary canon over adaptations, and adaptations over fan interpretations.
`;

/* ============================================================================
   [SECTION] DERIVED TAGS FROM SAVE STATE
   ========================================================================== */
//#region DERIVED_TAGS

function deriveTags() {
    const tags = {};

    // Combat state
    if (inCombat()) {
        tags["combat_active"] = 1;
        tags["in_combat"] = 1;

        const combat = (GAME_STATE.COMBAT || "").toUpperCase();
        if (combat.includes("SLIME")) tags["enemy_slime"] = 1;
        if (combat.includes("DRAGONLORD")) tags["enemy_dragonlord"] = 1;

        const hpMatch = combat.match(/HP(\d+)/i);
        if (hpMatch) {
            const enemyHP = parseInt(hpMatch[1]);
            if (enemyHP === 0) tags["enemy_defeated"] = 1;
        }
    } else {
        tags["not_in_combat"] = 1;
    }

    // Location tags
    const loc = getLocation();
    if (loc) {
        tags["loc_" + loc.toLowerCase()] = 1;

        if (loc === "OVERWORLD") tags["zone_overworld"] = 1;
        if (["BRECCONARY", "GARINHAM", "RIMULDAR", "CANTLIN"].includes(loc)) tags["in_town"] = 1;
        if (loc.includes("TANTEGEL")) tags["in_tantegel"] = 1;
        if (loc.includes("CHARLOCK")) tags["in_charlock"] = 1;
    }

    // FLAGS as tags (persistent state!)
    const flags = getFlags();
    for (const flag of flags) {
        tags["flag_" + flag.toLowerCase()] = 1;
    }

    // HP state
    const currentHP = getCurrentHP();
    const maxHP = getMaxHP();
    if (currentHP <= 0) {
        tags["hp_zero"] = 1;
        tags["death"] = 1;
    }
    if (currentHP < maxHP * 0.3) tags["hp_low"] = 1;
    if (currentHP === maxHP) tags["hp_full"] = 1;

    // Status field tags
    const status = getStatus();
    if (status) {
        tags["status_" + status.toLowerCase()] = 1;
        if (status.includes("SHOP")) tags["in_shop"] = 1;
    }

    // Level-based tags
    const level = getLevel();
    if (level >= 3) tags["can_heal"] = 1;
    if (level >= 4) tags["can_hurt"] = 1;
    if (level >= 10) tags["mid_level"] = 1;
    if (level >= 17) tags["can_healmore"] = 1;
    if (level >= 19) tags["can_hurtmore"] = 1;

    // First turn tag
    const _lmArr = (context && context.chat && context.chat.last_messages) || [];
    if (_lmArr.length <= 1) tags["first_turn"] = 1;

    return tags;
}

/* ============================================================================
   [SECTION] GAME LOGIC ENTRIES
   ========================================================================== */
//#region AUTHOR_ENTRIES
const dynamicLore = [

// ═══════════════════════════════════════════════════════════════════════════
// GAME START (only fires turn 1)
// ═══════════════════════════════════════════════════════════════════════════

  {
    andAllTags: ["first_turn"],
    priority: 5,
    triggers: ["game_init"],
    personality: `Start Dragon Quest I. Display welcome screen with title art (use ⚔️ DRAGON QUEST I ⚔️).

King Lorik speaks: "Long ago, the Dragonlord stole the Ball of Light and kidnapped Princess Gwaelin. Monsters now roam freely. Brave warrior, wilt thou restore peace to Alefgard?"

Initialize SAVE state: HP=15/15|MP=0/0|LVL=1|GOLD=120|EXP=0|STR=4|AGI=4|LOC=TANTEGEL_THRONE|INV=|EQP_W=BAMBOO_POLE|EQP_A=CLOTHES|EQP_S=|KEYS=0|FLAGS=GAME_START|COMBAT=|STATUS=

List available commands: STATS, TALK, GO [dir], SEARCH, TAKE, CAST, EQUIP, USE, ATTACK, DEFEND, RUN, BUY/SELL, DOOR, SAVE.

Format output with clear borders and spacing.

${CANON_GUIDANCE}`,
    scenario: "Hero stands in Tantegel Castle throne room at the start of their quest."
  },

// ═══════════════════════════════════════════════════════════════════════════
// CORE COMMANDS (minMessages: 3 to prevent turn-1 spam)
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["stats", "status"],
    minMessages: 3,
    priority: 5,
    andAllTags: ["not_in_combat"],
    personality: `Display hero status screen in bordered box format. Parse SAVE state and extract:
- Level {LVL}, HP {HP}, MP {MP}, Gold {GOLD}, EXP {EXP}
- Calculate EXP needed for next level using LEVEL_THRESHOLDS
- Equipment: Weapon {EQP_W}, Armor {EQP_A}, Shield {EQP_S}
- Magic Keys: {KEYS}
- Inventory items: {INV} (parse comma-separated list)

Use clean box-drawing characters (╔═╗║╚╝) for visual structure.
Include complete SAVE block at end of output.`,
    scenario: "Hero reviews their current status and equipment."
  },

  {
    keywords: ["search", "look around", "examine"],
    minMessages: 3,
    priority: 4,
    andAllTags: ["not_in_combat"],
    personality: `Hero searches area. Based on {LOC} from SAVE state, describe what they find:

Use LOCATION_DESCRIPTIONS for current LOC. Check EXITS table for available directions.
Mention any items to TAKE, NPCs to TALK to, or exits available.
Include SAVE block at end.`,
    scenario: "Hero carefully examines their surroundings."
  },

  {
    keywords: ["talk", "speak"],
    minMessages: 3,
    priority: 4,
    andAllTags: ["not_in_combat"],
    personality: `Hero talks to NPCs. Check location and flag tags to determine dialogue:

If loc_tantegel_throne and NOT flag_princess_saved:
- King Lorik: "Please save the Princess from the cave!"

If loc_tantegel_throne and flag_princess_saved:
- King Lorik: "Now defeat the Dragonlord!"

If in_town (Brecconary/Garinham/etc):
- Generic townsfolk dialogue about shops, Erdrick's legend, etc

Include SAVE block at end.`,
    scenario: "Hero engages NPCs in conversation."
  },

// ═══════════════════════════════════════════════════════════════════════════
// MOVEMENT SYSTEM (minMessages: 3)
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["go north", "walk north", "move north", "head north"],
    minMessages: 3,
    priority: 5,
    andAllTags: ["not_in_combat"],
    triggers: ["movement", "traveled"],
    personality: `Hero moves north. Check current {LOC} in SAVE and EXITS table.

If EXITS[LOC].north exists:
1. Update LOC to new location
2. Describe new area using LOCATION_DESCRIPTIONS
3. If moving to/within OVERWORLD: tag for potential random encounter
4. Update SAVE with new LOC

If no north exit: Display "Thou cannot go that way!"

Include updated SAVE block.`,
    scenario: "Hero travels northward."
  },

  {
    keywords: ["go south", "walk south", "move south", "head south"],
    minMessages: 3,
    priority: 5,
    andAllTags: ["not_in_combat"],
    triggers: ["movement", "traveled"],
    personality: `Hero moves south. Check EXITS[LOC].south, update LOC if valid, describe new area. If moving to/in OVERWORLD: tag for encounter. Update SAVE.`,
    scenario: "Hero travels southward."
  },

  {
    keywords: ["go east", "walk east", "move east", "head east"],
    minMessages: 3,
    priority: 5,
    andAllTags: ["not_in_combat"],
    triggers: ["movement", "traveled"],
    personality: `Hero moves east. Check EXITS[LOC].east, update LOC if valid, describe new area. If moving to/in OVERWORLD: tag for encounter. Update SAVE.`,
    scenario: "Hero travels eastward."
  },

  {
    keywords: ["go west", "walk west", "move west", "head west"],
    minMessages: 3,
    priority: 5,
    andAllTags: ["not_in_combat"],
    triggers: ["movement", "traveled"],
    personality: `Hero moves west. Check EXITS[LOC].west, update LOC if valid, describe new area. If moving to/in OVERWORLD: tag for encounter. Update SAVE.`,
    scenario: "Hero travels westward."
  },

// ═══════════════════════════════════════════════════════════════════════════
// MONSTER INFORMATION (minMessages: 3 to prevent spam)
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["slime"],
    minMessages: 3,
    priority: 3,
    personality: `Slime - The iconic beginner enemy of Dragon Quest. A cute blue blob monster.
Stats: HP 3, ATK 5, DEF 2 | Rewards: 2 Gold, 1 EXP
Common in early areas around Tantegel Castle.

When uncertain, favor portrayals from primary Dragon Quest I canon.`,
    scenario: "A beginner enemy from the Dragon Quest series."
  },

  {
    keywords: ["red slime"],
    minMessages: 3,
    priority: 3,
    personality: `Red Slime - A stronger variant of the basic Slime.
Stats: HP 4, ATK 7, DEF 3 | Rewards: 3 Gold, 2 EXP
Found in areas near Brecconary.`,
    scenario: "A red-colored slime, slightly stronger than its blue cousin."
  },

  {
    keywords: ["drakee"],
    minMessages: 3,
    priority: 3,
    personality: `Drakee - A small dragon-like creature with bat wings.
Stats: HP 6, ATK 9, DEF 6 | Rewards: 5 Gold, 3 EXP
Zone 1 enemy, common in early exploration.`,
    scenario: "A bat-winged dragon creature that swoops at travelers."
  },

  {
    keywords: ["ghost"],
    minMessages: 3,
    priority: 3,
    personality: `Ghost - An undead specter that haunts the wilderness.
Stats: HP 7, ATK 11, DEF 8 | Rewards: 8 Gold, 4 EXP
Zone 2 enemy, appears in mid-level areas.`,
    scenario: "A ghostly apparition that phases in and out."
  },

  {
    keywords: ["magician"],
    minMessages: 3,
    priority: 3,
    personality: `Magician - A spell-casting enemy that can use HURT magic.
Stats: HP 13, ATK 15, DEF 12 | Rewards: 18 Gold, 13 EXP
Zone 2 enemy. Can cast attack spells - dangerous!`,
    scenario: "A robed spellcaster wielding offensive magic."
  },

  {
    keywords: ["scorpion"],
    minMessages: 3,
    priority: 3,
    personality: `Scorpion - A giant armored scorpion with a deadly stinger.
Stats: HP 20, ATK 18, DEF 16 | Rewards: 26 Gold, 16 EXP
Zone 3 enemy found in desert and rocky areas.`,
    scenario: "A massive scorpion with chitinous armor."
  },

  {
    keywords: ["druin"],
    minMessages: 3,
    priority: 3,
    personality: `Druin - A shadowy demon creature.
Stats: HP 22, ATK 20, DEF 18 | Rewards: 30 Gold, 18 EXP
Zone 3 enemy, relatively strong mid-game foe.`,
    scenario: "A dark, demonic creature lurking in shadows."
  },

  {
    keywords: ["metal slime"],
    minMessages: 3,
    priority: 3,
    personality: `Metal Slime - The legendary rare enemy! Extremely high defense, very low HP.
Stats: HP 4, ATK 10, DEF 255 | Rewards: 6 Gold, 115 EXP
EXTREMELY RARE (2% encounter rate). Often flees before you can defeat it.
Defeating one grants massive experience! Very hard to damage due to extreme defense.

Portrayed as shiny metallic blob in Dragon Quest I canon.`,
    scenario: "The legendary metal slime - a shimmering metallic blob worth massive EXP!"
  },

  {
    keywords: ["knight"],
    minMessages: 3,
    priority: 3,
    personality: `Knight - A heavily armored warrior enemy.
Stats: HP 37, ATK 40, DEF 40 | Rewards: 70 Gold, 42 EXP
Zone 7 enemy. Late-game foe with strong offense and defense.`,
    scenario: "An armored knight wielding sword and shield."
  },

  {
    keywords: ["magiwyvern"],
    minMessages: 3,
    priority: 3,
    personality: `Magiwyvern - A magical dragon that can breathe fire!
Stats: HP 49, ATK 56, DEF 50 | Rewards: 105 Gold, 58 EXP
Zone 7 enemy. Fire breath attacks deal heavy damage.`,
    scenario: "A wyvern crackling with magical energy and flames."
  },

  {
    keywords: ["demon knight"],
    minMessages: 3,
    priority: 3,
    personality: `Demon Knight - A corrupted knight infused with demonic power.
Stats: HP 47, ATK 60, DEF 54 | Rewards: 110 Gold, 78 EXP
Zone 7 enemy. One of the strongest regular enemies in the game.`,
    scenario: "A knight possessed by demonic forces, radiating dark energy."
  },

  {
    keywords: ["dragonlord"],
    minMessages: 3,
    priority: 3,
    personality: `Dragonlord - The final boss! Has TWO forms.
Form 1: HP 100, ATK 90, DEF 75 (humanoid mage)
Form 2: HP 165, ATK 140, DEF 90 (dragon form with fire breath)
Rewards: 0 Gold, 2000 EXP (form 2 only)

The ultimate evil that stole the Ball of Light and kidnapped Princess Gwaelin.
Resides in Charlock Castle. Only accessible with the Rainbow Drop.

Per Dragon Quest I canon, offers to share the world before battle.`,
    scenario: "The supreme villain of Dragon Quest I - the Dragonlord himself!"
  },

// ═══════════════════════════════════════════════════════════════════════════
// RANDOM ENCOUNTERS (minMessages: 3)
// ═══════════════════════════════════════════════════════════════════════════

  {
    tag: "traveled",
    minMessages: 3,
    andAllTags: ["zone_overworld"],
    priority: 4,
    probability: 0.3,
    triggers: ["combat_start"],
    personality: `Random encounter! Based on {LOC} and {LVL}, spawn appropriate monster from MONSTERS database:
- Zone 1 (LVL 1-3): SLIME, RED_SLIME, DRAKEE
- Zone 2 (LVL 4-6): GHOST, MAGICIAN
- Zone 3 (LVL 7-10): SCORPION, DRUIN
- Zone 4+ (LVL 11+): KNIGHT, DEMON_KNIGHT, MAGIWYVERN
- Rare (2% chance): METAL_SLIME

Display: "⚔️ A MONSTER APPEARS! ⚔️"
Show monster name and HP.
List combat options: ATTACK, CAST [spell], DEFEND, RUN

Set COMBAT={MONSTER_NAME}_HP{X} in SAVE state.
Include updated SAVE block.`,
    scenario: "A wild monster blocks the hero's path!"
  },

// ═══════════════════════════════════════════════════════════════════════════
// COMBAT SYSTEM (minMessages: 3)
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["attack", "fight", "strike"],
    minMessages: 3,
    andAllTags: ["combat_active"],
    priority: 5,
    triggers: ["combat_action"],
    personality: `Hero attacks! Combat calculation using EQUIPMENT database:

1. Get weapon ATK from EQUIPMENT[{EQP_W}].attack
2. Get armor+shield DEF from EQUIPMENT[{EQP_A}].defense + EQUIPMENT[{EQP_S}].defense
3. Hero damage = MAX(1, ({STR} + weapon_ATK) / 2 + random(0-4) - enemy_DEF / 2)
4. Extract enemy current HP from COMBAT field (parse format: MONSTER_NAME_HP##)
5. New enemy HP = MAX(0, old_HP - damage)

If enemy HP <= 0:
- Display victory message
- Award {gold} gold and {exp} EXP from MONSTERS database
- Update GOLD and EXP in SAVE
- Check if leveled up (compare EXP to LEVEL_THRESHOLDS)
- Clear COMBAT field in SAVE
- Add combat_end trigger

If enemy still alive:
- Enemy attacks back
- Enemy damage = MAX(1, (enemy_ATK - hero_DEF) / 2 + random(0-4))
- Update hero HP in SAVE (can't go below 0)
- If hero HP <= 0: trigger death sequence
- Update COMBAT field with new enemy HP

Include updated SAVE block.`,
    scenario: "The battle continues!"
  },

  {
    keywords: ["defend", "guard", "block"],
    minMessages: 3,
    andAllTags: ["combat_active"],
    priority: 5,
    personality: `Hero raises shield defensively!

Enemy attacks with 50% reduced damage:
- Enemy damage = MAX(1, ((enemy_ATK - hero_DEF) / 2 + random(0-4)) * 0.5)
- Update hero HP in SAVE
- If hero HP <= 0: trigger death

Display "The hero blocks most of the attack! Took {damage} damage."
Include updated SAVE block.`,
    scenario: "Hero takes defensive stance."
  },

  {
    keywords: ["run", "flee", "escape"],
    minMessages: 3,
    andAllTags: ["combat_active"],
    priority: 5,
    triggers: ["flee_attempt"],
    personality: `Hero attempts to flee!

Success chance: 50% base + ({AGI} - enemy_AGI) * 5%

If successful:
- Clear COMBAT field in SAVE
- Display "Escaped safely!"

If failed:
- Enemy attacks
- Calculate damage
- Update HP
- Display "Blocked by the enemy!"

Include updated SAVE block.`,
    scenario: "Hero tries to escape combat."
  },

  {
    keywords: ["cast hurt", "cast hurtmore"],
    minMessages: 3,
    andAllTags: ["combat_active"],
    priority: 5,
    personality: `Hero casts attack spell!

Check requirements:
- HURT: LVL >= 4, MP >= 2 (damage: 5-12)
- HURTMORE: LVL >= 19, MP >= 5 (damage: 25-45)

If requirements met:
1. Calculate magic damage
2. Subtract from enemy HP in COMBAT field (min 0)
3. Deduct MP cost
4. If enemy defeated: award gold/EXP, clear COMBAT, add combat_end trigger
5. If enemy alive: enemy attacks back

If insufficient MP/level: "Thou dost not have enough MP!" or "Thou hast not learned that spell!"

Include updated SAVE block.`,
    scenario: "Hero unleashes magical attack."
  },

// ═══════════════════════════════════════════════════════════════════════════
// HEALING & RECOVERY (minMessages: 3)
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["use herb", "eat herb"],
    minMessages: 3,
    priority: 5,
    personality: `Hero uses medicinal herb.

Check if "HERB" exists in {INV}:
- If yes: Restore 30 HP (don't exceed MaxHP), remove one HERB from INV, update HP in SAVE
- If no: "Thou dost not have an herb!"

Display healing message with new HP value.
Include updated SAVE block.`,
    scenario: "Hero consumes healing herb."
  },

  {
    keywords: ["cast heal", "cast healmore"],
    minMessages: 3,
    priority: 5,
    andAllTags: ["not_in_combat"],
    personality: `Hero casts healing spell.

HEAL (LVL >= 3, MP >= 4): Restore 17-25 HP
HEALMORE (LVL >= 17, MP >= 10): Restore full HP

Check level and MP requirements:
- If met: Restore HP (don't exceed MaxHP), deduct MP, update SAVE
- If not met: "The spell fizzles!" or "Not enough MP!"

Display healing amount and new HP/MP values.
Include updated SAVE block.`,
    scenario: "Healing magic flows through the hero."
  },

  {
    keywords: ["inn", "rest", "sleep"],
    minMessages: 3,
    andAllTags: ["in_town"],
    priority: 5,
    personality: `Hero enters inn.

Innkeeper: "A good night's rest costs 6 gold. Will you stay?"

If user confirms:
- Check if GOLD >= 6
- If yes: Subtract 6 gold, restore HP to MaxHP and MP to MaxMP, display morning message
- If no: "Thou dost not have enough gold!"

Include updated SAVE block with restored HP/MP and reduced GOLD.`,
    scenario: "Warm glow of the inn beckons."
  },

  {
    keywords: ["spring", "fountain", "drink"],
    minMessages: 3,
    andAllTags: ["loc_tantegel_courtyard"],
    priority: 5,
    personality: `Hero drinks from magical spring.

Restore HP to MaxHP and MP to MaxMP (free healing).
Display: "✨ The healing waters restore your vitality! ✨"
Show new HP and MP values.

Include updated SAVE block.`,
    scenario: "Enchanted spring works its magic."
  },

// ═══════════════════════════════════════════════════════════════════════════
// SHOPPING SYSTEM (minMessages: 3)
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["weapon shop", "buy weapon"],
    minMessages: 3,
    andAllTags: ["in_town"],
    priority: 5,
    triggers: ["in_shop"],
    personality: `Display weapon shop menu from EQUIPMENT database (type=weapon):

1. Bamboo Pole - 10G (ATK +2)
2. Club - 60G (ATK +4)
3. Copper Sword - 180G (ATK +10)
4. Hand Axe - 560G (ATK +15)
5. Broad Sword - 1500G (ATK +20)
6. Flame Sword - 9800G (ATK +28)

Show current gold: {GOLD}
Instructions: "Say BUY [item] to purchase, LEAVE to exit."

Set STATUS=SHOP_WEAPON in SAVE.
Include SAVE block.`,
    scenario: "Hero browses weapon shop."
  },

  {
    keywords: ["armor shop", "armory", "buy armor"],
    minMessages: 3,
    andAllTags: ["in_town"],
    priority: 5,
    triggers: ["in_shop"],
    personality: `Display armor shop menu from EQUIPMENT database:

ARMOR (type=armor):
1. Clothes - 20G (DEF +2)
2. Leather - 70G (DEF +4)
3. Chain Mail - 300G (DEF +10)
4. Half Plate - 1000G (DEF +16)
5. Full Plate - 3000G (DEF +24)
6. Magic Armor - 7700G (DEF +24, special)

SHIELDS (type=shield):
7. Leather Shield - 90G (DEF +4)
8. Iron Shield - 800G (DEF +10)
9. Silver Shield - 14800G (DEF +20)

Show current gold. Set STATUS=SHOP_ARMOR. Include SAVE block.`,
    scenario: "Hero examines armor and shields."
  },

  {
    keywords: ["item shop", "tool shop", "buy items"],
    minMessages: 3,
    andAllTags: ["in_town"],
    priority: 5,
    triggers: ["in_shop"],
    personality: `Display item shop menu:

1. Herb - 24G (Heal ~30HP)
2. Torch - 8G (Light in dungeons)
3. Fairy Water - 38G (Repel weak monsters)
4. Wings - 70G (Escape dungeon)
5. Magic Key - 85G (Unlock doors)

Show current gold. Set STATUS=SHOP_ITEM. Include SAVE block.`,
    scenario: "Hero shops for useful items."
  },

  {
    keywords: ["buy "],
    minMessages: 3,
    andAllTags: ["in_shop"],
    priority: 5,
    personality: `Process purchase transaction:

1. Extract item name from player command
2. Look up price in EQUIPMENT database or item list
3. Check if GOLD >= price

If affordable:
- Deduct price from GOLD
- If equipment: Update EQP_W/EQP_A/EQP_S based on item type
- If consumable: Add to INV (comma-separated list)
- If Magic Key: Increment KEYS count
- Display "Thank you! Gold remaining: {new_GOLD}"

If not affordable:
- Display "Thou dost not have enough gold!"

Clear STATUS field (exit shop).
Include updated SAVE block.`,
    scenario: "Purchase is completed."
  },

  {
    keywords: ["leave", "exit"],
    minMessages: 3,
    andAllTags: ["in_shop"],
    priority: 5,
    personality: `Hero leaves the shop.

Clear STATUS field in SAVE.
Display "Come back anytime!"

Include updated SAVE block.`,
    scenario: "Hero exits the shop."
  },

// ═══════════════════════════════════════════════════════════════════════════
// QUEST PROGRESSION (minMessages: 3)
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["princess", "gwaelin", "rescue"],
    minMessages: 3,
    andAny: ["cave"],
    notAnyTags: ["flag_princess_saved"],
    priority: 5,
    triggers: ["PRINCESS_SAVED"],
    personality: `Hero finds Princess Gwaelin!

Princess Gwaelin: "Oh brave warrior! Thou hast come to save me! Please take me home to my father."

Display: "💕 Princess Gwaelin joins your party! 💕"
She whispers: "The Ball of Light lies southwest of Charlock..."

Add "PRINCESS_SAVED" to FLAGS in SAVE.
Include updated SAVE block.`,
    scenario: "The princess is rescued!"
  },

  {
    keywords: ["talk", "king"],
    minMessages: 3,
    andAllTags: ["flag_princess_saved", "loc_tantegel_throne"],
    notAnyTags: ["flag_gwaelins_love_received"],
    priority: 5,
    triggers: ["GWAELINS_LOVE_RECEIVED"],
    personality: `King rewards hero for rescuing princess:

King Lorik: "My daughter! As reward, accept Gwaelin's Love."

Receive Gwaelin's Love (compass item - shows distance to castle per DQ1 canon).
Award 1000 EXP.
Add "GWAELINS_LOVE" to INV.
Add "GWAELINS_LOVE_RECEIVED" to FLAGS.

King: "Now defeat the Dragonlord and restore the Ball of Light!"

Include updated SAVE block.`,
    scenario: "King thanks hero for princess's safe return."
  },

  {
    keywords: ["search", "examine"],
    minMessages: 3,
    andAny: ["swamp"],
    notAnyTags: ["flag_erdricks_token"],
    priority: 4,
    probability: 0.5,
    triggers: ["ERDRICKS_TOKEN"],
    personality: `While searching murky swamp, hero finds glinting object!

Display: "⭐ Found Erdrick's Token! ⭐"
Ancient medallion proves hero's lineage.

Add "ERDRICKS_TOKEN" to FLAGS.
Include updated SAVE block.`,
    scenario: "Legendary artifact discovered in swamp!"
  },

// ═══════════════════════════════════════════════════════════════════════════
// FINAL BOSS (minMessages: 3)
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["dragonlord", "approach", "confront"],
    minMessages: 3,
    andAllTags: ["loc_charlock_throne", "flag_rainbow_drop"],
    notAnyTags: ["flag_dragonlord_defeated"],
    priority: 5,
    triggers: ["dragonlord_encounter"],
    personality: `Dragonlord confrontation!

Per Dragon Quest I canon, Dragonlord offers to share the world:
"I am the Dragonlord. If thou wilt join me, I will give thee half the world to rule."

Wait for player response:
- If YES: Game over, bad ending
- If NO: Continue to battle

Dragonlord: "Then thou art a fool! DIE!"

Display: "💀 THE DRAGONLORD ATTACKS! 💀"
Set COMBAT=DRAGONLORD_1_HP100
Include updated SAVE block.`,
    scenario: "Ultimate confrontation begins!"
  },

  {
    tag: "combat_action",
    minMessages: 3,
    andAllTags: ["enemy_dragonlord", "enemy_defeated"],
    notAnyTags: ["flag_dragonlord_phase2"],
    priority: 5,
    triggers: ["dragonlord_phase2", "DRAGONLORD_PHASE2"],
    personality: `Dragonlord defeated... but transforms!

"FOOLISH MORTAL! THIS IS MY TRUE FORM!"

Display: "💀💀💀 THE DRAGON EMERGES! 💀💀💀"
Dragonlord becomes massive dragon per DQ1 canon!

Set COMBAT=DRAGONLORD_2_HP165
Add DRAGONLORD_PHASE2 to FLAGS
Include updated SAVE block.`,
    scenario: "True battle begins - dragon form!"
  },

  {
    tag: "combat_end",
    minMessages: 3,
    andAllTags: ["flag_dragonlord_phase2"],
    priority: 5,
    triggers: ["DRAGONLORD_DEFEATED", "GAME_WON"],
    personality: `VICTORY! Dragon falls defeated!

Award 2000 EXP.
Display epic victory message.

Return to Tantegel Castle:
King Lorik: "Brave warrior! Thou hast restored peace to Alefgard!"
Princess Gwaelin: "Will you take me with you on your next adventure?"

Display: "🎊 CONGRATULATIONS! 🎊 Thou hast completed Dragon Quest!"
Show final stats: Level {LVL}, All equipment and achievements.

Add DRAGONLORD_DEFEATED and GAME_WON to FLAGS.
Include final SAVE block.`,
    scenario: "Peace returns to Alefgard - quest complete!"
  },

// ═══════════════════════════════════════════════════════════════════════════
// LEVELING & DEATH (minMessages: 3)
// ═══════════════════════════════════════════════════════════════════════════

  {
    tag: "combat_end",
    minMessages: 3,
    priority: 5,
    personality: `Check if leveled up after combat:

Compare {EXP} to LEVEL_THRESHOLDS. If threshold crossed:

Display: "🎉 LEVEL UP! 🎉 Level {new_LVL} achieved!"

Increase stats (random ranges per DQ1 mechanics):
- Max HP: +5 to +15
- Max MP: +0 to +5
- STR: +1 to +4
- AGI: +1 to +4

Check if new spell learned at this level:
- L3: HEAL, L4: HURT, L7: SLEEP, L9: RADIANT, L10: STOPSPELL
- L12: OUTSIDE, L13: RETURN, L15: REPEL, L17: HEALMORE, L19: HURTMORE

Update all stats in SAVE.
Include updated SAVE block.`,
    scenario: "Hero grows stronger through experience!"
  },

  {
    andAllTags: ["hp_zero"],
    minMessages: 3,
    priority: 5,
    triggers: ["hero_died"],
    personality: `Death sequence:

Display: "💀💀💀 THOU ART DEAD 💀💀💀"
"Darkness surrounds you... But Princess Gwaelin's love brings you back!"

Resurrection (per DQ1 death mechanics):
- Restore HP to MaxHP / 2
- Restore MP to MaxMP / 2
- Lose 50% of GOLD
- Set LOC=TANTEGEL_THRONE
- Clear COMBAT field

Display: "You awaken in Tantegel Castle. Gold lost: {GOLD/2}"

Include updated SAVE block.`,
    scenario: "Death is but temporary setback..."
  },

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY COMMANDS (minMessages: 3)
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["save", "save state"],
    minMessages: 3,
    priority: 5,
    personality: `Display current save state in readable format:

Parse and show all SAVE components:
- Character Stats: HP, MP, Level, Gold, EXP (with next level EXP needed)
- Location: {LOC} (convert to friendly name from LOCATION_DESCRIPTIONS)
- Equipment: Weapon, Armor, Shield, Magic Keys
- Inventory: List all items
- Quest Progress: List all FLAGS as checkmarks ✓

Format as bordered box.
Include complete raw SAVE block at end.`,
    scenario: "Hero reviews complete game progress."
  },

  {
    keywords: ["help", "commands"],
    minMessages: 3,
    priority: 5,
    personality: `Display command reference guide in bordered format:

List all available commands by category:
- MOVEMENT: GO [direction], SEARCH
- COMBAT: ATTACK, DEFEND, CAST [spell], RUN
- INTERACTION: TALK, TAKE, DOOR
- ITEMS: USE [item], EQUIP [item], BUY/SELL [item]
- MAGIC: List spells (HEAL, HURT, SLEEP, RETURN, etc.) with MP costs and level requirements
- STATUS: STATS, SAVE

Keep concise but comprehensive.
Include current SAVE block at end.`,
    scenario: "Hero recalls their training."
  }

];

/* ============================================================================
   [SECTION] ENGINE CODE WITH SAVE VALIDATION
   ========================================================================== */
//#endregion
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
  const kw = getKW(e);
  const prevKw = arr(e && e['prev.keywords']);
  return !( kw.length || prevKw.length || e.tag || e.minMessages != null || e.maxMessages != null );
}

const _ENGINE_LORE = dynamicLore.map(e => {
  const out = { ...e };
  out.keywords = getKW(e);
  out['prev.keywords'] = arr(e && e['prev.keywords']);
  if (e.Shifts) out.Shifts = e.Shifts.map(s => ({ ...s, keywords: getKW(s) }));
  return out;
});

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL: SAVE VALIDATION WARNING
// ═══════════════════════════════════════════════════════════════════════════

const SAVE_PRESENT = checkSaveBlockPresent();

if (!SAVE_PRESENT && messageCount > 1) {
  context.character.personality = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️⚠️⚠️ CRITICAL ERROR: SAVE BLOCK MISSING OR MALFORMED! ⚠️⚠️⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR LAST MESSAGE DID NOT INCLUDE A VALID [SAVE: ...] BLOCK!

This is a FATAL ERROR. The game CANNOT continue without the SAVE state.

YOU MUST:
1. Include the SAVE block in EVERY response
2. Format: [SAVE: HP=##/##|MP=##/##|LVL=#|GOLD=###|EXP=###|STR=#|AGI=#|LOC=LOCATION_NAME|INV=items|EQP_W=weapon|EQP_A=armor|EQP_S=shield|KEYS=#|FLAGS=flags|COMBAT=enemy_data|STATUS=status]
3. Place it at the END of your response
4. Use PLAIN TEXT - no box borders around the SAVE line itself
5. Separate fields with | (pipe)
6. Use = (equals) between key and value

EXAMPLE VALID SAVE:
[SAVE: HP=15/15|MP=0/0|LVL=1|GOLD=120|EXP=0|STR=4|AGI=4|LOC=TANTEGEL_THRONE|INV=|EQP_W=BAMBOO_POLE|EQP_A=CLOTHES|EQP_S=|KEYS=0|FLAGS=GAME_START|COMBAT=|STATUS=]

RECOVER THE GAME STATE FROM CONTEXT AND REPRINT THE SAVE BLOCK NOW!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

` + context.character.personality;
}

// ═══════════════════════════════════════════════════════════════════════════
// DERIVED TAGS FROM SAVE
// ═══════════════════════════════════════════════════════════════════════════

const DERIVED_TAGS = deriveTags();
const allTags = { ...DERIVED_TAGS };

function addTag(set, key) { set[String(key)] = 1; }
function hasTag(set, key) { return set[String(key)] === 1; }

const buckets = [null, [], [], [], [], []];
const picked = new Array(_ENGINE_LORE.length).fill(0);

// Phase 1: Direct keyword hits
for (const [i, e] of _ENGINE_LORE.entries()) {
  const kwHit = isAlwaysOn(e) || getKW(e).some(kw => hasTerm(last, kw));
  const prevKwHit = (e['prev.keywords'] || []).some(kw => hasTerm(prev, kw));
  const hit = kwHit || prevKwHit;

  if (!hit || !entryPasses(e, allTags)) continue;
  buckets[prio(e)].push(i);
  picked[i] = 1;
  getTrg(e).forEach(t => addTag(allTags, t));
}

// Phase 2: Tag-triggered entries
for (const [i, e] of _ENGINE_LORE.entries()) {
  if (picked[i] || !(e.tag && hasTag(allTags, e.tag))) continue;
  if (!entryPasses(e, allTags)) continue;
  buckets[prio(e)].push(i);
  picked[i] = 1;
  getTrg(e).forEach(t => addTag(allTags, t));
}

// Phase 3: Priority selection
const selected = [];
let pickedCount = 0;
const inclusionGroups = {};
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

      if (hit && entryPasses(sh, allTags)) {
        if (sh.personality) bufP += `\n\n${sh.personality}`;
        if (sh.scenario) bufS += `\n\n${sh.scenario}`;
      }
    }
  }
}

if (bufP) context.character.personality += bufP;
if (bufS) context.character.scenario += bufS;

//#endregion
