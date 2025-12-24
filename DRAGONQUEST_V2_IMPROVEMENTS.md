# Dragon Quest V2 - Key Improvements & Implementation Guide

## 🎯 What's New in V2

### 1. **SAVE State Parser** ✅
**Location:** Lines 21-76 in dragonquest_v2.js

The script now **actively reads** the [SAVE: ...] block from the AI's last response (`last_messages[length-2]`):

```javascript
function parseSaveState() {
    const aiLastMsg = _lmArr[_lmArr.length - 2]; // AI's previous response
    const saveMatch = msgText.match(/\[SAVE:\s*([^\]]+)\]/);
    // Parses key=value pairs into GAME_STATE object
}
```

**Benefits:**
- No longer relying on the AI to manually extract state
- Script can make decisions based on actual game state
- Entries can use `hasFlag("PRINCESS_SAVED")`, `getLevel()`, etc.

**Helper Functions Added:**
- `getHP()`, `getCurrentHP()`, `getMaxHP()`
- `getMP()`, `getCurrentMP()`, `getMaxMP()`
- `getLevel()`, `getGold()`, `getEXP()`
- `getLocation()`, `getInventory()`, `getFlags()`
- `hasFlag(flag)`, `inCombat()`, `getCombatEnemy()`

### 2. **Complete Monster Database** ✅
**Location:** Lines 84-142

Added **ALL 30+ Dragon Quest 1 enemies** with complete stats:

```javascript
const MONSTERS = {
    "SLIME": { hp: 3, attack: 5, defense: 2, gold: 2, exp: 1, zone: 1, sleep: 7 },
    "MAGICIAN": { hp: 13, attack: 15, defense: 12, spells: ["HURT", "SLEEP"] },
    "METAL_SLIME": { hp: 4, defense: 255, exp: 115, flees: true },
    "DRAGONLORD_2": { hp: 165, attack: 140, breathFire: true, boss: true },
    // ... 30+ more
}
```

**New Monster Properties:**
- `sleep` - Resistance to SLEEP spell (0-7, 0 = immune)
- `spells` - Array of spells the monster can cast
- `breathFire` - Can use breath attack (ignores defense)
- `flees` - Attempts to run away (Metal Slimes!)
- `boss` - Special boss enemy

**Zones:**
- Zone 1: Tantegel area (Slime, Red Slime, Drakee)
- Zone 2: Brecconary (Ghost, Magician, Magidrakee)
- Zone 3: Eastern areas (Scorpion, Druin, Poltergeist)
- Zone 4: Southern swamp (Skeleton, Warlock, Metal Slime)
- Zone 5: Western mountains (Specter, Wolflord, Druinlord)
- Zone 6: Charlock approach (Wyvern, Golem, Wraith Knight)
- Zone 7: Deep Charlock (Knight, Demon Knight, Green Dragon)
- Zone 99: Bosses (Dragonlord phases)

### 3. **Advanced Heuristics Usage** ✅
**Location:** Throughout script

**prev.keywords Support:**
```javascript
{
    'prev.keywords': ["attack", "cast"],
    keywords: ["yes", "confirm"],
    personality: "Executing the previously mentioned action..."
}
```
- Detects keywords in AI's **previous** response
- Useful for confirmation dialogs
- Example: AI asks "Attack or run?", user says "attack" → next turn detects "attack" was in prev message

**Group Exclusion:**
```javascript
{
    group: "combat_attack",
    keywords: ["attack"],
    // Only one entry from "combat_attack" group will fire
}
```
- Prevents multiple entries from same category firing
- Keeps responses clean and focused

**Shifts for Variations:**
```javascript
{
    keywords: ["cast"],
    personality: "Casting a spell...",
    Shifts: [
        {
            keywords: ["heal"],
            personality: "HEAL! HP restored!"
        },
        {
            keywords: ["hurt"],
            personality: "HURT! Enemy takes damage!"
        }
    ]
}
```
- Base entry handles general "cast" command
- Shifts specialize for specific spells

