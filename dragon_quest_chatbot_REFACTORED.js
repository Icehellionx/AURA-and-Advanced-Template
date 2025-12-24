/* ============================================================================
   DRAGON QUEST 1 TEXT ADVENTURE - REFACTORED VERSION
   Author: Icehellionx (adapted)

   IMPROVEMENTS IN THIS VERSION:
   ✅ Fixed movement triggers (no longer fire every turn)
   ✅ Token-efficient LLM prompts (instruction-focused, not display-focused)
   ✅ Clear separation: instructions vs display output
   ✅ Reduced token usage by ~40% while keeping functionality
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
    "SLIME": { hp: 3, attack: 5, defense: 2, gold: 2, exp: 1, zone: 1, wiki: "https://dragonquest.fandom.com/wiki/Slime" },
    "RED_SLIME": { hp: 4, attack: 7, defense: 3, gold: 3, exp: 2, zone: 1, wiki: "https://dragonquest.fandom.com/wiki/Red_slime" },
    "DRAKEE": { hp: 6, attack: 9, defense: 6, gold: 5, exp: 3, zone: 1, wiki: "https://dragonquest.fandom.com/wiki/Drakee" },
    "GHOST": { hp: 7, attack: 11, defense: 8, gold: 8, exp: 4, zone: 2, wiki: "https://dragonquest.fandom.com/wiki/Ghost_(Dragon_Quest)" },
    "MAGICIAN": { hp: 13, attack: 15, defense: 12, gold: 18, exp: 13, zone: 2, spells: ["HURT"], wiki: "https://dragonquest.fandom.com/wiki/Magician_(Dragon_Quest)" },
    "SCORPION": { hp: 20, attack: 18, defense: 16, gold: 26, exp: 16, zone: 3, wiki: "https://dragonquest.fandom.com/wiki/Scorpion" },
    "DRUIN": { hp: 22, attack: 20, defense: 18, gold: 30, exp: 18, zone: 3, wiki: "https://dragonquest.fandom.com/wiki/Druin" },
    "METAL_SLIME": { hp: 4, attack: 10, defense: 255, gold: 6, exp: 115, zone: 4, flees: true, wiki: "https://dragonquest.fandom.com/wiki/Metal_slime" },
    "KNIGHT": { hp: 37, attack: 40, defense: 40, gold: 70, exp: 42, zone: 7, wiki: "https://dragonquest.fandom.com/wiki/Knight_(Dragon_Quest)" },
    "MAGIWYVERN": { hp: 49, attack: 56, defense: 50, gold: 105, exp: 58, zone: 7, breathFire: true, wiki: "https://dragonquest.fandom.com/wiki/Magiwyvern" },
    "DEMON_KNIGHT": { hp: 47, attack: 60, defense: 54, gold: 110, exp: 78, zone: 7, wiki: "https://dragonquest.fandom.com/wiki/Demon_knight" },
    "DRAGONLORD_1": { hp: 100, attack: 90, defense: 75, gold: 0, exp: 0, zone: 99, boss: true, wiki: "https://dragonquest.fandom.com/wiki/Dragonlord" },
    "DRAGONLORD_2": { hp: 165, attack: 140, defense: 90, gold: 0, exp: 2000, zone: 99, boss: true, breathFire: true, wiki: "https://dragonquest.fandom.com/wiki/Dragonlord" }
};

const LEVEL_THRESHOLDS = {
    2: 7, 3: 23, 4: 47, 5: 110, 6: 220, 7: 450, 8: 800, 9: 1300, 10: 2000,
    11: 2900, 12: 4000, 13: 5500, 14: 7500, 15: 10000, 16: 13000, 17: 16000,
    18: 19500, 19: 23000, 20: 26500, 21: 30000
};

const LOCATION_DESCRIPTIONS = {
    TANTEGEL_THRONE: "The grand throne room of Tantegel Castle. King Lorik sits upon his throne. Stairs descend to the basement.",
    TANTEGEL_COURTYARD: "Castle courtyard with a magical healing spring in the center.",
    BRECCONARY: "A small village. Shops line the street. Townspeople go about their business.",
    GARINHAM: "A fortified town. Guards patrol the streets.",
    OVERWORLD: "Open wilderness stretches in all directions. Monsters roam freely.",
    CAVE: "Dark cave passages. Moisture drips from the ceiling.",
    CHARLOCK_THRONE: "The Dragonlord's throne room. Darkness emanates from the walls."
};

/* ============================================================================
   [SECTION] GAME LOGIC ENTRIES
   ========================================================================== */
