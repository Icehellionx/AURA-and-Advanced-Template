# 🐉 Dragon Quest 1 Text Adventure - Complete Setup Guide

This guide will help you set up and run the Dragon Quest 1 text adventure using the provided files.

---

## 📦 What's Included

| File | Purpose |
|------|---------|
| `dragonquest_text_adventure.js` | Lore book system script (Advanced Lore Book v14 format) |
| `DRAGONQUEST_SYSTEM_PROMPT.md` | System prompt / character card personality |
| `DRAGONQUEST_FIRST_MESSAGE.md` | Initial greeting message to start the game |
| `DRAGONQUEST_README.md` | Full game documentation and mechanics |
| `DRAGONQUEST_SETUP_GUIDE.md` | This file - setup instructions |

---

## 🎯 Setup Methods

Choose the method that matches your platform:

### Method 1: **Lore Book System (Recommended)**

**Best for:** SillyTavern with Advanced Lore Book support

1. **Create a new character card:**
   - Name: "Dragon Quest Narrator"
   - Description: "Epic fantasy narrator for Dragon Quest 1"

2. **Set up the lore book:**
   - Open your lore book manager
   - Copy the entire contents of `dragonquest_text_adventure.js`
   - Paste into your lore book script field
   - Set WINDOW_DEPTH to at least 10 (to detect SAVE blocks)

3. **Configure the character:**
   - **Personality:** Brief description like "You narrate a Dragon Quest adventure"
   - **Scenario:** "A text-based RPG adventure in the world of Alefgard"
   - **First Message:** Copy from `DRAGONQUEST_FIRST_MESSAGE.md`

4. **Start chatting!**
   - The lore book will handle all game mechanics automatically
   - Just type commands like "ATTACK", "GO NORTH", "CAST HEAL"

**Pros:** Fully automated, cleanest experience
**Cons:** Requires lore book system support

---

### Method 2: **System Prompt Only (Universal)**

**Best for:** Any LLM (Claude, ChatGPT, Gemini, local models)

1. **Copy the system prompt:**
   - Open `DRAGONQUEST_SYSTEM_PROMPT.md`
   - Copy the entire contents

2. **Create a new conversation:**
   - Paste the system prompt as the AI's instructions/system message
   - If using Character Cards: paste into "Personality" field
   - If using raw API: use as `system` message

3. **Start the game:**
   - Either have the AI send the first message from `DRAGONQUEST_FIRST_MESSAGE.md`
   - Or paste it yourself as the AI's first response

4. **Play:**
   - The AI will manually track game state using [SAVE: ...] blocks
   - Give commands, and the AI narrates results

**Pros:** Works anywhere, no special setup
**Cons:** AI must manually handle all mechanics (may be less consistent)

---

### Method 3: **Hybrid Approach**

**Best for:** Maximum reliability

1. **Use the system prompt** from Method 2 for overall guidance
2. **Add the lore book script** from Method 1 for automation
3. **Result:** System prompt guides tone and rules, lore book handles mechanics

---

## 🎮 How to Play

### Starting the Game

1. The AI sends the first message (throne room scene)
2. You see King Lorik asking you to accept the quest
3. A [SAVE: ...] block shows your starting stats

### Giving Commands

**Simple text commands work best:**

```
"I accept the quest!"
"go south"
"attack"
"cast heal"
"talk to the king"
"buy copper sword"
"stats"
```

**Commands are case-insensitive and flexible:**
- "ATTACK" = "attack" = "Attack the monster" = "I attack"
- "GO NORTH" = "north" = "walk north" = "move north"

### Understanding Responses

Every AI response should include:

1. **Narrative** - What happens in the story
2. **Game mechanics** - Damage dealt, items gained, etc.
3. **[SAVE: ...] block** - Current game state (CRITICAL!)
4. **Prompt** - "What will you do?"

