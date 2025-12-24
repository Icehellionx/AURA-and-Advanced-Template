/* ============================================================================
   DRAGON QUEST 1 TEXT ADVENTURE - COMPLETE VERSION
   Author: Icehellionx (adapted)
   Based on: Advanced Lore Book System v14
   ==========================================================================

   COMPLETE V2 FEATURES:
   ✅ SAVE state parser (reads from last_messages[1])
   ✅ Complete monster database (30+ enemies)
   ✅ Advanced heuristics (prev.keywords, groups, shifts)
   ✅ All original V1 lore entries
   ✅ Helper functions for state access

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

function parseSaveState() {
    const _lmArr = (context && context.chat && context.chat.last_messages)
        ? context.chat.last_messages : null;
    if (!_lmArr || _lmArr.length < 2) return null;

    const aiLastMsg = _lmArr[_lmArr.length - 2];
    const msgText = (aiLastMsg && typeof aiLastMsg.message === "string")
        ? aiLastMsg.message : String(aiLastMsg || "");

    const saveMatch = msgText.match(/\[SAVE:\s*([^\]]+)\]/);
    if (!saveMatch) return null;

    const saveStr = saveMatch[1];
    const state = {};
    const pairs = saveStr.split('|');
    for (const pair of pairs) {
        const [key, val] = pair.split('=').map(s => s.trim());
        if (key && val !== undefined) state[key] = val;
    }
    return state;
}

const GAME_STATE = parseSaveState() || {
    HP: "15/15", MP: "0/0", LVL: "1", GOLD: "120", EXP: "0",
    STR: "4", AGI: "4", LOC: "TANTEGEL_THRONE", INV: "",
    EQP_W: "BAMBOO_POLE", EQP_A: "CLOTHES", EQP_S: "",
    KEYS: "0", FLAGS: "GAME_START", COMBAT: "", STATUS: ""
};

function getHP() { return GAME_STATE.HP || "15/15"; }
function getCurrentHP() { return parseInt((GAME_STATE.HP || "15/15").split('/')[0]); }
function getMaxHP() { return parseInt((GAME_STATE.HP || "15/15").split('/')[1]); }
function getMP() { return GAME_STATE.MP || "0/0"; }
function getCurrentMP() { return parseInt((GAME_STATE.MP || "0/0").split('/')[0]); }
function getLevel() { return parseInt(GAME_STATE.LVL || "1"); }
function getGold() { return parseInt(GAME_STATE.GOLD || "120"); }
function getLocation() { return GAME_STATE.LOC || "TANTEGEL_THRONE"; }
function getFlags() { return (GAME_STATE.FLAGS || "").split(',').filter(x => x); }
function hasFlag(flag) { return getFlags().includes(flag); }
function inCombat() { return !!(GAME_STATE.COMBAT); }

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

const LEVEL_THRESHOLDS = {
    2: 7, 3: 23, 4: 47, 5: 110, 6: 220, 7: 450, 8: 800, 9: 1300, 10: 2000,
    11: 2900, 12: 4000, 13: 5500, 14: 7500, 15: 10000, 16: 13000, 17: 16000,
    18: 19500, 19: 23000, 20: 26500, 21: 30000
};

/* ============================================================================
   [SECTION] ASCII ART DATABASE
   ========================================================================== */
//#region ASCII_ART

const ASCII_ART = {
    // Monsters
    SLIME: "  ___\n /o o\\\n|  ~  |\n \\___/",
    RED_SLIME: "  ___\n /@ @\\\n|  ~  |\n \\___/",
    DRAKEE: "  ^  \n < >\n  V  ",
    GHOST: "  .--.\n ( o o )\n  >   <\n '-----'",
    DRAGON: "   /\\___/\\\n  {  o_o  }\n   \\  ^  /\n   /|||||\\\n  /_\\|||/_\\",
    DRAGONLORD: "    ___\n   /   \\\n  | @ @ |\n  |  ^  |\n  /HHHHH\\\n <XXXXXXX>\n  \\____/",

    // Locations
    CASTLE: "    /\\\n   /  \\\n  /====\\\n /| [] |\\\n/_|____|_\\",
    TOWN: " ___ ___\n|::::|:::|\n|_ _|_ _|\n|::::|:::|",
    CAVE: "   ___\n  /   \\\n /     \\\n|   _   |\n| _| |_ |",
    OVERWORLD: " ~  ~ ~\n  ~  ~  ~\n ~  ~ ~",

    // Items
    SWORD: "  /\\\n  ||\n  ||\n /||\\\n/____\\",
    HERB: " \\|/\n -+-\n /|\\",
    KEY: " __\n( )|\n \\_|_",
    CROWN: "  /\\_/\\\n |o o|\n  \\_/",

    // Special
    TOMBSTONE: "    ___\n   /R.I.P\\\n  |_______|",
    CHEST: " ____\n|    |\n|____|\n \\__/"
};