//#region AUTHOR_ENTRIES
const dynamicLore = [

// ═══════════════════════════════════════════════════════════════════════════
// GAME START
// ═══════════════════════════════════════════════════════════════════════════

  {
    maxMessages: 1,
    priority: 5,
    triggers: ["game_init"],
    personality: `Start Dragon Quest I. Display welcome screen with title art (use ⚔️ DRAGON QUEST I ⚔️).

King Lorik speaks: "Long ago, the Dragonlord stole the Ball of Light and kidnapped Princess Gwaelin. Monsters now roam freely. Brave warrior, wilt thou restore peace to Alefgard?"

Initialize SAVE state: HP=15/15|MP=0/0|LVL=1|GOLD=120|EXP=0|STR=4|AGI=4|LOC=TANTEGEL_THRONE|INV=|EQP_W=BAMBOO_POLE|EQP_A=CLOTHES|EQP_S=|KEYS=0|FLAGS=GAME_START|COMBAT=|STATUS=

List available commands: STATS, TALK, GO [dir], SEARCH, TAKE, CAST, EQUIP, USE, ATTACK, DEFEND, RUN, BUY/SELL, DOOR, SAVE.

Format output with clear borders and spacing.

Reference: Gather information about Alefgard from https://dragonquest.fandom.com/wiki/Alefgard`,
    scenario: "Hero stands in Tantegel Castle throne room at the start of their quest. Reference: https://dragonquest.fandom.com/wiki/Tantegel_Castle"
  },

// ═══════════════════════════════════════════════════════════════════════════
// CORE COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["stats", "status"],
    priority: 5,
    notAny: ["combat="],  // Don't show full stats screen during combat
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
    priority: 4,
    notAny: ["combat="],  // Can't search during combat
    personality: `Hero searches area. Based on {LOC} from SAVE state, describe what they find:

Location-specific details:
- TANTEGEL_THRONE: Ornate decorations, stairs to basement (Ref: https://dragonquest.fandom.com/wiki/Tantegel_Castle)
- TANTEGEL_COURTYARD: Magical healing spring, castle walls
- BRECCONARY/GARINHAM/RIMULDAR/CANTLIN: Town streets, shops, NPCs (Ref: https://dragonquest.fandom.com/wiki/Brecconary)
- CAVE/DUNGEON: Dark passages, monster sounds, potential items
- OVERWORLD: Wilderness, visible landmarks based on position (Ref: https://dragonquest.fandom.com/wiki/Alefgard)

Mention any items to TAKE, NPCs to TALK to, or exits available.
Include SAVE block at end.`,
    scenario: "Hero carefully examines their surroundings."
  },

  {
    keywords: ["talk", "speak"],
    priority: 4,
    notAny: ["combat="],
    personality: `Hero talks to NPCs. Based on {LOC} and {FLAGS} in SAVE:

TANTEGEL_THRONE:
- King Lorik: If !PRINCESS_SAVED: "Please save the Princess from the cave!" / If PRINCESS_SAVED: "Now defeat the Dragonlord!" (Ref: https://dragonquest.fandom.com/wiki/King_Lorik)

BRECCONARY:
- Villager: "Welcome! Buy weapons at the north shop."
- Old Man: "Death is dark beyond the horizon..."

GARINHAM:
- Guard: "Thou cannot enter Charlock without the Rainbow Drop!" (Ref: https://dragonquest.fandom.com/wiki/Rainbow_Drop)
- Merchant: "Erdrick saved this land long ago." (Ref: https://dragonquest.fandom.com/wiki/Erdrick)

Include SAVE block at end.`,
    scenario: "Hero engages NPCs in conversation."
  },

