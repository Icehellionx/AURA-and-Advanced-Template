# 🐉 Dragon Quest 1 Text Adventure

A complete remake of Dragon Quest 1 as a text adventure, built on the Advanced Lore Book System v14.

## 🎯 How It Works

Since the only persistent variable is the **turn count**, ALL game state is encoded into a **SAVE block** that's printed in every response:

```
[SAVE: HP=20/20|MP=5/10|LVL=3|GOLD=120|EXP=45|LOC=TANTEGEL_CASTLE|
 INV=HERB,TORCH|EQP_W=COPPER_SWORD|EQP_A=LEATHER_ARMOR|EQP_S=|KEYS=0|
 FLAGS=PRINCESS_SAVED,SILVER_HARP]
```

The lore book system **reads this save block from the chat history** and uses it to determine the current game state!

## 🎮 Game Features

### ⚔️ Complete RPG Systems
- **Turn-based combat** with Attack, Defend, Cast Spell, Run
- **Level-up system** (1-30) with stat growth
- **Magic spells** (Heal, Hurt, Sleep, Return, etc.)
- **Equipment system** (weapons, armor, shields)
- **Inventory management**
- **Gold & shop system**

### 🗺️ World Exploration
- **Tantegel Castle** - King Lorik's throne room, healing spring
- **Towns**: Brecconary, Garinham, Rimuldar, Cantlin
- **Overworld** with random encounters
- **Dungeons & caves**
- **Charlock Castle** - Final dungeon

### 🐉 Monsters
From **Slimes** to the **Dragonlord**!
- Early: Slime, Red Slime, Drakee, Ghost
- Mid: Magician, Scorpion, Druin
- Late: Knight, Demon Knight, Magiwyvern
- Special: Metal Slime (rare, high EXP!)
- Boss: Dragonlord (2 phases!)

### 🎯 Quest System
1. Talk to King Lorik and accept the quest
2. Rescue Princess Gwaelin from a cave
3. Find Erdrick's legendary equipment
   - Erdrick's Token (in swamp)
   - Erdrick's Armor (Garinham graveyard)
   - Erdrick's Sword (Charlock Castle)
4. Gather sacred items for Rainbow Drop
   - Silver Harp
   - Staff of Rain
   - Stones of Sunlight
5. Cross Rainbow Bridge to Charlock
6. Defeat the Dragonlord!
7. Restore the Ball of Light

## 🕹️ Commands

### Movement
- `GO NORTH/SOUTH/EAST/WEST` - Move in direction
- `SEARCH` - Examine area for items
- `TAKE` - Pick up items

### Combat
- `ATTACK` - Strike with weapon
- `DEFEND` - Raise shield (reduces damage)
- `CAST [spell]` - Use magic
- `RUN` - Flee from battle

### Interaction
- `TALK` - Speak with NPCs
- `DOOR` - Use Magic Key

### Items & Equipment
- `USE [item]` - Use item (Herb, Torch, etc.)
- `EQUIP [item]` - Change equipment
- `BUY [item]` - Purchase at shops
- `SELL [item]` - Sell items

### Magic Spells
- `CAST HEAL` - Restore HP (MP:4, Level 3+)
- `CAST HURT` - Attack spell (MP:2, Level 4+)
- `CAST SLEEP` - Put enemy to sleep (MP:2, Level 7+)
- `CAST RADIANT` - Light in darkness (MP:3, Level 9+)
- `CAST OUTSIDE` - Escape dungeon (MP:6, Level 12+)
- `CAST RETURN` - Warp to Tantegel (MP:8, Level 13+)
- `CAST HEALMORE` - Full heal (MP:10, Level 17+)
- `CAST HURTMORE` - Strong attack (MP:5, Level 19+)

### Status
- `STATS` - View character sheet
- `SAVE` - Display full save state
- `HELP` - Show command list

## 🎲 Game Mechanics

### Combat System
```
Player Damage = (STR + Weapon ATK) / 2 + Random(0-4) - Enemy DEF / 2
Enemy Damage = (Enemy ATK - Player DEF) / 2 + Random(0-4)
```

### Level Up Thresholds
| Level | EXP Needed | Level | EXP Needed |
|-------|-----------|-------|-----------|
| 2     | 7         | 12    | 4000      |
| 3     | 23        | 13    | 5500      |
| 4     | 47        | 14    | 7500      |
| 5     | 110       | 15    | 10000     |
| 10    | 2000      | 20    | 26500     |
| 11    | 2900      | 30    | 62000     |

### Death System
When HP reaches 0:
- Revive at Tantegel Castle
- Lose 50% of gold
- HP/MP restored to 50%

### Shops

**Weapon Shop:**
- Bamboo Pole: 10g (ATK +2)
- Club: 60g (ATK +4)
- Copper Sword: 180g (ATK +10)
- Hand Axe: 560g (ATK +15)
- Broad Sword: 1500g (ATK +20)
- Flame Sword: 9800g (ATK +28)

**Armor Shop:**
- Clothes: 20g (DEF +2)
- Leather Armor: 70g (DEF +4)
- Chain Mail: 300g (DEF +10)
- Half Plate: 1000g (DEF +16)
- Full Plate: 3000g (DEF +24)
- Magic Armor: 7700g (DEF +24, curse protection)