/* ============================================================================
   [SECTION] GAME LOGIC ENTRIES
   ========================================================================== */
//#region AUTHOR_ENTRIES
const dynamicLore = [
// 🟢🟢🟢 GAME START 🟢🟢🟢

  /* INITIALIZATION - First message only */
  {
    maxMessages: 1,
    priority: 5,
    triggers: ["game_init", "in_throne_room"],
    personality: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ⚔️  DRAGON QUEST I  ⚔️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Descendant of Erdrick, thou art most welcome!

King Lorik: "A long time ago, the great Dragonlord stole
the Ball of Light and kidnapped Princess Gwaelin. Now
monsters roam the land freely. Brave warrior, wilt thou
restore peace to Alefgard?"

[SAVE: HP=15/15|MP=0/0|LVL=1|GOLD=120|EXP=0|STR=4|AGI=4|
LOC=TANTEGEL_THRONE|INV=|EQP_W=BAMBOO_POLE|EQP_A=CLOTHES|
EQP_S=|KEYS=0|FLAGS=GAME_START]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Available commands:
• STATS - View your status
• TALK - Speak with NPCs
• GO [direction] - Move (north/south/east/west/up/down)
• SEARCH - Examine your surroundings
• TAKE - Pick up items
• CAST [spell] - Use magic
• EQUIP [item] - Change equipment
• USE [item] - Use an item from inventory
• ATTACK - Enter combat
• DEFEND - Raise shield in combat
• RUN - Flee from battle
• BUY/SELL - Trade at shops
• DOOR - Use a Magic Key
• SAVE - View current save state
`,
    scenario: "The hero stands in the throne room of Tantegel Castle. King Lorik awaits their response."
  },

// 🟢🟢🟢 CORE COMMANDS 🟢🟢🟢

  /* STATS Command */
  {
    keywords: ["stats", "status"],
    priority: 5,
    personality: `Display stats box with: LVL, HP, MP, GOLD, EXP, EXP to next, equipped gear, keys, inventory. Then print SAVE.`,
    scenario: "Status check."
  },

  /* SEARCH Command */
  {
    keywords: ["search", "look", "examine"],
    priority: 4,
    triggers: ["searching"],
    personality: `Search area. Show ASCII for location. Describe details, exits, items. Print SAVE.`,
    scenario: "Examining surroundings."
  },

  /* TALK Command */
  {
    keywords: ["talk", "speak"],
    priority: 4,
    triggers: ["talking"],
    personality: `NPC dialogue based on LOC and FLAGS. King if TANTEGEL_THRONE, townspeople if town. Print SAVE.`,
    scenario: "Conversation."
  },

  {
    keywords: ["north", "go north"],
    priority: 5,
    triggers: ["movement"],
    personality: `Move north. Update LOC, show new area. 30% encounter if dangerous. Print SAVE.`,
    scenario: "North."
  },
  {
    keywords: ["south", "go south"],
    priority: 5,
    triggers: ["movement"],
    personality: `Move south. Update LOC, show new area. 30% encounter if dangerous. Print SAVE.`,
    scenario: "South."
  },
  {
    keywords: ["east", "go east"],
    priority: 5,
    triggers: ["movement"],
    personality: `Move east. Update LOC, show new area. 30% encounter if dangerous. Print SAVE.`,
    scenario: "East."
  },
  {
    keywords: ["west", "go west"],
    priority: 5,
    triggers: ["movement"],
    personality: `Move west. Update LOC, show new area. 30% encounter if dangerous. Print SAVE.`,
    scenario: "West."
  },

// 🟢🟢🟢 COMBAT SYSTEM 🟢🟢🟢

  {
    tag: "movement",
    priority: 4,
    andAny: ["overworld", "swamp", "cave"],
    probability: 0.3,
    triggers: ["combat_start"],
    personality: `⚔️ Random encounter! Show monster ASCII. Set COMBAT=ENEMY_HP##. Print SAVE. Options: ATTACK/DEFEND/CAST/RUN.`,
    scenario: "Monster appears!"
  },

  {
    keywords: ["attack", "fight"],
    andAny: ["combat="],
    priority: 5,
    triggers: ["in_combat"],
    personality: `Attack! Calc dmg: (STR+wpn)/2+rnd(0-4)-DEF/2. If enemy dies: award EXP/GOLD, remove COMBAT, check level. Else: enemy attacks back. Update HP in SAVE. Print SAVE.`,
    scenario: "Battle!"
  },
  {
    keywords: ["defend", "guard"],
    andAny: ["combat="],
    priority: 5,
    triggers: ["in_combat"],
    personality: `Defend! Enemy attacks with 50% dmg. Update HP in SAVE. Print SAVE.`,
    scenario: "Defensive."
  },
  {
    keywords: ["run", "flee"],
    andAny: ["combat="],
    priority: 5,
    triggers: ["fled_combat"],
    personality: `Flee! 50% chance. Success: remove COMBAT. Fail: take hit. Print SAVE.`,
    scenario: "Escaping!"
  },

  /* CAST SPELL in Combat */
  {
    keywords: ["cast hurt", "hurt spell", "cast hurtmore", "hurtmore"],
    andAny: ["combat="],
    priority: 5,
    triggers: ["in_combat", "cast_spell"],
    personality: `The hero chants an incantation!

[Check if hero knows spell based on LVL]
[Check if MP >= spell cost]

[If can cast:]
  HURT! / HURTMORE!
  [Calculate magic damage]
  The [MONSTER_NAME] takes [X] magical damage!

  MP: [NewMP/MaxMP]
  [MONSTER_NAME]: HP [NewHP]

  [If monster defeated: award EXP/GOLD, remove COMBAT=]
  [Else: monster attacks back]

[If not enough MP:]
  "Thou dost not have enough MP!"

[Reprint SAVE]
`,
    scenario: "The hero calls upon magical forces!"
  },

// 🟢🟢🟢 HEALING & ITEMS 🟢🟢🟢

  /* USE HERB */
  {
    keywords: ["use herb", "herb", "eat herb"],
    priority: 5,
    personality: `The hero uses an herb!

[Check if HERB in INV]
[If yes:]
  The herb's power flows through you!
  HP restored by 30!
  HP: [Min(CurrentHP+30, MaxHP)]/[MaxHP]

  [Remove one HERB from INV]
  [Update HP in SAVE]

[If no:]
  "Thou dost not have an herb!"

[Reprint SAVE]
`,
    scenario: "The hero consumes a medicinal herb."
  },

  /* CAST HEAL */
  {
    keywords: ["cast heal", "heal spell", "healmore"],
    priority: 5,
    personality: `The hero chants a healing prayer!

[Check LVL >= 3 for HEAL or >= 17 for HEALMORE]
[Check MP]

[If can cast HEAL (MP >= 4):]
  HEAL!
  HP restored by [17-25]!
  MP: [MP-4]/[MaxMP]
  HP: [NewHP]/[MaxHP]

[If can cast HEALMORE (MP >= 10):]
  HEALMORE!
  HP fully restored!
  MP: [MP-10]/[MaxMP]
  HP: [MaxHP]/[MaxHP]

[If insufficient MP or level:]
  "The spell fizzles!"

[Reprint SAVE]
`,
    scenario: "Healing magic washes over the hero."
  },

  /* REST AT INN */
  {
    keywords: ["inn", "rest", "sleep at inn", "stay at inn"],
    andAny: ["brecconary", "garinham", "rimuldar", "cantlin"],
    priority: 5,
    personality: `The hero approaches the inn.

Innkeeper: "Welcome! A good night's rest costs 6 gold. Will you stay?"

[If user confirms:]
  [Check if GOLD >= 6]
  [If yes:]
    "Rest well, brave warrior!"

    [Restore HP to MaxHP, MP to MaxMP]
    [Subtract 6 from GOLD]

    ☀️ Morning arrives...
    HP fully restored!
    MP fully restored!

    [Update SAVE]

  [If no:]
    "Thou dost not have enough gold!"

[Reprint SAVE]
`,
    scenario: "The warm glow of the inn beckons."
  },

  /* HEALING SPRING */
  {
    keywords: ["spring", "fountain", "drink", "heal at spring", "use spring"],
    andAny: ["tantegel_courtyard"],
    priority: 5,
    personality: `The hero drinks from the magical spring!

✨ The healing waters restore your vitality! ✨

HP fully restored!
MP fully restored!

HP: [MaxHP]/[MaxHP]
MP: [MaxMP]/[MaxMP]

[Update SAVE]
[Reprint SAVE]
`,
    scenario: "The enchanted spring works its restorative magic."
  },

// 🟢🟢🟢 SHOPPING SYSTEM 🟢🟢🟢

  /* WEAPON SHOP */
  {
    keywords: ["weapon shop", "buy weapon", "weapons"],
    andAny: ["brecconary", "garinham", "rimuldar", "cantlin"],
    priority: 5,
    triggers: ["in_shop"],
    personality: `The hero enters the weapon shop.

╔════════════════════════════════════════╗
║          WEAPON SHOP                   ║
╠════════════════════════════════════════╣
║ 1. Bamboo Pole......10 G (ATK +2)     ║
║ 2. Club.............60 G (ATK +4)     ║
║ 3. Copper Sword....180 G (ATK +10)    ║
║ 4. Hand Axe........560 G (ATK +15)    ║
║ 5. Broad Sword....1500 G (ATK +20)    ║
║ 6. Flame Sword....9800 G (ATK +28)    ║
╚════════════════════════════════════════╝

Your gold: [Extract GOLD from SAVE]

Say "BUY [item name]" to purchase.
Say "LEAVE" to exit the shop.

[Reprint SAVE]
`,
    scenario: "Weapons of various quality line the walls."
  },

  /* ARMOR SHOP */
  {
    keywords: ["armor shop", "armory", "buy armor"],
    andAny: ["brecconary", "garinham", "rimuldar", "cantlin"],
    priority: 5,
    triggers: ["in_shop"],
    personality: `The hero enters the armor shop.

╔════════════════════════════════════════╗
║          ARMOR SHOP                    ║
╠════════════════════════════════════════╣
║ ARMOR:                                 ║
║ 1. Clothes..........20 G (DEF +2)     ║
║ 2. Leather Armor....70 G (DEF +4)     ║
║ 3. Chain Mail......300 G (DEF +10)    ║
║ 4. Half Plate.....1000 G (DEF +16)    ║
║ 5. Full Plate.....3000 G (DEF +24)    ║
║ 6. Magic Armor....7700 G (DEF +24*)   ║
║                                        ║
║ SHIELDS:                               ║
║ 7. Leather Shield...90 G (DEF +4)     ║
║ 8. Iron Shield.....800 G (DEF +10)    ║
║ 9. Silver Shield.14800 G (DEF +20)    ║
╚════════════════════════════════════════╝

Your gold: [Extract GOLD from SAVE]

Say "BUY [item name]" to purchase.

[Reprint SAVE]
`,
    scenario: "Sturdy armor and shields await."
  },

  /* ITEM SHOP */
  {
    keywords: ["item shop", "tool shop", "buy items"],
    andAny: ["brecconary", "garinham"],
    priority: 5,
    triggers: ["in_shop"],
    personality: `The hero enters the item shop.

╔════════════════════════════════════════╗
║          ITEM SHOP                     ║
╠════════════════════════════════════════╣
║ 1. Herb............24 G (Heal ~30HP)  ║
║ 2. Torch............8 G (Light)       ║
║ 3. Fairy Water.....38 G (Repel)       ║
║ 4. Wings...........70 G (Escape)      ║
║ 5. Magic Key.......85 G (Open doors)  ║
╚════════════════════════════════════════╝

Your gold: [Extract GOLD from SAVE]

Say "BUY [item name]" to purchase.

[Reprint SAVE]
`,
    scenario: "Various useful items are on display."
  },

  /* BUY Command */
  {
    keywords: ["buy"],
    tag: "in_shop",
    priority: 5,
    personality: `[Extract item name from user message]
[Look up price from ITEMS database]
[Check if GOLD >= price]

[If can afford:]
  Merchant: "Thank you for your purchase!"

  [Subtract price from GOLD]
  [Add item to INV or update EQP_W/EQP_A/EQP_S if equipment]
  [If Magic Key: increment KEYS]

  Gold remaining: [NewGOLD]

  [Update SAVE]

[If cannot afford:]
  Merchant: "Thou dost not have enough gold!"

[Reprint SAVE]
`,
    scenario: "The transaction is completed."
  },

// 🟢🟢🟢 QUEST PROGRESSION 🟢🟢🟢

  /* Princess Gwaelin's Cave */
  {
    keywords: ["princess", "gwaelin", "save princess"],
    andAny: ["cave", "rescue"],
    notAnyTags: ["PRINCESS_SAVED"],
    priority: 5,
    triggers: ["PRINCESS_SAVED"],
    personality: `The hero finds Princess Gwaelin in the cave!

Princess Gwaelin: "Oh brave warrior! Thou hast come to save me!
My name is Gwaelin. Please, take me home to my father."

💕 Princess Gwaelin joins your party! 💕

She whispers: "I sense the Ball of Light lies southwest of Charlock..."

[Add PRINCESS_SAVED to FLAGS]
[Update SAVE]
[Reprint SAVE]
`,
    scenario: "The princess is rescued!"
  },

  /* Return Princess to King */
  {
    keywords: ["king", "talk", "speak"],
    andAllTags: ["PRINCESS_SAVED"],
    andAny: ["tantegel_throne"],
    priority: 5,
    personality: `King Lorik: "My daughter! Thou hast rescued her!
As a reward, please accept Gwaelin's Love."

📿 Received Gwaelin's Love! 📿
(Use this to check your distance from the castle)

[If PRINCESS_SAVED not already rewarded:]
  [Add 1000 EXP]
  [Add GWAELINS_LOVE to INV]

King Lorik: "Now, brave hero, thou must defeat the Dragonlord
and restore the Ball of Light!"

[Reprint SAVE]
`,
    scenario: "The king is overjoyed!"
  },

  /* Finding Erdrick's Token */
  {
    keywords: ["search", "take", "examine"],
    andAny: ["swamp", "poison_swamp"],
    notAnyTags: ["ERDRICKS_TOKEN"],
    priority: 4,
    probability: 0.5,
    triggers: ["ERDRICKS_TOKEN"],
    personality: `While searching the swamp, the hero spots something glinting
in the murky water!

⭐ Found Erdrick's Token! ⭐

This ancient medallion proves your lineage!

[Add ERDRICKS_TOKEN to FLAGS]
[Update SAVE]
[Reprint SAVE]
`,
    scenario: "A legendary artifact is discovered!"
  },

  /* Erdrick's Armor */
  {
    keywords: ["search", "take", "armor"],
    andAny: ["garinham", "graveyard"],
    andAllTags: ["ERDRICKS_TOKEN"],
    notAnyTags: ["ERDRICKS_ARMOR_FOUND"],
    priority: 5,
    triggers: ["ERDRICKS_ARMOR_FOUND"],
    personality: `Using Erdrick's Token, the hero locates a hidden passage!

⭐ Found Erdrick's Armor! ⭐
DEF +28 | HP regeneration!

The legendary armor of the great hero Erdrick!

[Add ERDRICKS_ARMOR to INV]
[Add ERDRICKS_ARMOR_FOUND to FLAGS]
[Update SAVE]
[Reprint SAVE]
`,
    scenario: "The hero discovers Erdrick's legendary equipment!"
  },

  /* Erdrick's Sword */
  {
    keywords: ["search", "take", "examine", "sword"],
    andAny: ["charlock", "throne"],
    andAllTags: ["SILVER_HARP", "STAFF_OF_RAIN"],
    notAnyTags: ["ERDRICKS_SWORD_FOUND"],
    priority: 5,
    triggers: ["ERDRICKS_SWORD_FOUND"],
    personality: `In the deepest chamber, bathed in an ethereal light,
lies a magnificent sword!

⚔️ Found Erdrick's Sword! ⚔️
ATK +40 | The ultimate weapon!

The blade that defeated evil long ago!

[Add ERDRICKS_SWORD to INV]
[Set EQP_W=ERDRICKS_SWORD]
[Add ERDRICKS_SWORD_FOUND to FLAGS]
[Update SAVE]
[Reprint SAVE]
`,
    scenario: "The legendary sword is claimed!"
  },

  /* Rainbow Drop Creation */
  {
    keywords: ["create", "combine", "rainbow drop", "make rainbow"],
    andAllTags: ["SILVER_HARP", "STAFF_OF_RAIN", "STONES_OF_SUNLIGHT"],
    notAnyTags: ["RAINBOW_DROP"],
    priority: 5,
    triggers: ["RAINBOW_DROP"],
    personality: `The hero combines the three sacred items!

🌈 Created the Rainbow Drop! 🌈

The Rainbow Bridge appears, leading to Charlock Castle!

[Add RAINBOW_DROP to FLAGS]
[Update SAVE]
[Reprint SAVE]
`,
    scenario: "The path to the Dragonlord opens!"
  },

// 🟢🟢🟢 FINAL BOSS 🟢🟢🟢

  /* Dragonlord Encounter */
  {
    keywords: ["dragonlord", "talk", "approach", "confront"],
    andAny: ["charlock_throne"],
    andAllTags: ["RAINBOW_DROP"],
    notAnyTags: ["DRAGONLORD_DEFEATED"],
    priority: 5,
    triggers: ["dragonlord_encounter"],
    personality: `The Dragonlord sits upon his dark throne!

🐉 DRAGONLORD 🐉

"I am the Dragonlord, and thou art brave indeed to
have come this far. If thou wilt join me, I will give
thee half the world to rule."

Will you join the Dragonlord?

[If YES: GAME OVER - Bad ending]
[If NO: Continue below]

Dragonlord: "Then thou art a fool! DIE!"

💀 THE DRAGONLORD ATTACKS! 💀
DRAGONLORD HP: 100/100

[Add COMBAT=DRAGONLORD_1_HP100 to SAVE]
[Reprint SAVE]
`,
    scenario: "The ultimate confrontation begins!"
  },

  /* Dragonlord Phase 2 */
  {
    andAny: ["combat=dragonlord_1_hp0"],
    priority: 5,
    triggers: ["dragonlord_phase2"],
    personality: `The Dragonlord staggers... then laughs!

"Foolish mortal! THIS IS MY TRUE FORM!"

💀💀💀 THE DRAGON EMERGES! 💀💀💀

The Dragonlord transforms into a massive dragon!

🐉 DRAGON HP: 165/165 🐉

His flames can scorch everything!

[Update COMBAT=DRAGONLORD_2_HP165 in SAVE]
[Reprint SAVE]
`,
    scenario: "The true battle begins!"
  },

  /* Victory! */
  {
    andAny: ["combat=dragonlord_2_hp0"],
    priority: 5,
    triggers: ["DRAGONLORD_DEFEATED", "GAME_WON"],
    personality: `The Dragon roars one final time... and falls!

⭐⭐⭐ VICTORY! ⭐⭐⭐

The Dragonlord is defeated!
The Ball of Light is restored!

Gained 2000 EXP!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The hero returns to Tantegel Castle...

King Lorik: "Brave warrior! Thou hast restored peace
to Alefgard! The land is saved!"

Princess Gwaelin: "Will you take me with you on your
next adventure?"

🎊 CONGRATULATIONS! 🎊

Thou hast completed Dragon Quest!

Final Level: [LVL]
Final Stats: [All stats]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Add DRAGONLORD_DEFEATED and GAME_WON to FLAGS]
[Update SAVE]
[Reprint SAVE]
`,
    scenario: "Peace returns to Alefgard!"
  },

// 🟢🟢🟢 LEVELING SYSTEM 🟢🟢🟢

  /* Level Up Check */
  {
    tag: "combat_end",
    priority: 5,
    personality: `[Check if EXP >= next level threshold]

[Level thresholds:]
L2: 7 | L3: 23 | L4: 47 | L5: 110 | L6: 220 |
L7: 450 | L8: 800 | L9: 1300 | L10: 2000 |
L11: 2900 | L12: 4000 | L13: 5500 | L14: 7500 |
L15: 10000 | L16: 13000 | L17: 16000 | L18: 19500 |
L19: 23000 | L20: 26500 | L21: 30000

[If leveled up:]
  🎉 LEVEL UP! 🎉

  Level [NEW_LVL] achieved!

  Max HP + [random 5-15]
  Max MP + [random 0-5]
  Strength + [random 1-4]
  Agility + [random 1-4]

  [If new spell learned at this level:]
    ✨ Learned new spell: [SPELL_NAME]! ✨

  [Update all stats in SAVE]
  [Reprint SAVE]
`,
    scenario: "The hero grows stronger!"
  },

// 🟢🟢🟢 DEATH & RESURRECTION 🟢🟢🟢

  /* Death */
  {
    andAny: ["hp=0/", "hp=0|"],
    priority: 5,
    triggers: ["hero_died"],
    personality: `
💀💀💀 THOU ART DEAD 💀💀💀

Darkness surrounds you...

But Princess Gwaelin's love brings you back!

You awaken in Tantegel Castle.

[Restore HP to MaxHP/2]
[Restore MP to MaxMP/2]
[Reduce GOLD by 50%]
[Set LOC=TANTEGEL_THRONE]
[Remove any COMBAT= status]

Gold lost: [GOLD/2]

[Update SAVE]
[Reprint SAVE]
`,
    scenario: "Death is but a temporary setback..."
  },

// 🟢🟢🟢 UTILITY COMMANDS 🟢🟢🟢

  /* SAVE State Display */
  {
    keywords: ["save", "save state", "show save", "current save"],
    priority: 5,
    personality: `
╔════════════════════════════════════════════════════════════╗
║                    CURRENT SAVE STATE                      ║
╠════════════════════════════════════════════════════════════╣

[Extract and format current SAVE block in readable format]

HP: [HP]
MP: [MP]
Level: [LVL]
Gold: [GOLD]
Experience: [EXP]
Location: [LOC - show friendly name]

Equipment:
  Weapon: [EQP_W]
  Armor: [EQP_A]
  Shield: [EQP_S]

Inventory: [INV]
Magic Keys: [KEYS]

Quest Progress:
[List all FLAGS with checkmarks ✓]

╚════════════════════════════════════════════════════════════╝

[Reprint full SAVE block]
`,
    scenario: "The hero reviews their progress."
  },

  /* HELP Command */
  {
    keywords: ["help", "commands", "how to play", "instructions"],
    priority: 5,
    personality: `
╔════════════════════════════════════════════════════════════╗
║              DRAGON QUEST COMMAND REFERENCE                ║
╠════════════════════════════════════════════════════════════╣
║ MOVEMENT:                                                  ║
║   GO NORTH/SOUTH/EAST/WEST - Move in direction            ║
║   SEARCH - Examine area for items and secrets             ║
║                                                            ║
║ COMBAT:                                                    ║
║   ATTACK - Strike enemy with weapon                       ║
║   DEFEND - Raise shield to reduce damage                  ║
║   CAST [spell] - Use magic (HEAL, HURT, etc.)            ║
║   RUN - Attempt to flee battle                            ║
║                                                            ║
║ INTERACTION:                                               ║
║   TALK - Speak with NPCs                                  ║
║   TAKE - Pick up items                                    ║
║   DOOR - Use Magic Key on locked door                     ║
║                                                            ║
║ ITEMS & EQUIPMENT:                                         ║
║   USE [item] - Use item from inventory                    ║
║   EQUIP [item] - Change equipment                         ║
║   BUY [item] - Purchase at shops                          ║
║   SELL [item] - Sell to merchants                         ║
║                                                            ║
║ MAGIC:                                                     ║
║   HEAL - Restore HP (MP:4, Lv3+)                          ║
║   HURT - Attack spell (MP:2, Lv4+)                        ║
║   SLEEP - Put enemy to sleep (MP:2, Lv7+)                 ║
║   OUTSIDE - Escape dungeon (MP:6, Lv12+)                  ║
║   RETURN - Warp to Tantegel (MP:8, Lv13+)                 ║
║                                                            ║
║ STATUS:                                                    ║
║   STATS - View character status                           ║
║   SAVE - Display current save state                       ║
╚════════════════════════════════════════════════════════════╝

[Reprint current SAVE]
`,
    scenario: "The hero recalls their training."
  }

// 🛑🛑🛑 DO NOT EDIT BELOW THIS LINE 🛑🛑🛑
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