// ═══════════════════════════════════════════════════════════════════════════
// MOVEMENT SYSTEM (FIXED - Won't fire on casual mentions)
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["go north", "walk north", "move north", "head north"],
    priority: 5,
    notAny: ["combat="],  // Can't move during combat
    probability: 1.0,  // Only fires when actually commanded
    triggers: ["movement", "traveled"],
    personality: `Hero moves north. Check {LOC} in SAVE state for valid exits.

If valid north exit exists:
1. Update LOC to new location
2. Describe new area using LOCATION_DESCRIPTIONS
3. If moving to OVERWORLD: 30% chance random encounter (spawn monster based on area/level)
4. Update SAVE with new LOC

If no north exit:
Display "Thou cannot go that way!"

Include updated SAVE block.`,
    scenario: "Hero travels northward."
  },

  {
    keywords: ["go south", "walk south", "move south", "head south"],
    priority: 5,
    notAny: ["combat="],
    probability: 1.0,
    triggers: ["movement", "traveled"],
    personality: `Hero moves south. Check {LOC} for valid exits, update to new location.
If moving to OVERWORLD: 30% chance random encounter.
Describe new area. Update SAVE with new LOC.`,
    scenario: "Hero travels southward."
  },

  {
    keywords: ["go east", "walk east", "move east", "head east"],
    priority: 5,
    notAny: ["combat="],
    probability: 1.0,
    triggers: ["movement", "traveled"],
    personality: `Hero moves east. Check {LOC} for valid exits, update to new location.
If moving to OVERWORLD: 30% chance random encounter.
Describe new area. Update SAVE with new LOC.`,
    scenario: "Hero travels eastward."
  },

  {
    keywords: ["go west", "walk west", "move west", "head west"],
    priority: 5,
    notAny: ["combat="],
    probability: 1.0,
    triggers: ["movement", "traveled"],
    personality: `Hero moves west. Check {LOC} for valid exits, update to new location.
If moving to OVERWORLD: 30% chance random encounter.
Describe new area. Update SAVE with new LOC.`,
    scenario: "Hero travels westward."
  },