**Item Shop:**
- Herb: 24g (Heal ~30 HP)
- Torch: 8g (Light in darkness)
- Fairy Water: 38g (Repel monsters)
- Wings: 70g (Escape to castle)
- Magic Key: 85g (Open locked doors)

## 🏰 Key Locations

1. **Tantegel Castle** - Your home base
   - Throne Room (King Lorik)
   - Courtyard (Healing Spring - free full restore!)
   - Basement (storage)

2. **Brecconary** - First town (west of castle)
   - Weapon Shop, Armor Shop, Item Shop, Inn

3. **Garinham** - Eastern town
   - Graveyard (Erdrick's Armor location)

4. **Rimuldar** - Southern town
   - Advanced equipment

5. **Cantlin** - Mountain town
   - Best equipment before final dungeon

6. **Charlock Castle** - Dragonlord's fortress
   - Rainbow Drop required to enter
   - Erdrick's Sword hidden inside
   - Final boss battle

## 🎯 Winning Strategy

### Early Game (Levels 1-5)
1. Talk to King Lorik, accept quest
2. Grind Slimes and Drakees near castle
3. Buy Copper Sword (180g) and Leather Armor (70g)
4. Save up for Chain Mail (300g)
5. Rescue Princess Gwaelin (level 7+)

### Mid Game (Levels 6-12)
1. Explore and find Erdrick's Token in swamp
2. Get Erdrick's Armor from Garinham graveyard
3. Grind for Broad Sword (1500g)
4. Learn OUTSIDE and RETURN spells
5. Collect Silver Harp, Staff of Rain, Stones of Sunlight

### Late Game (Levels 13-20)
1. Buy Flame Sword (9800g) or better armor
2. Create Rainbow Drop from 3 sacred items
3. Enter Charlock Castle
4. Find Erdrick's Sword (ATK +40!)
5. Level to 18-20 recommended

### Final Battle (Level 18+)
1. Full HP/MP before Dragonlord
2. **Phase 1:** Dragonlord (HP: 100)
   - Use HURT/HURTMORE and physical attacks
   - HEAL when HP < 40%
3. **Phase 2:** Dragon Form (HP: 165)
   - Breath attacks deal heavy damage
   - Keep HP above 60
   - HURTMORE is most efficient
   - Be patient, heal often

**Recommended Final Stats:**
- Level: 18-20
- HP: 100+
- MP: 50+
- Equipment: Erdrick's Sword + Erdrick's Armor + Silver Shield

## 🛠️ Technical Details

### Save Format Specification
```
[SAVE: KEY=VALUE|KEY=VALUE|...]
```

**Keys:**
- `HP` - Current/Max HP (e.g., "35/50")
- `MP` - Current/Max MP
- `LVL` - Character level
- `GOLD` - Gold pieces
- `EXP` - Experience points
- `STR` - Strength stat
- `AGI` - Agility stat
- `LOC` - Current location code
- `INV` - Comma-separated items
- `EQP_W` - Equipped weapon
- `EQP_A` - Equipped armor
- `EQP_S` - Equipped shield
- `KEYS` - Number of Magic Keys
- `FLAGS` - Comma-separated quest flags
- `COMBAT` - Current combat state (if in battle)

### How the Lore System Reads State

The script uses **keyword matching** on the chat history:
- Detects `[SAVE: ...]` blocks in recent messages
- Extracts stats using keywords like `"hp="`, `"lvl="`, `"loc=tantegel"`
- Uses `andAny` gates to check multiple conditions
- Tags track quest progress and trigger story events

### Probability & Random Events
- **Random encounters:** 30% chance per overworld movement
- **Metal Slime:** Very rare spawn (configured in monster selection)
- **Item finds:** Some locations have probability-based discovery
- **Shop RNG:** Some items may have stock variations

## 🎨 Example Play Session

```
Player: "I accept the quest!"

[Game initializes with Level 1 hero in throne room]

Player: "go south"
→ Moved to Castle Gate

Player: "go south"
→ Entered Overworld
→ Random encounter! A Slime appears!

Player: "attack"
→ Hero deals 6 damage! Slime defeated!
→ Gained 1 EXP, 2 Gold

Player: "go west"
→ Arrived at Brecconary

Player: "weapon shop"
→ Shows available weapons

Player: "buy copper sword"
→ -180 Gold, equipped Copper Sword (ATK +10)

Player: "cast heal"
→ HP restored by 23! MP -4

Player: "stats"
→ Displays full character status
```

## 🐛 Known Limitations

1. **No actual randomness** - The script can't truly generate random numbers, so combat and encounters are simulated based on probability triggers
2. **State persistence** - Relies entirely on the SAVE block being present in chat history
3. **Complex calculations** - The AI must perform all stat calculations, which may have minor inconsistencies
4. **No true graphics** - Pure text-based (but that's the point!)

## 🚀 Future Enhancements

Potential additions:
- [ ] More detailed dungeon maps
- [ ] Additional side quests
- [ ] Hidden items and secret areas
- [ ] Bestiary tracking
- [ ] Speedrun timer mode
- [ ] New Game+ with carry-over stats

## 📝 Credits

- **Original Game:** Dragon Quest (Dragon Warrior) by Chunsoft/Enix (1986)
- **Lore System:** Advanced Lore Book System v14 by Icehellionx
- **Adaptation:** Text adventure conversion for turn-based persistence

---

⚔️ **May your journey through Alefgard be legendary!** 🐉