### 4. **Complete Item & Spell Databases** ✅

**Spells with Full Data:**
```javascript
const SPELLS = {
    "HEAL": { mp: 4, power: "17-25", learn: 3, type: "heal" },
    "HURT": { mp: 2, power: "5-12", learn: 4, type: "attack" },
    // ... all 10 spells
}
```

**Items Including Special/Cursed:**
```javascript
"CURSED_BELT": { type: "cursed", effect: "agi_half" },
"FAIRY_FLUTE": { type: "key", effect: "golem_stop" },
"GWAELINS_LOVE": { type: "key", effect: "compass" }
```

**Level Thresholds:**
```javascript
const LEVEL_THRESHOLDS = {
    2: 7, 3: 23, 4: 47, ..., 30: 65000
}
```

## 🚧 What Still Needs to Be Added

### Critical Missing Mechanics

#### 1. **Status Effects**
Need to add to SAVE format and track:
- `STATUS=ASLEEP,STOPSPELL` (comma-separated active effects)
- Sleep duration (1-6 turns)
- STOPSPELL duration (4-6 turns)
- REPEL active turns

**Lore Entries Needed:**
```javascript
{
    keywords: ["cast", "sleep"],
    andAny: ["combat="],
    personality: `
SLEEP! The ${enemy} grows drowsy...
[Roll against enemy.sleep resistance]
[If success: Add ASLEEP_3 to enemy STATUS for 3 turns]
[If fail: "But nothing happened!"]
    `
}
```

#### 2. **Locked Doors**
```javascript
{
    keywords: ["door", "open door"],
    'prev.keywords': ["locked", "magic key"],
    personality: `
[Check if KEYS > 0]
[If yes: KEYS--, open door, reveal treasure/passage]
[If no: "The door is locked! Thou needst a Magic Key!"]
    `
}
```

#### 3. **Darkness / RADIANT**
```javascript
{
    keywords: ["cave", "dungeon"],
    notAny: ["torch", "radiant"],
    personality: `
It's pitch dark! Thou canst see nothing!
[Limit available actions: CAST RADIANT, USE TORCH, GO BACK]
    `
}
```

#### 4. **Enemy Spells & Breath**
```javascript
{
    tag: "enemy_turn",
    andAny: ["combat=magician", "combat=warlock"],
    probability: 0.4,
    personality: `
The Magician casts HURT!
[Calculate spell damage]
[If STOPSPELL active on enemy: "But the spell fizzles!"]
    `
}
```

#### 5. **Fairy Flute (Golem)**
```javascript
{
    keywords: ["use", "fairy flute", "flute"],
    andAny: ["combat=golem"],
    personality: `
Thou played the Fairy Flute!
The Golem stops moving and falls asleep!
[Remove COMBAT=, add GOLEM_DEFEATED flag, grant EXP/GOLD]
    `
}
```

#### 6. **Gwaelin's Love (Compass)**
```javascript
{
    keywords: ["use", "gwaelins love", "love"],
    personality: `
Princess Gwaelin's voice echoes:
"${getLocation()} is ${calculateDistance()} paces
${calculateDirection()} of Tantegel Castle."
    `
}
```

#### 7. **Cursed Items**
```javascript
{
    keywords: ["take", "cursed belt"],
    personality: `
Thou obtained the Cursed Belt!
[Add CURSED_BELT to INV]
[Reduce AGI by 50%]
"The belt tightens around thee! Thou feelst cursed!"
    `
},
{
    keywords: ["remove", "cursed"],
    andAny: ["cursed_belt"],
    notAny: ["temple", "priest"],
    personality: `
Thou cannot remove it! The curse is too strong!
[Need to visit temple/priest to remove]
    `
}
```

#### 8. **REPEL Effect**
```javascript
{
    tag: "movement",
    'prev.keywords': ["repel"],
    andAny: ["repel_active"],
    probability: 0.05, // Reduced from 0.3
    personality: `