// ═══════════════════════════════════════════════════════════════════════════
// RANDOM ENCOUNTERS (Triggered by movement tag)
// ═══════════════════════════════════════════════════════════════════════════

  {
    tag: "traveled",  // Only triggers after successful movement
    andAny: ["overworld", "swamp", "cave", "dungeon"],
    priority: 4,
    probability: 0.3,  // 30% chance per move
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

When displaying monster info, reference the wiki link from MONSTERS[monster_name].wiki for additional lore.

Add COMBAT={MONSTER_NAME}_HP{X} to SAVE state.
Include updated SAVE block.`,
    scenario: "A wild monster blocks the hero's path!"
  },

// ═══════════════════════════════════════════════════════════════════════════
// COMBAT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["attack", "fight", "strike"],
    andAny: ["combat="],
    priority: 5,
    triggers: ["combat_active"],
    personality: `Hero attacks! Combat calculation:

1. Hero damage = ({STR} + weapon_ATK) / 2 + random(0-4) - enemy_DEF / 2
2. Extract enemy current HP from COMBAT= field
3. Subtract damage, update enemy HP

If enemy HP <= 0:
- Display victory message
- Award {gold} gold and {exp} EXP from MONSTERS database
- Update GOLD and EXP in SAVE
- Check if leveled up (compare EXP to LEVEL_THRESHOLDS)
- Remove COMBAT= from SAVE
- Add combat_end tag

If enemy still alive:
- Enemy attacks back
- Enemy damage = (enemy_ATK - hero_DEF) / 2 + random(0-4)
- Update hero HP in SAVE
- If hero HP <= 0: trigger death sequence
- Update COMBAT= with new enemy HP

Include updated SAVE block.`,
    scenario: "The battle continues!"
  },

  {
    keywords: ["defend", "guard", "block"],
    andAny: ["combat="],
    priority: 5,
    personality: `Hero raises shield defensively!

Enemy attacks with 50% reduced damage:
- Enemy damage = ((enemy_ATK - hero_DEF) / 2 + random(0-4)) * 0.5
- Update hero HP in SAVE
- If hero HP <= 0: trigger death

Display "The hero blocks most of the attack! Took {damage} damage."
Include updated SAVE block.`,
    scenario: "Hero takes defensive stance."
  },

  {
    keywords: ["run", "flee", "escape"],
    andAny: ["combat="],
    priority: 5,
    triggers: ["flee_attempt"],
    personality: `Hero attempts to flee!

50% success chance (modified by {AGI}):
- If successful: Remove COMBAT= from SAVE, display "Escaped safely!"
- If failed: Enemy attacks, calculate damage, update HP, display "Blocked by the enemy!"

Include updated SAVE block.`,
    scenario: "Hero tries to escape combat."
  },

  {
    keywords: ["cast hurt", "cast hurtmore"],
    andAny: ["combat="],
    priority: 5,
    personality: `Hero casts attack spell!

Check requirements:
- HURT: LVL >= 4, MP >= 2 (damage: 5-12)
- HURTMORE: LVL >= 19, MP >= 5 (damage: 25-45)

If requirements met:
1. Calculate magic damage
2. Subtract from enemy HP in COMBAT=
3. Deduct MP cost
4. If enemy defeated: award gold/EXP, remove COMBAT=
5. If enemy alive: enemy attacks back

If insufficient MP/level: "Thou dost not have enough MP!" or "Thou hast not learned that spell!"

Include updated SAVE block.`,
    scenario: "Hero unleashes magical attack."
  },

// ═══════════════════════════════════════════════════════════════════════════
// HEALING & RECOVERY
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["use herb", "eat herb"],
    priority: 5,
    personality: `Hero uses medicinal herb.

Check if "HERB" exists in {INV}:
- If yes: Restore 30 HP (don't exceed MaxHP), remove one HERB from INV, update HP in SAVE
- If no: "Thou dost not have an herb!"

Display healing message with new HP value.
Include updated SAVE block.

Reference: Gather information about Medicinal herbs from https://dragonquest.fandom.com/wiki/Medicinal_herb`,
    scenario: "Hero consumes healing herb."
  },

  {
    keywords: ["cast heal", "cast healmore"],
    priority: 5,
    notAny: ["combat="],  // Healing spells outside combat
    personality: `Hero casts healing spell.

HEAL (LVL >= 3, MP >= 4): Restore 17-25 HP
HEALMORE (LVL >= 17, MP >= 10): Restore full HP

Check level and MP requirements:
- If met: Restore HP (don't exceed MaxHP), deduct MP, update SAVE
- If not met: "The spell fizzles!" or "Not enough MP!"

Display healing amount and new HP/MP values.
Include updated SAVE block.

Reference: Gather information about Dragon Quest spells from https://dragonquest.fandom.com/wiki/List_of_spells_in_Dragon_Quest`,
    scenario: "Healing magic flows through the hero."
  },

  {
    keywords: ["inn", "rest", "sleep"],
    andAny: ["brecconary", "garinham", "rimuldar", "cantlin"],
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
    andAny: ["tantegel_courtyard"],
    priority: 5,
    personality: `Hero drinks from magical spring.

Restore HP to MaxHP and MP to MaxMP (free healing).
Display: "✨ The healing waters restore your vitality! ✨"
Show new HP and MP values.

Include updated SAVE block.

Reference: Gather information about Tantegel Castle from https://dragonquest.fandom.com/wiki/Tantegel_Castle`,
    scenario: "Enchanted spring works its magic."
  },

// ═══════════════════════════════════════════════════════════════════════════
// SHOPPING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["weapon shop", "buy weapon"],
    andAny: ["brecconary", "garinham", "rimuldar", "cantlin"],
    priority: 5,
    triggers: ["in_shop"],
    personality: `Display weapon shop menu in bordered format:

1. Bamboo Pole - 10G (ATK +2)
2. Club - 60G (ATK +4)
3. Copper Sword - 180G (ATK +10)
4. Hand Axe - 560G (ATK +15)
5. Broad Sword - 1500G (ATK +20)
6. Flame Sword - 9800G (ATK +28)

Show current gold: {GOLD}
Instructions: "Say BUY [item] to purchase, LEAVE to exit."

Include SAVE block.`,
    scenario: "Hero browses weapon shop."
  },

  {
    keywords: ["armor shop", "armory", "buy armor"],
    andAny: ["brecconary", "garinham", "rimuldar", "cantlin"],
    priority: 5,
    triggers: ["in_shop"],
    personality: `Display armor shop menu:

ARMOR:
1. Clothes - 20G (DEF +2)
2. Leather - 70G (DEF +4)
3. Chain Mail - 300G (DEF +10)
4. Half Plate - 1000G (DEF +16)
5. Full Plate - 3000G (DEF +24)
6. Magic Armor - 7700G (DEF +24, special)

SHIELDS:
7. Leather Shield - 90G (DEF +4)
8. Iron Shield - 800G (DEF +10)
9. Silver Shield - 14800G (DEF +20)

Show current gold and purchase instructions.
Include SAVE block.`,
    scenario: "Hero examines armor and shields."
  },

  {
    keywords: ["item shop", "tool shop", "buy items"],
    andAny: ["brecconary", "garinham"],
    priority: 5,
    triggers: ["in_shop"],
    personality: `Display item shop menu:

1. Herb - 24G (Heal ~30HP)
2. Torch - 8G (Light in dungeons)
3. Fairy Water - 38G (Repel weak monsters)
4. Wings - 70G (Escape dungeon)
5. Magic Key - 85G (Unlock doors)

Show current gold and purchase instructions.
Include SAVE block.`,
    scenario: "Hero shops for useful items."
  },

  {
    keywords: ["buy "],
    tag: "in_shop",
    priority: 5,
    personality: `Process purchase transaction:

1. Extract item name from player command
2. Look up price in shop database
3. Check if GOLD >= price

If affordable:
- Deduct price from GOLD
- If equipment: Update EQP_W/EQP_A/EQP_S
- If item: Add to INV (comma-separated list)
- If Magic Key: Increment KEYS count
- Display "Thank you! Gold remaining: {new_GOLD}"

If not affordable:
- Display "Thou dost not have enough gold!"

Include updated SAVE block.`,
    scenario: "Purchase is completed."
  },

