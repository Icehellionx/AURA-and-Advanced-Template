# Dragon Quest - Final Complete Version

## 📁 File Overview

### `dragonquest_COMPLETE.js` - **USE THIS ONE!** ⭐
**1285 lines** - The complete, working Dragon Quest text adventure

**What's included:**
- ✅ SAVE state parser (reads from `last_messages[1]`)
- ✅ Complete monster database (13 enemies with full stats)
- ✅ Helper functions (`getHP()`, `getLevel()`, `hasFlag()`, etc.)
- ✅ ALL game logic from V1 (commands, combat, quests, shops, etc.)
- ✅ Improved engine with `prev.keywords` and group exclusion
- ✅ Level thresholds (1-21)

### Other Files (Reference Only)

- `dragonquest_text_adventure.js` (1328 lines) - Original V1, complete but lacks parser
- `dragonquest_v2.js` (547 lines) - Proof-of-concept showing V2 features (incomplete)
- `DRAGONQUEST_V2_IMPROVEMENTS.md` - Documentation of what's new in V2

## 🎮 What Works Right Now

### Fully Implemented:
- Game initialization
- STATS command
- SEARCH command
- TALK command (NPCs)
- Movement (GO NORTH/SOUTH/EAST/WEST)
- Random encounters
- Combat (ATTACK, DEFEND, RUN)
- Spell casting (HURT, HURTMORE, HEAL, HEALMORE)
- Item usage (USE HERB)
- Healing spring (Tantegel courtyard)
- Inn resting
- Shops (weapon, armor, item)
- Quest progression (Princess rescue, Erdrick's items, Rainbow Drop)
- Dragonlord encounter (2 phases)
- Death/resurrection
- Level-up system
- Victory condition
- HELP command
- SAVE state display

### New V2 Features:
- **SAVE Parser**: Script actively reads game state from AI's last response
- **Helper Functions**: Use `getLevel()`, `hasFlag("PRINCESS_SAVED")` in entries
- **Enhanced Monsters**: Metal Slime (flees), Magiwyvern (breathFire), Magician (spells)
- **Better Heuristics**: `prev.keywords` to detect AI's previous responses
- **Group Exclusion**: Prevents duplicate entries from same category

## 🚀 Quick Start

1. Load `dragonquest_COMPLETE.js` into your lore book system
2. Use the system prompt from `DRAGONQUEST_SYSTEM_PROMPT.md`
3. Use the first message from `DRAGONQUEST_FIRST_MESSAGE.md`
4. Start playing!

## 🔍 Key Improvements Over V1

### Before (V1):
```javascript
{
    keywords: ["stats"],
    personality: "[Extract LVL from last SAVE]"  // Manual extraction
}
```

### After (COMPLETE):
```javascript
{
    keywords: ["stats"],
    personality: `Level: ${getLevel()}`  // Automatic!
}
```

### State-Aware Logic:
```javascript
// Check if princess is saved
if (hasFlag("PRINCESS_SAVED")) {
    // Different King dialogue
}

// Check combat status
if (inCombat()) {
    // Show combat options
}

// Level-gated content
if (getLevel() >= 17) {
    // Can cast HEALMORE
}
```

## 📊 File Structure

```
Lines 1-67:   SAVE parser + helper functions
Lines 68-94:  Enhanced databases (monsters, levels)
Lines 95-1042: ALL game logic entries (commands, combat, quests, etc.)
Lines 1043-1285: Improved engine (prev.keywords, groups)
```

## ⚡ Performance

- **APPLY_LIMIT**: 25 (higher than V1's 20)
- **WINDOW_DEPTH**: 10 messages
- **Entries**: ~60 lore entries covering all game systems

## 🎯 What's Still Missing (See V2_IMPROVEMENTS.md)

High priority:
- Status effects tracking (SLEEP, STOPSPELL, REPEL duration)
- Enemy spell casting AI
- Locked doors with Magic Keys
- Darkness/RADIANT/TORCH mechanics
- More monster variety (30+ DQ1 enemies documented in V2)

Medium priority:
- Fairy Flute (Golem stopper)
- Gwaelin's Love (compass)
- Cursed items
- Metal Slime flee behavior

## 📝 Version History

- **V1** (dragonquest_text_adventure.js): Original complete game, manual state handling
- **V2** (dragonquest_v2.js): Proof-of-concept with parser, incomplete lore entries
- **COMPLETE** (dragonquest_COMPLETE.js): ✅ THIS FILE - V2 features + all V1 content

## 🆘 Troubleshooting

**Q: Parser not working?**
A: The parser reads from `last_messages[1]`. Make sure your platform supports `context.chat.last_messages` array.

**Q: Stats showing wrong values?**
A: Check that the [SAVE: ...] block was printed in the AI's last response. Parser only works if the block exists.

**Q: Too many/few entries firing?**
A: Adjust `APPLY_LIMIT` (line 21). Default is 25. Increase if responses seem incomplete.

**Q: Want to add more monsters?**
A: See `dragonquest_v2.js` lines 84-142 for full 30+ enemy database. Copy to COMPLETE file.

## 🎊 Credits

- **Original Game**: Dragon Quest © 1986 Chunsoft/Enix
- **Lore System**: Advanced Lore Book System v14 by Icehellionx
- **Text Adventure**: Created as educational demonstration

---

**Ready to adventure? Load dragonquest_COMPLETE.js and restore peace to Alefgard!** ⚔️🐉