[REPEL drastically reduces encounter rate]
[Decrement REPEL turns remaining]
    `
}
```

#### 9. **Death Curse (Dragonlord)**
```javascript
{
    keywords: ["yes", "join"],
    tag: "dragonlord_offer",
    personality: `
💀 BAD ENDING 💀

The Dragonlord laughs! "Then serve me in darkness!"

Thou hast chosen to side with evil.
The world falls into eternal night.

GAME OVER

[Set FLAGS=GAME_OVER_BAD]
    `
}
```

#### 10. **Metal Slime Flee Mechanic**
```javascript
{
    andAny: ["combat=metal_slime"],
    probability: 0.5, // 50% chance per turn
    'prev.keywords': ["attack", "hurt"],
    personality: `
The Metal Slime is fleeing!
[Remove COMBAT=]
"The Metal Slime ran away!"
    `
}
```

## 📝 System Prompt Updates Needed

### GUI Display Instructions

Add this section to the system prompt:

```markdown
### GUI Formatting Rules

**Box Drawing Characters:**
Use these exact characters for menus and displays:
- Corners: ╔ ╗ ╚ ╝
- Horizontal: ═
- Vertical: ║
- T-junctions: ╠ ╣ ╦ ╩
- Cross: ╬

**Example Shop Menu:**
```
╔════════════════════════════════════════╗
║          WEAPON SHOP                   ║
╠════════════════════════════════════════╣
║ 1. Copper Sword....180 G (ATK +10)    ║
║ 2. Hand Axe........560 G (ATK +15)    ║
╚════════════════════════════════════════╝
```

**Status Displays:**
Always use fixed-width formatting to align numbers:
```
HP: 035/050 | MP: 012/025 | Gold: 00450 G
```

**Combat HUD:**
```
⚔️ SLIME HP: 03/03 ⚔️
Your HP: 15/20

> ATTACK  DEFEND  SPELL  RUN
```
```

### SAVE Block Parsing Instructions

Add to system prompt:

```markdown
### Reading Game State

**CRITICAL: Always read your OWN previous response to get current state!**

1. Look at your last message (not the user's)
2. Find the [SAVE: ...] block
3. Parse each KEY=VALUE pair
4. Use these values for ALL calculations

**Example:**
```
User: "attack"
AI Previous: "... [SAVE: HP=15/20|GOLD=50|COMBAT=SLIME_HP3] ..."
AI Current: [Reads: HP is 15/20, fighting SLIME with 3 HP, have 50 gold]
            [Calculates damage, updates: SLIME_HP1]
            [Outputs: "... [SAVE: HP=15/20|GOLD=50|COMBAT=SLIME_HP1] ..."]
```

**State Update Rules:**
- ALWAYS include the complete [SAVE: ...] block
- Change ONLY the affected values
- Keep all other values identical
- Increment/decrement numbers correctly (no typos!)

**Common Mistakes to Avoid:**
- ❌ Making up values without reading previous SAVE
- ❌ Forgetting to update HP after damage
- ❌ Not removing COMBAT= when battle ends
- ❌ Forgetting to add EXP/GOLD after victory
```

## 🔨 How to Complete V2

### Step 1: Add All Missing Lore Entries