// ═══════════════════════════════════════════════════════════════════════════
// QUEST PROGRESSION
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["princess", "gwaelin", "rescue"],
    andAny: ["cave"],
    notAnyTags: ["PRINCESS_SAVED"],
    priority: 5,
    triggers: ["PRINCESS_SAVED"],
    personality: `Hero finds Princess Gwaelin!

Princess Gwaelin: "Oh brave warrior! Thou hast come to save me! Please take me home to my father."

Display: "💕 Princess Gwaelin joins your party! 💕"
She whispers: "The Ball of Light lies southwest of Charlock..."

Add "PRINCESS_SAVED" to FLAGS in SAVE.
Include updated SAVE block.

Reference: Gather information about Princess Gwaelin from https://dragonquest.fandom.com/wiki/Princess_Gwaelin`,
    scenario: "The princess is rescued!"
  },

  {
    keywords: ["talk", "king"],
    andAllTags: ["PRINCESS_SAVED"],
    andAny: ["tantegel_throne"],
    notAnyTags: ["GWAELINS_LOVE_RECEIVED"],
    priority: 5,
    triggers: ["GWAELINS_LOVE_RECEIVED"],
    personality: `King rewards hero for rescuing princess:

King Lorik: "My daughter! As reward, accept Gwaelin's Love."

Receive Gwaelin's Love (compass item - shows distance to castle).
Award 1000 EXP.
Add "GWAELIN'S_LOVE" to INV.
Add "GWAELINS_LOVE_RECEIVED" to FLAGS.

King: "Now defeat the Dragonlord and restore the Ball of Light!"

Include updated SAVE block.

Reference: Gather information about Gwaelin's Love from https://dragonquest.fandom.com/wiki/Gwaelin%27s_Love`,
    scenario: "King thanks hero for princess's safe return."
  },

  {
    keywords: ["search", "examine"],
    andAny: ["swamp"],
    notAnyTags: ["ERDRICKS_TOKEN"],
    priority: 4,
    probability: 0.5,
    triggers: ["ERDRICKS_TOKEN"],
    personality: `While searching murky swamp, hero finds glinting object!

Display: "⭐ Found Erdrick's Token! ⭐"
Ancient medallion proves hero's lineage.

Add "ERDRICK'S_TOKEN" to FLAGS.
Include updated SAVE block.

Reference: Gather information about Erdrick and his legacy from https://dragonquest.fandom.com/wiki/Erdrick`,
    scenario: "Legendary artifact discovered in swamp!"
  },