**Example:**
```
The hero walks south to the overworld.

🌍 Alefgard Overworld 🌍

⚔️ A wild Slime appears! ⚔️
Slime: 3/3 HP

[SAVE: HP=15/15|MP=0/0|LVL=1|GOLD=120|EXP=0|STR=4|AGI=4|
LOC=OVERWORLD|INV=|EQP_W=BAMBOO_POLE|EQP_A=CLOTHES|EQP_S=|
KEYS=0|FLAGS=GAME_START|COMBAT=SLIME_HP3]

What will you do?
```

### Reading the SAVE Block

```
[SAVE: HP=15/15|MP=0/0|LVL=1|GOLD=120|EXP=0|...]
        ↓     ↓    ↓      ↓      ↓
     Current/Max  Level  Gold   EXP
```

**Key fields:**
- `HP=15/15` - Current/Max hit points
- `MP=0/0` - Current/Max magic points
- `LVL=1` - Character level
- `GOLD=120` - Gold pieces
- `EXP=0` - Experience points
- `LOC=TANTEGEL_THRONE` - Current location
- `INV=HERB,TORCH` - Inventory items (comma-separated)
- `EQP_W=COPPER_SWORD` - Equipped weapon
- `EQP_A=CLOTHES` - Equipped armor
- `EQP_S=` - Equipped shield (empty = none)
- `KEYS=0` - Number of magic keys
- `FLAGS=GAME_START` - Quest flags (comma-separated)
- `COMBAT=SLIME_HP3` - Combat state (if in battle)

---

## 🗺️ Quick Start Walkthrough

### First 10 Minutes:

1. **Start:** Accept King's quest
   ```
   "I accept!"
   ```

2. **Talk to learn more:**
   ```
   "talk"
   ```

3. **Check your stats:**
   ```
   "stats"
   ```

4. **Explore the castle:**
   ```
   "go north"
   "search"
   ```

5. **Find the healing spring:**
   ```
   "go east"
   "use spring"
   ```
   💡 **TIP:** Free full heal! Come back anytime.

6. **Leave the castle:**
   ```
   "go south"
   "go south"
   ```

7. **Enter the town:**
   ```
   "go west"
   ```

8. **Visit shops:**
   ```
   "weapon shop"
   "buy copper sword"
   ```

9. **Grind for levels:**
   ```
   "go east"
   "go south"
   [Fight slimes and drakees]
   "attack"
   ```

10. **Rest at inn when low HP:**
    ```
    "go north"
    "go west"
    "inn"
    ```

### First Hour Goals:

- [ ] Accept the quest from King Lorik
- [ ] Explore Tantegel Castle (find the healing spring!)
- [ ] Visit Brecconary (first town)
- [ ] Buy Copper Sword (180g)
- [ ] Grind to Level 3 (learn HEAL spell)
- [ ] Buy Leather Armor (70g)
- [ ] Save up for Chain Mail (300g)

---

## ⚠️ Common Issues & Solutions

### Issue: No [SAVE: ...] block appearing

**Solution:**
- Check that system prompt is loaded correctly
- Remind the AI: "Please include the [SAVE: ...] block in every response"
- If using lore book: increase WINDOW_DEPTH to 10-15

### Issue: Stats not updating correctly

**Solution:**
- The AI must READ the last SAVE block before updating
- Remind it: "Check the previous SAVE block and update it"
- Start a new conversation if state becomes corrupted

### Issue: AI forgets game rules

**Solution:**
- Re-paste the system prompt
- Reference the README: "Check the combat damage formula"
- Give specific reminders: "Remember, I'm level 3 so I should know HEAL"

### Issue: Combat feels unbalanced

**Solution:**
- Early game is tough! Grind near the castle first
- Use the healing spring (free!) instead of herbs
- Run from tough enemies until higher level
- Buy better equipment ASAP

### Issue: AI makes up locations/items

**Solution:**
- Remind it to stick to the official game content
- Reference the README for canon locations
- Gently correct: "Actually, that location isn't in Dragon Quest 1"