Copy the template structure and add entries for:
- [ ] Each spell (HEAL, HURT, SLEEP, RADIANT, STOPSPELL, OUTSIDE, RETURN, REPEL, HEALMORE, HURTMORE)
- [ ] Each item usage (HERB, TORCH, FAIRY_WATER, WINGS, FAIRY_FLUTE, GWAELIN'S_LOVE)
- [ ] All movement commands (with proper exit checking)
- [ ] Shop interactions (buy/sell with price checking)
- [ ] Quest progression (all key items and flags)
- [ ] Status effect applications
- [ ] Enemy AI behaviors
- [ ] Special encounters

### Step 2: Test State Parser

Add a DEBUG entry:
```javascript
{
    keywords: ["debug"],
    priority: 5,
    personality: `
[DEBUG DUMP]
Parsed State: ${JSON.stringify(GAME_STATE, null, 2)}
Current HP: ${getCurrentHP()}/${getMaxHP()}
In Combat: ${inCombat()}
Level: ${getLevel()}
Flags: ${getFlags().join(', ')}
    `
}
```

### Step 3: Implement Combat System Completely

Priority order:
1. Basic attack/defend (DONE in v2 template)
2. Spell casting (HEAL, HURT, HURTMORE)
3. Enemy counterattack
4. Status effects (SLEEP, STOPSPELL)
5. Enemy spells
6. Breath attacks
7. Metal Slime flee
8. Victory rewards and level-up

### Step 4: Add All Locations

Full location graph with:
- Tantegel Castle (throne, courtyard, basement)
- Towns (Brecconary, Garinham, Rimuldar, Cantlin)
- Caves (multiple dungeons)
- Overworld zones
- Charlock Castle

### Step 5: Quest Chain

Complete quest progression:
1. Accept quest from King
2. Rescue Princess Gwaelin
3. Return Princess → Get Gwaelin's Love
4. Find Erdrick's Token (swamp)
5. Find Erdrick's Armor (Garinham graveyard)
6. Find Staff of Rain
7. Find Stones of Sunlight
8. Find Silver Harp
9. Create Rainbow Drop
10. Enter Charlock
11. Find Erdrick's Sword
12. Defeat Dragonlord Phase 1
13. Defeat Dragon Phase 2
14. Victory!

## 🎯 Priority Checklist

### High Priority (Game-Breaking if Missing)
- [ ] Combat damage calculations
- [ ] HP/MP tracking and updates
- [ ] Death and resurrection
- [ ] Level-up system
- [ ] EXP and Gold tracking
- [ ] Item purchasing
- [ ] SAVE block always printed

### Medium Priority (Important Features)
- [ ] All spell implementations
- [ ] Enemy spell casting
- [ ] Status effects (SLEEP, STOPSPELL, REPEL)
- [ ] Locked doors and Magic Keys
- [ ] Quest item finding
- [ ] Boss battle special mechanics

### Low Priority (Polish)
- [ ] Gwaelin's Love compass
- [ ] Fairy Flute for Golem
- [ ] Cursed item mechanics
- [ ] NPC dialogue variations
- [ ] Death flavor text

## 📊 Estimated Completion

- **V2 Core (parser + databases):** ✅ Done
- **Combat System:** 30% complete (need spells, status, enemy AI)
- **Movement & Exploration:** 10% complete (need all locations)
- **Quest System:** 20% complete (need item finding logic)
- **Items & Equipment:** 40% complete (need usage logic)
- **System Prompt:** 60% complete (need GUI and parsing sections)

**Total Completion:** ~35%

**To finish:**
- ~50 more lore entries needed
- System prompt updates
- Testing and balancing

## 🚀 Quick Start for Contributors

1. Open `dragonquest_v2.js`
2. Find the `// 🛑🛑🛑 THIS IS A PARTIAL EXAMPLE` comment
3. Add new entries following the template structure
4. Use the helper functions: `getLevel()`, `hasFlag()`, `inCombat()`, etc.
5. Test with DEBUG=1 to see what's firing

**Entry Template:**
```javascript
{
    group: "unique_group_name",  // Prevents duplicates
    keywords: ["trigger", "words"],
    andAny: ["save=value"],  // Requires state check
    'prev.keywords': ["in", "ai", "response"],  // Checks AI's last msg
    priority: 5,  // 1-5, higher = fires first
    triggers: ["tag_to_emit"],  // For chaining
    probability: 1.0,  // 0-1 or "50%"
    personality: `What the AI should say/do`,
    scenario: "Scene description",
    Shifts: [  // Optional variations
        {
            keywords: ["variant"],
            personality: "Specialized response"
        }
    ]
}
```

---

**The foundation is solid. Now we build the game on top of it!** ⚔️🐉