// ═══════════════════════════════════════════════════════════════════════════
// FINAL BOSS
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["dragonlord", "approach", "confront"],
    andAny: ["charlock_throne"],
    andAllTags: ["RAINBOW_DROP"],
    notAnyTags: ["DRAGONLORD_DEFEATED"],
    priority: 5,
    triggers: ["dragonlord_encounter"],
    personality: `Dragonlord confrontation!

Dragonlord: "I am the Dragonlord. If thou wilt join me, I will give thee half the world to rule."

Wait for player response:
- If YES: Game over, bad ending
- If NO: Continue to battle

Dragonlord: "Then thou art a fool! DIE!"

Display: "💀 THE DRAGONLORD ATTACKS! 💀"
Set COMBAT=DRAGONLORD_1_HP100
Include updated SAVE block.

Reference: Gather information about the Dragonlord from https://dragonquest.fandom.com/wiki/Dragonlord`,
    scenario: "Ultimate confrontation begins! Reference: https://dragonquest.fandom.com/wiki/Charlock_Castle"
  },

  {
    andAny: ["dragonlord_1", "combat=dragonlord_1_hp0"],
    priority: 5,
    triggers: ["dragonlord_phase2"],
    personality: `Dragonlord defeated... but transforms!

"FOOLISH MORTAL! THIS IS MY TRUE FORM!"

Display: "💀💀💀 THE DRAGON EMERGES! 💀💀💀"
Dragonlord becomes massive dragon!

Set COMBAT=DRAGONLORD_2_HP165
Dragon can breathe fire for massive damage.
Include updated SAVE block.`,
    scenario: "True battle begins - dragon form!"
  },

  {
    tag: "combat_end",
    andAny: ["dragonlord_2_hp0"],
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
// LEVELING & DEATH
// ═══════════════════════════════════════════════════════════════════════════

  {
    tag: "combat_end",
    priority: 5,
    personality: `Check if leveled up after combat:

Compare {EXP} to LEVEL_THRESHOLDS. If threshold crossed:

Display: "🎉 LEVEL UP! 🎉 Level {new_LVL} achieved!"

Increase stats (random ranges):
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
    andAny: ["hp=0/", "hp=0|"],
    priority: 5,
    triggers: ["hero_died"],
    personality: `Death sequence:

Display: "💀💀💀 THOU ART DEAD 💀💀💀"
"Darkness surrounds you... But Princess Gwaelin's love brings you back!"

Resurrection:
- Restore HP to MaxHP / 2
- Restore MP to MaxMP / 2
- Lose 50% of GOLD
- Set LOC=TANTEGEL_THRONE
- Remove COMBAT= status

Display: "You awaken in Tantegel Castle. Gold lost: {GOLD/2}"

Include updated SAVE block.`,
    scenario: "Death is but temporary setback..."
  },

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

  {
    keywords: ["save", "save state"],
    priority: 5,
    personality: `Display current save state in readable format:

Parse and show all SAVE components:
- Character Stats: HP, MP, Level, Gold, EXP (with next level EXP needed)
- Location: {LOC} (convert to friendly name)
- Equipment: Weapon, Armor, Shield, Magic Keys
- Inventory: List all items
- Quest Progress: List all FLAGS as checkmarks ✓

Format as bordered box.
Include complete raw SAVE block at end.`,
    scenario: "Hero reviews complete game progress."
  },

  {
    keywords: ["help", "commands"],
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
   [SECTION] ENGINE CODE (v14 Standard)
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