---

## 🎯 Pro Tips

### For Players:

1. **Abuse the healing spring** - It's free and unlimited!
2. **Grind early** - Get to Level 3 ASAP for HEAL spell
3. **Buy Copper Sword first** - Huge damage upgrade
4. **Save for Chain Mail** - Better than multiple weak purchases
5. **Check STATS often** - Know when you're close to leveling up
6. **Magic Keys are precious** - Don't waste them
7. **Princess rescue = 1000 EXP** - Do it around level 7-8
8. **Metal Slimes = 115 EXP** - Drop everything to kill them!

### For Game Masters (AI):

1. **ALWAYS print [SAVE: ...] blocks** - No exceptions!
2. **Read before write** - Extract last SAVE before updating
3. **Show your work** - Players want to see damage calculations
4. **Be consistent** - Don't change stat formulas mid-game
5. **Celebrate milestones** - Level ups, new equipment, victories
6. **Classic DQ tone** - Use "thou/thy/dost" language
7. **Fair randomness** - Don't be too cruel or too generous

---

## 🔧 Customization

### Easy Tweaks (in system prompt):

**Make it easier:**
- Increase starting GOLD to 500
- Increase HP/MP gains per level
- Reduce shop prices by 50%
- Start with Copper Sword equipped

**Make it harder:**
- Reduce starting GOLD to 50
- Increase monster damage
- Make healing spring cost 10 gold
- Start at Level 0

**Speed up progression:**
- Double all EXP gains
- Halve level-up thresholds
- Start with HEAL spell known

### Advanced Mods (in lore book script):

- Add new locations
- Create custom monsters
- Invent side quests
- Add new equipment
- Create multiple endings

---

## 📊 Tracking Progress

### Suggested Milestones:

- [ ] Level 3 - Learn HEAL
- [ ] Level 5 - Can handle Ghosts
- [ ] Level 7 - Ready for Princess rescue
- [ ] Level 10 - Learn STOPSPELL
- [ ] Level 12 - Learn OUTSIDE
- [ ] Level 13 - Learn RETURN
- [ ] Level 15 - Can explore far lands
- [ ] Level 18 - Ready for Charlock Castle
- [ ] Level 20 - Can challenge Dragonlord

### Key Items Checklist:

- [ ] Copper Sword
- [ ] Chain Mail
- [ ] Magic Keys (need several)
- [ ] Erdrick's Token
- [ ] Erdrick's Armor
- [ ] Silver Harp
- [ ] Staff of Rain
- [ ] Stones of Sunlight
- [ ] Rainbow Drop
- [ ] Erdrick's Sword

---

## 🎊 Victory Conditions

You win when you:
1. Defeat Dragonlord Phase 1 (HP: 100)
2. Defeat Dragon Phase 2 (HP: 165)
3. Retrieve the Ball of Light
4. Return to King Lorik

**Recommended final stats:**
- Level 18-20
- HP 100+
- MP 50+
- Erdrick's Sword + Erdrick's Armor

---

## 🆘 Getting Help

If something breaks or you're stuck:

1. **Check the README** - Full mechanics documentation
2. **Ask the AI** - "Can you explain how X works?"
3. **Type HELP** - In-game command reference
4. **Start fresh** - Sometimes easiest to begin a new game
5. **Modify system prompt** - Add clarifications if AI is confused

---

## 📜 Credits & License

- **Original Game:** Dragon Quest © 1986 Chunsoft/Enix
- **Lore System:** Advanced Lore Book System v14 by Icehellionx
- **Text Adventure Adaptation:** Created for turn-based persistence demo
- **License:** Fan project, educational/non-commercial use

---

**Now venture forth, brave hero, and may your journey be legendary!** ⚔️🐉✨

*For the complete game guide, see DRAGONQUEST_README.md*
*For technical details, see dragonquest_text_adventure.js*
