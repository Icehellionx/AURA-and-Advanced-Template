/* ============================================================================
   INTENT LORE BOOK SYSTEM v15
   Author: Icehellionx
   //#region HEADER
   ==========================================================================
   This script provides a powerful, multi-layered lorebook system. It includes:
   1. A main lorebook (`dynamicLore`) for keyword, tag, and time-based text injection.
   2. An integrated intent detection system (EIDOS) to gate entries by user intent.
   3. A dynamic relationship system to inject lore based on character interactions.

   --- AUTHOR CHEAT-SHEET (for `dynamicLore` entries) ---

   Core Properties:
     - keywords: User words/phrases. Supports "word*", and 'char.entityName' expansion.
     - tag: Internal label for this entry (e.g., "base_open"). Not matched against text.
     - triggers: List of tags to emit when this entry fires.
     - personality / scenario: The text to inject.

   Text Gates (checks against recent chat):
     - andAny / requireAny: Fires if ANY word in the list is present.
     - andAll / requireAll: Fires if ALL words in the list are present.
     - notAny / requireNone / block: Blocks if ANY word in the list is present.
     - notAll: Blocks only if ALL words in the list are present.

   Intent Gates (requires EIDOS models):
     - andAnyIntent: Fires if ANY listed intent is active.
     - andAllIntent: Fires if ALL listed intents are active.
     - notAnyIntent: Blocks if ANY listed intent is active.
     - notAllIntent: Blocks if ALL listed intents are active.

   Tag Gates (checks against other triggered entries):
     - andAnyTags, andAllTags, notAnyTags, notAllTags

   Special Gates & Modifiers:
     - 'prev.': Prefix a text gate (e.g., 'prev.keywords') to check the PREVIOUS message only.
     - 'char.entityName': A special keyword that expands to an entity's name and all its aliases.
     - minMessages / maxMessages: Gates for message count.
     - nameBlock: ["name"]: Blocks if the active character's name is in the list.
     - probability: 0.0 to 1.0 (or "0%" to "100%") chance for an entry to fire.
     - group: "group_name": Makes entries in the same group mutually exclusive.

   Branching Logic:
     - Shifts: Optional sub-entries that are evaluated only if the parent entry fires.

   --- DYNAMIC RELATIONSHIPS ---
   Defined in `ENTITY_DB` and `RELATIONSHIP_DB`. The engine automatically detects
   active characters (including pronoun resolution) and checks `RELATIONSHIP_DB`
   triggers. If a pair of characters and the required tags are all active in
   the current turn, the specified `injection` text is added.
   ========================================================================== */


/* ============================================================================
   [SECTION] GLOBAL KNOBS
   SAFE TO EDIT: Yes
   ========================================================================== */
//#region GLOBAL_KNOBS
let DEBUG = 0;     // 1 -> emit [DBG] lines inline in personality
let APPLY_LIMIT = 6;     // cap applied entries per turn; higher priorities win

/* ============================================================================
   [SECTION] DYNAMIC RELATIONSHIP
   SAFE TO EDIT: Yes
   ========================================================================== */
//#region DYNAMIC_RELATIONSHIP
// 1. ENTITY DEFINITIONS (Who exists in the story?)
// Keys should be lower case for matching.
const ENTITY_DB = {
    "jamie": {
        gender: "N", // Neutral gender, can be he/she/they
        aliases: ["manager"],
        lore: [
            {
                group: "jamie_base",
                keywords: ["char.jamie"],
                personality: "Jamie is the store manager, focused on operations and efficiency."
            }
        ]
    },
    "chloe": {
        gender: "F",
        aliases: ["chlo"],
        lore: [
            {
                group: "chloe_base",
                keywords: ["char.chloe"],
                personality: "Chloe is a bubbly, cheerful regular who knows all the staff by name."
            }
        ]
    },
    "leo": {
        gender: "M",
        aliases: ["artist", "sketching guy"],
        lore: [
            {
                group: "leo_base",
                keywords: ["char.leo"],
                personality: "Leo is a quiet art student who is often found sketching in the corner booth."
            }
        ]
    },
    "avery": {
        gender: "N",
        aliases: ["aves", "avie", "avi", "avee"]
        // Base lore for Avery is provided in the main DYNAMIC_LORE section (L11).
    }
};

// 2. RELATIONSHIP TRIGGERS (When X and Y interact with certain tags)
// This allows the model to know "When Marcus and Elara are pining, inject history."
const RELATIONSHIP_DB = [
    {
        // Example: A friendly rivalry between the manager and a regular.
        // This will trigger if both "jamie" and "chloe" are detected in the recent chat,
        // AND if lore entries have emitted both the "banter" and "teasing" tags.
        pair: ["jamie", "chloe"],
        requireTags: ["banter", "teasing"],
        injection: "[RIVALRY] Jamie and Chloe have a friendly rivalry, often teasing each other about who makes better coffee.",
        group: "rivalry_jamie_chloe"
    },
    {
        // Example: An artistic inspiration.
        // This will trigger if "leo" and "avery" are detected, and the "art" and "inspiration" tags are active.
        pair: ["leo", "avery"],
        requireTags: ["art", "inspiration"],
        injection: "[INSPIRATION] Leo finds Avery's vibrant energy inspiring for his art, often sketching them from his corner table.",
        group: "inspiration_leo_avery"
    }
];

// 3. PRONOUN MAP (Helps resolve who is being talked about)
const PRONOUN_MAP = {
  "he": "M", "him": "M", "his": "M",
  "she": "F", "her": "F", "hers": "F",
  "it": "N", "they": "N"
};



/* ============================================================================
   [SECTION] AUTHOR ENTRIES
   SAFE TO EDIT: Yes
   ========================================================================== */
//#region AUTHOR_ENTRIES_LOREBOOK
const DYNAMIC_LORE = [
  // 🟢🟢🟢 SAFE TO EDIT BELOW THIS LINE 🟢🟢🟢

  /* L0 — Always-on demo
     What it does: Fires every turn because there are no keywords, no time gates, and no tag.
     Why use: Bootstrap a baseline voice or a harmless always-on nudge.
  */
  { personality: " This entry will always fire." },

  /* L1 — Basics: greeting keywords
     New tools: simple keyword list.
     Why use: Straightforward mapping from "hello/hi/hey" to a friendly behavior.
  */
  {
    keywords: ["hello", "hi", "hey"],
    personality: " {{char}} is friendly and professional with customers and should say hello back."
  },

  /* L2a — Time-of-day greetings, with exclusion and trigger emission
     New tools: priority bump (4), requireNone exclusion, triggers emission.
     What it does: If welcome/good morning/etc appears and it's NOT a refund/complaint, greet and emit base_greeting.
     Why use: Fan-out pattern—one keyword entry activates a cleaner follow-up via a tag.
  */
  {
    keywords: ["welcome", "good morning", "good afternoon", "good evening"],
    priority: 4,
    triggers: ["base_greeting"],
    requireNone: ["refund", "complaint"],
    personality: " {{char}} should greet for the time of day and should ask how they can help."
  },

  /* L2b — Baseline greeting (trigger-only)
     New tools: tag entry, higher priority (5).
     What it does: Fires only if 'base_greeting' tag is present.
     Why use: Keep layered structure tidy—separate core greeting confirmation from raw keyword hit.
  */
  {
    tag: "base_greeting",
    priority: 5,
    personality: " {{char}} should confirm the customer's name if it was given and should restate the greeting clearly."
  },

  /* L2c — Courtesy echo: always-on gated by politeness signals
     New tools: andAny (alias of requireAny), triggers emission.
     What it does: If courtesy terms appear anywhere, mirror a polite tone and also emit base_greeting for cohesion.
     Why use: Gentle tonal control that chains into your greeting stack without new keywords.
  */
  {
    andAny: ["please", "thank", "thanks"],
    priority: 3,
    triggers: ["base_greeting"],
    personality: " {{char}} acknowledges the courtesy and mirrors the polite tone."
  },

  /* L3a — Espresso request with block and requires
     New tools: block (exclusion), andAny, triggers fan-out, explicit scenario.
     What it does: For "espresso" and any of ["dial","grind"], unless blocked by "decaf-only", emit 'base_espresso'
                   and output concrete personality+scenario steps.
     Why use: Demonstrates negative gating and skill instruction (dial-in details).
  */
  {
    keywords: ["espresso"],
    priority: 4,
    block: ["decaf-only"],
    triggers: ["base_espresso"],
    andAny: ["dial", "grind"],
    personality: " {{char}} should state the target shot time and the grind adjustment before pulling the shot.",
    scenario: " {{char}} times the shot to 25-30 seconds and states the exact grind change used."
  },

  /* L3b — Espresso baseline (trigger-only)
     What it does: Ensures order clarifications are surfaced once 'base_espresso' is set.
     Why use: Centralizes the common preflight questions for all espresso variants.
  */
  {
    tag: "base_espresso",
    priority: 5,
    personality: " {{char}} should confirm single or double, desired volume or ratio, and for-here or to-go before preparing the shot."
  },

  /* L4a — Latte art with probability and nested requires
     New tools: probability "40%", requires.any + requires.none, triggers.
     What it does: If "latte art" or "art", and we have art/heart/design cues, and not in a rush,
                   then sometimes (40%) propose art and emit base_latte_art.
     Why use: Teaches controlled randomness and queue-aware behavior.
  */
  {
    keywords: ["latte art", "art"],
    priority: 4,
    probability: "40%",
    triggers: ["base_latte_art"],
    requires: { any: ["art", "heart", "design"], none: ["rush", "busy"] },
    personality: " {{char}} should check the queue length and should offer a simple heart if the line is short; otherwise {{char}} should explain that speed takes priority."
  },

  /* L4b — Base latte art (trigger-only)
     What it does: Standardizes pre-art confirmations (cup size, milk).
     Why use: Keeps your latte art flow consistent and centrally adjustable.
  */
  {
    tag: "base_latte_art",
    priority: 5,
    personality: " {{char}} should confirm cup size and milk choice before attempting latte art."
  },

  /* L5a — Opening routine with time gating + exclusion
     New tools: minMessages/maxMessages, notAny.
     What it does: Only in the first 3 messages (0..3), if opening cues appear and not at night,
                   emit base_open and list initial tasks.
     Why use: Scenario-appropriate pacing—front-load opening steps early in a chat session.
  */
  {
    keywords: ["opening", "open"],
    minMessages: 0, maxMessages: 3,
    priority: 4,
    triggers: ["base_open"],
    notAny: ["night"],
    personality: " {{char}} should list the first three opening tasks they perform."
  },

  /* L5b — Base opening (trigger-only)
     What it does: A fixed ordered checklist for consistency during open.
     Why use: Enforces a canonical order of steps separate from detection logic.
  */
  {
    tag: "base_open",
    priority: 5,
    personality: " {{char}} should calibrate the grinder, flush the group heads, and restock cups in that order."
  },

  /* L6a — Closing routine; requires(clean) and suffix wildcard
     New tools: suffix wildcard "clos*", minMessages gate for later chat, andAll.
     What it does: After at least 4 messages, if closing cues and "clean" are present, emit base_close and summarize.
     Why use: Late-session operational wrap-up with explicit cleanliness requirement.
  */
  {
    keywords: ["closing", "clos*"],
    minMessages: 4,
    priority: 4,
    triggers: ["base_close"],
    andAll: ["clean"],
    personality: " {{char}} should summarize how they clean and how they log at the end of the day."
  },

  /* L6b — Base closing (trigger-only)
     What it does: Standard close checklist.
     Why use: Codifies the close routine that other entries can build on.
  */
  {
    tag: "base_close",
    priority: 5,
    personality: " {{char}} should purge the steam wands, clean the drip trays, and record wastage before locking up."
  },

  /* L7a — Inventory with multiple triggers and `requires`
     New tools: multiple triggers in one entry; requires.any + requires.none bundle.
     What it does: When stock/inventory discussed, emit both 'base_inventory' and 'order_supplies';
                   summarize levels and whether reorder is needed.
     Why use: Forks into two coordinated flows: assessing stock then placing orders.
  */
  {
    keywords: ["inventory", "stock"],
    priority: 4,
    triggers: ["base_inventory", "order_supplies"],
    requires: { any: ["stock", "inventory"], none: ["audit-only"] },
    personality: " {{char}} should state current bean and milk levels and should say whether a reorder is needed."
  },

  /* L7b — Base inventory (triggered)
     What it does: Prompts a check and heuristic planning for tomorrow.
     Why use: Keeps the inventory conversation concrete (logs, estimates, flags).
  */
  {
    tag: "base_inventory",
    priority: 5,
    personality: " {{char}} should check the log, estimate tomorrow's usage, and flag low items."
  },

  /* L7c — Order supplies (triggered)
     What it does: Converts assessment into explicit quantities and an action (PO).
     Why use: Ensures conversations end with a clear operational decision.
  */
  {
    tag: "order_supplies",
    priority: 4,
    personality: " {{char}} should specify exact quantities for beans and milk and should submit the purchase order."
  },

  /* L8a — Milk steaming with `Shifts` (branching refinements)
     New tools: Shifts array (child entries), per-shift probability, per-shift gates including nameBlock, block, and andAny.
     What it does: A base milk steaming behavior emits 'base_milk' and sets default technique outputs,
                   while Shifts refine based on drink type and constraints.
     Why use: Structured specialization—shared base plus targeted adjustments without duplicating the base rule.
  */
  {
    keywords: ["milk", "steam"],
    priority: 4,
    triggers: ["base_milk"],
    personality: " {{char}} should state the target texture based on the requested drink and should monitor milk temperature.",
    scenario: " {{char}} sets the pitcher angle, finds a whirlpool, and stops at the correct temperature.",
    Shifts: [
      /* Shift 1 — Cappuccino (always if matched)
         New tools: shift with its own keywords and probability.
         Why use: Guarantees classic cappuccino foam profile when requested.
      */
      {
        keywords: ["cappuccino"],
        probability: 1.0,
        personality: " {{char}} should create a drier foam suitable for a classic cappuccino.",
        scenario: " {{char}} keeps the foam airy and maintains a stable cap."
      },
      /* Shift 2 — Latte (subsampled, avoids rush/busy)
         New tools: probability 0.7, notAny exclusion inside a shift.
         Why use: Offers microfoam and art if pace allows; defers when busy.
      */
      {
        keywords: ["latte"],
        probability: 0.7,
        notAny: ["rush", "busy"],
        personality: " {{char}} should create smooth microfoam suitable for a latte.",
        scenario: " {{char}} aims for a glossy texture that allows simple latte art."
      },
      /* Shift 3 — Non-dairy handling with block and nameBlock
         New tools: block ("sold out"), nameBlock (e.g., prevent cameo self-mentions from altering flow),
                    andAny to catch non-dairy signals.
         Why use: Precise constraints on alternative milks and a safe temperature tweak.
      */
      {
        keywords: ["oat", "almond"],
        block: ["sold out"],
        nameBlock: ["jamie"],
        andAny: ["oat", "almond", "non-dairy"],
        personality: " {{char}} should reduce the final temperature slightly to prevent splitting for non-dairy milk.",
        scenario: " {{char}} keeps the pitcher a few degrees cooler to avoid separation."
      }
    ]
  },

  /* L8b — Base milk (trigger-only)
     What it does: Establishes the milk choice confirmation and adjusts approach accordingly.
     Why use: Keeps milk handling consistent before any specific shift overrides.
  */
  {
    tag: "base_milk",
    priority: 5,
    personality: " {{char}} should confirm dairy or non-dairy milk and should adjust the steaming approach accordingly."
  },

  /* L9a — Operations cameo with `char.` expansion
     New tools: `char.entityName` keyword, nameBlock to prevent self-referential loops.
     What it does: If the user mentions "jamie" or "manager" (which `char.jamie` expands to),
                   and the active character is 'jamie' (blocked by nameBlock), this entry is skipped.
                   and not off-duty, emit base_ops and assign roles.
     Why use: Demonstrates using entity aliases easily and avoiding awkward self-cameos.
  */
  {
    keywords: ["char.jamie"],
    nameBlock: ["jamie"],
    priority: 4,
    triggers: ["base_ops"],
    notAny: ["off-duty"],
    personality: " {{char}} should assign roles during peak hours and should confirm the plan."
  },

  /* L9b — Base ops (triggered)
     What it does: Defines the stations and the handoff checkpoints.
     Why use: Operational clarity during busy periods.
  */
  {
    tag: "base_ops",
    priority: 5,
    personality: " {{char}} should assign register, bar, and runner positions and should confirm handoff points."
  },

  /* L10a — Inspection flow with multi-triggers and `andAll`
     New tools: multiple triggers and andAll; chains into a health sub-flow.
     What it does: For inspection/health with labels present, emit base_inspection and health_check.
     Why use: Parallel checklists: sanitation and cold-chain checks in one pass.
  */
  {
    keywords: ["inspection", "health"],
    priority: 4,
    triggers: ["base_inspection", "health_check"],
    andAll: ["labels"],
    personality: " {{char}} should confirm sanitizer strength and should verify that all milk jugs have current labels."
  },

  /* L10b — Base inspection (triggered)
     What it does: Details the sanitizer and labeling checks.
     Why use: Keeps inspectors' expectations visible and precise.
  */
  {
    tag: "base_inspection",
    priority: 5,
    personality: " {{char}} should verify sanitizer ppm, check date labels, and should note any required corrections."
  },

  /* L10c — Health check (triggered) with its own `requires` bundle
     New tools: requires.none + requires.any in one object.
     What it does: If not told to skip, and temperature/fridge/thermometer is in scope,
                   record fridge temps and list corrective actions.
     Why use: Encodes a simple HACCP-style gate without cluttering the parent entry.
  */
  {
    tag: "health_check",
    priority: 4,
    requires: { none: ["skip"], any: ["temperature", "fridge", "thermometer"] },
    personality: " {{char}} should record fridge temperatures and should list any corrective actions completed."
  },

  /* L11 - Entity Keyword Expansion
     New tools: `char.entityName` keyword syntax.
     What it does: Uses a special keyword `char.avery` which is automatically expanded at runtime to include the entity's name ("avery") and all of its defined aliases (e.g., "aves", "avie", "avi", "avee") from the ENTITY_DB.
     Why use: Simplifies keyword management for characters, allowing you to define all their names and nicknames in one place.
  */
  {
    keywords: ["char.avery"],
    personality: "[An entry triggered by one of Avery's many names or nicknames.]"
  },

  /* L12 - Previous Message Targeting
     New tools: `prev.` prefix for text-matching properties (e.g., `'prev.keywords'`, `'prev.requireAny'`).
     What it does: This entry's keyword and gate checks are performed against the *second-to-last* message instead of the normal multi-message window.
     Why use: To react to something the user said in their previous turn, which might be contextually different from their most recent message. For example, answering a question they asked before their most recent "Okay, thanks."
  */
  {
    'prev.keywords': ["question"],
    personality: "[This entry triggers because the word 'question' was found in the second-to-last message.]"
  },

  /* L13 - Intent-Gated Entries
     New tools: `requireIntent`, `blockIntent`, `andAnyIntent`, `andAllIntent`, `notAnyIntent`.
     What it does: These entries only trigger if the EIDOS system detects specific intents in the user's last message.
     Why use: To create reactions that are tailored to the user's communicative intent, making the character more responsive and dynamic.
  */

  // L13a: Reacting to Questions (Inquiry)
  {
    requireIntent: "intent.question",
    probability: 0.8,
    personality: " {{char}} recognizes this as a question and should provide a clear, helpful answer."
  },

  // L13b: Reacting to Disclosures (User sharing information)
  {
    requireIntent: "intent.disclosure",
    probability: 0.6,
    personality: " {{char}} acknowledges the information shared and should respond thoughtfully to show they're listening."
  },

  // L13c: Reacting to Directives (Commands)
  {
    requireIntent: "intent.command",
    personality: " {{char}} recognizes this as a directive and should acknowledge the instruction before acting."
  },

  // L13d: Reacting to Commissives (Promises/Agreements)
  {
    requireIntent: "intent.promise",
    probability: 0.7,
    personality: " {{char}} notes the commitment made and should acknowledge it appropriately."
  },

  // L13e: Reacting to Conflict
  {
    requireIntent: "intent.conflict",
    personality: " {{char}} senses hostility or disagreement and should respond carefully to de-escalate if appropriate."
  },

  // L13f: Reacting to Small Talk (Phatic)
  {
    requireIntent: "intent.smallTalk",
    probability: 0.5,
    personality: " {{char}} recognizes casual social interaction and should respond warmly and naturally."
  },

  // L13g: Reacting to Meta (OOC/System)
  {
    requireIntent: "intent.meta",
    personality: " {{char}} recognizes this as out-of-character or system instruction and should handle it appropriately."
  },

  // L13h: Reacting to Narrative (Actions/Descriptions)
  {
    requireIntent: "intent.narrative",
    probability: 0.6,
    personality: " {{char}} should match the narrative style and respond with appropriate descriptive detail."
  },

  /* L14 - Advanced Intent Gating
     New tools: `andAllIntent`, `notAnyIntent`.
     What it does: This entry triggers only if the EIDOS system detects BOTH a question AND small talk, but NOT conflict.
     Why use: To create highly specific reactions to complex intent combinations, like responding to friendly inquiries but not hostile interrogations.
  */
  {
    andAllIntent: ["intent.question", "intent.smallTalk"],
    notAnyIntent: ["intent.conflict"],
    personality: " {{char}} recognizes this as a friendly, casual question and should answer in a relaxed, conversational manner."
  },

  /* L15 - Combining Intent and Text Gates
     What it does: Only triggers when the user asks a question (intent) AND mentions specific keywords.
     Why use: Precision targeting - you can combine semantic intent with specific topic detection.
  */
  {
    andAllIntent: ["intent.question"],
    keywords: ["coffee", "beans", "roast"],
    personality: " {{char}} should explain their coffee expertise enthusiastically, as this is clearly a question about their specialty."
  }

  // 🛑🛑🛑 DO NOT EDIT BELOW THIS LINE 🛑🛑🛑
];

/* ============================================================================
   [SECTION] OUTPUT GUARDS
   SAFE TO EDIT: Yes (keep behavior)
   ========================================================================== */
//#region OUTPUT_GUARDS
context.character = context.character || {};
context.character.personality = (typeof context.character.personality === "string")
  ? context.character.personality : "";
context.character.scenario = (typeof context.character.scenario === "string")
  ? context.character.scenario : "";

/* ============================================================================
   [SECTION] INPUT NORMALIZATION
   SAFE TO EDIT: Yes (tune WINDOW_DEPTH; keep normalization rules)
   ========================================================================== */
//#region INPUT_NORMALIZATION
// --- How many recent messages to scan together (tune as needed) ---
const WINDOW_DEPTH = ((n) => {
  n = parseInt(n, 10);
  if (isNaN(n)) n = 5;
  if (n < 1) n = 1;
  if (n > 20) n = 20; // safety cap
  return n;
})(typeof globalThis.WINDOW_DEPTH === 'number' ? globalThis.WINDOW_DEPTH : 5);

// --- Utilities ---
function _toString(x) { return (x == null ? "" : String(x)); }
function _normalizeText(s) {
  s = _toString(s).toLowerCase();
  s = s.replace(/[^a-z0-9_\s-]/g, " "); // keep letters/digits/underscore/hyphen/space
  s = s.replace(/[-_]+/g, " ");         // treat hyphen/underscore as spaces
  s = s.replace(/\s+/g, " ").trim();    // collapse spaces
  return s;
}

// --- Build multi-message window ---
const _lmArr = (context && context.chat && context.chat.last_messages && typeof context.chat.last_messages.length === "number")
  ? context.chat.last_messages : null;

let _joinedWindow = "";
let _rawLastSingle = "";
let _rawPrevSingle = "";

if (_lmArr && _lmArr.length > 0) {
  const startIdx = Math.max(0, _lmArr.length - WINDOW_DEPTH);
  const segs = [];
  for (const item of _lmArr.slice(startIdx)) {
    const msg = (item && typeof item.message === "string") ? item.message : _toString(item);
    segs.push(_toString(msg));
  }
  _joinedWindow = segs.join(" ");
  const lastItem = _lmArr[_lmArr.length - 1];
  _rawLastSingle = _toString((lastItem && typeof lastItem.message === "string") ? lastItem.message : lastItem);
  if (_lmArr.length > 1) {
    const prevItem = _lmArr[_lmArr.length - 2];
    _rawPrevSingle = _toString((prevItem && typeof prevItem.message === "string") ? prevItem.message : prevItem);
  }
} else {
  const _lastMsgA = (context && context.chat && typeof context.chat.lastMessage === "string") ? context.chat.lastMessage : "";
  const _lastMsgB = (context && context.chat && typeof context.chat.last_message === "string") ? context.chat.last_message : "";
  _rawLastSingle = _toString(_lastMsgA || _lastMsgB);
  _joinedWindow = _rawLastSingle;
}

// --- Public struct + haystacks ---
const CHAT_WINDOW = {
  depth: WINDOW_DEPTH,
  count_available: (_lmArr && _lmArr.length) ? _lmArr.length : (_rawLastSingle ? 1 : 0),
  text_joined: _joinedWindow,
  text_last_only: _rawLastSingle,
  text_prev_only: _rawPrevSingle,
  text_joined_norm: _normalizeText(_joinedWindow),
  text_last_only_norm: _normalizeText(_rawLastSingle),
  text_prev_only_norm: _normalizeText(_rawPrevSingle)
};
const _currentHaystack = " " + CHAT_WINDOW.text_joined_norm + " ";
const _previousHaystack = " " + CHAT_WINDOW.text_prev_only_norm + " ";

// --- Message count ---
let messageCount = 0;
if (_lmArr && typeof _lmArr.length === "number") {
  messageCount = _lmArr.length;
} else if (context && context.chat && typeof context.chat.message_count === "number") {
  messageCount = context.chat.message_count;
} else if (typeof context_chat_message_count === "number") {
  messageCount = context_chat_message_count;
}

// --- Active character name ---
const activeName = _normalizeText(
  (context && context.character && typeof context.character.name === "string")
    ? context.character.name
    : ""
);

/* ============================================================================
   [SECTION] EIDOS INTENT PROCESSING
   DO NOT EDIT: Behavior-sensitive
   ========================================================================== */
//#region EIDOS_PROCESSING
(function () {
  "use strict";

  // This logic runs the intent detection system.
  // It populates `context.intents` which is then used by `intentGatesPass`.

  const INTENTS = ["QUESTION", "DISCLOSURE", "COMMAND", "PROMISE", "CONFLICT", "SMALLTALK", "META", "NARRATIVE"];
  const STOP_STR = "i,me,my,myself,we,our,ours,ourselves,you,your,yours,yourself,yourselves,he,him,his,himself,she,her,hers,herself,it,its,itself,they,them,their,theirs,themselves,what,which,who,whom,this,that,these,those,am,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,a,an,the,and,but,if,or,because,as,until,while,of,at,by,for,with,about,against,between,into,through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,then,once,here,there,when,where,why,how,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,s,t,can,will,just,don,should,now";
  const STOP_WORDS = {};
  STOP_STR.split(",").forEach(function (w) { STOP_WORDS[w] = true; });


  /* ============================================================================
     [SECTION] EIDOS INTENT MODELS
     SAFE TO EDIT: Yes (paste model strings here)
     ========================================================================== */
  //#region EIDOS_MODELS
  // These are placeholders. Paste the actual model strings from your training output.
  // From EIDOS_Sister_Script.js or intent_creator.py output
  var HASH_SIZE = 8192;
  var MODEL_QUESTION = ""
  var MODEL_DISCLOSURE = ""
  var MODEL_COMMAND = ""
  var MODEL_PROMISE = ""
  var MODEL_CONFLICT = ""
  var MODEL_SMALLTALK = ""
  var MODEL_META = ""
  var MODEL_NARRATIVE = ""


  // ----------------------------------------------------------------------------
  // INFERENCE & STATE MANAGEMENT
  // ----------------------------------------------------------------------------

  // EIDOS helper functions must be defined before they are used.
  function stem(w) {
    if (w.length < 4) return w;
    if (w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.endsWith("es")) return w.slice(0, -2);
    if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    if (w.endsWith("ing")) {
      const base = w.slice(0, -3);
      if (base.length > 2) return base;
    }
    if (w.endsWith("ed")) {
      const base = w.slice(0, -2);
      if (base.length > 2) return base;
    }
    if (w.endsWith("ly")) return w.slice(0, -2);
    if (w.endsWith("ment")) return w.slice(0, -4);
    if (w.endsWith("ness")) return w.slice(0, -4);
    if (w.endsWith("ful")) return w.slice(0, -3);
    if (w.endsWith("able")) return w.slice(0, -4);
    if (w.endsWith("ibility")) return w.slice(0, -7);
    return w;
  }

  function fnv1a32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function solveIntent(textTokens, modelStr) {
    if (!modelStr) return -999;
    const semi1 = modelStr.indexOf(";");
    const semi2 = modelStr.indexOf(";", semi1 + 1);
    const bias = parseFloat(modelStr.slice(2, semi1));
    const scale = parseFloat(modelStr.slice(semi1 + 3, semi2));
    const wRaw = modelStr.slice(semi2 + 3);
    const weights = wRaw.split(",");
    let score = bias;
    for (let i = 0; i < textTokens.length; i++) {
      const h = fnv1a32(textTokens[i]) % HASH_SIZE;
      if (h < weights.length) {
        const w = parseInt(weights[h], 10);
        if (!isNaN(w)) {
          score += w * scale;
        }
      }
    }
    return score;
  }

  // Helper: Run model, apply Sigmoid, set Boolean
  // We use a threshold of 0.5 (Score > 0.0) for activation.
  function checkTrigger(tokens, model, targetObj, key) {
    if (typeof model === 'undefined') return;
    var rawScore = solveIntent(tokens, model);
    // Simple binary check: Is the neuron firing?
    targetObj[key] = rawScore > 0.0;
  }

  // This is the main execution block for the EIDOS system.
  // It's wrapped in a try...catch to prevent intent detection errors
  // from breaking the entire lorebook script.
  try {
    if (CHAT_WINDOW.text_last_only) {
      const norm = _normalizeText(CHAT_WINDOW.text_last_only);
      const rawTokens = norm.split(' ');

      const tokens = [];
      for (let i = 0; i < rawTokens.length; i++) {
        const t = rawTokens[i];
        if (t.length > 2 && !STOP_WORDS[t]) {
          tokens.push(stem(t));
        }
      }

      const allTokens = tokens.slice();
      for (let i = 0; i < tokens.length - 1; i++) {
        allTokens.push(tokens[i] + " " + tokens[i + 1]);
      }

      // Ensure context.intents object exists and initialize it.
      if (typeof context.intents !== 'object' || context.intents === null) {
        context.intents = {};
      }

      // Reset all intents to false on each run.
      INTENTS.forEach(function (intent) {
        context.intents[intent.toLowerCase()] = false;
      });

      // Intent Detection using 8 Gates of EIDOS
      // We use a simpler approach than emotions - just check each gate independently
      checkTrigger(allTokens, MODEL_QUESTION, context.intents, "question");
      checkTrigger(allTokens, MODEL_DISCLOSURE, context.intents, "disclosure");
      checkTrigger(allTokens, MODEL_COMMAND, context.intents, "command");
      checkTrigger(allTokens, MODEL_PROMISE, context.intents, "promise");
      checkTrigger(allTokens, MODEL_CONFLICT, context.intents, "conflict");
      checkTrigger(allTokens, MODEL_SMALLTALK, context.intents, "smalltalk");
      checkTrigger(allTokens, MODEL_META, context.intents, "meta");
      checkTrigger(allTokens, MODEL_NARRATIVE, context.intents, "narrative");
    }
  } catch (e) {
    // Log EIDOS errors to the console for easier debugging, without halting the script.
    console.error('[INTENT-LORE] Intent processing failed:', e);
  }

  /* ============================================================================
     [SECTION] UTILITIES
     SAFE TO EDIT: Yes
     ========================================================================== */
  //#region UTILITIES
  function dbg(msg) {
    if (typeof DEBUG !== "undefined" && DEBUG) {
      // Replaced personality injection with standard console logging for better debugging.
      console.log(`[INTENT-LORE] ${String(msg)}`);
    }
  }
    function toArray(x) { return Array.isArray(x) ? x : (x == null ? [] : [x]); }
    function clamp01(v) { v = +v; if (!isFinite(v)) return 0; return Math.max(0, Math.min(1, v)); }
    function parseProbability(v) {
      if (v == null) return 1;
      if (typeof v === "number") return clamp01(v);
      const s = String(v).trim().toLowerCase();
      const n = parseFloat(s.replace("%", ""));
      if (!isFinite(n)) return 1;
      return s.indexOf("%") !== -1 ? clamp01(n / 100) : clamp01(n);
    }
    function getPriority(e) {
      let p = (e && isFinite(e.priority)) ? +e.priority : 3;
      if (p < 1) p = 1;
      if (p > 5) p = 5;
      return p;
    }
    function getMin(e) { return (e && isFinite(e.minMessages)) ? +e.minMessages : -Infinity; }
    function getMax(e) { return (e && isFinite(e.maxMessages)) ? +e.maxMessages : Infinity; }
    function getKeywords(e) { return (e && Array.isArray(e.keywords)) ? e.keywords.slice(0) : []; }
    function getTriggers(e) { return (e && Array.isArray(e.triggers)) ? e.triggers.slice(0) : []; }
    function getBlocklist(e) {
      if (!e) return [];
      if (Array.isArray(e.block)) return e.block.slice(0);
      if (Array.isArray(e.Block)) return e.Block.slice(0);
      return [];
    }
    function getNameBlock(e) { return (e && Array.isArray(e.nameBlock)) ? e.nameBlock.slice(0) : []; }
    function _normalizeName(s) { return _normalizeText(s); }
    function _isNameBlocked(e) {
      if (!activeName) return false;
      const nb = getNameBlock(e);
      for (const item of nb) {
        const n = _normalizeName(item);
        if (!n) continue;
        if (n === activeName) return true;
        if (activeName.indexOf(n) !== -1) return true;
        if (n.indexOf(activeName + " ") === 0) return true;
      }
      return false;
    }

    function expandKeywordsInArray(keywords, entityDb, regex, dbgFunc) {
      const expanded = [];
      for (const keyword of keywords) {
        const match = String(keyword).match(regex);
        if (match) {
          const entityName = match[1].toLowerCase();
          const entity = entityDb[entityName];
          if (entity) {
            // Add the main name (which is the key)
            expanded.push(entityName);
            // Add aliases if they exist
            if (Array.isArray(entity.aliases)) {
              expanded.push(...entity.aliases);
            }
            dbgFunc(`Expanded '${keyword}' to include keywords for '${entityName}'.`);
          } else {
            dbgFunc(`Could not find entity for '${keyword}'. Ignoring.`);
          }
        } else {
          // Not an entity keyword, just add it back
          expanded.push(keyword);
        }
      }
      // Using a Set to remove duplicates, then converting back to an array
      return [...new Set(expanded)];
    }

    function expandEntityKeywords(loreBook, entityDb, dbgFunc) {
      const entityKeywordRegex = /^char\.([a-z0-9_]+)$/i;
      for (const entry of loreBook) {
        if (entry.keywords && entry.keywords.length) {
          entry.keywords = expandKeywordsInArray(entry.keywords, entityDb, entityKeywordRegex, dbgFunc);
        }
        if (entry.Shifts && entry.Shifts.length) {
          for (const shift of entry.Shifts) {
            if (shift.keywords && shift.keywords.length) {
              shift.keywords = expandKeywordsInArray(shift.keywords, entityDb, entityKeywordRegex, dbgFunc);
            }
          }
        }
      }
    }

    function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

    function _hasTerm(haystack, term) {
      const rawTerm = (term == null ? "" : String(term)).trim();
      if (!rawTerm) return false;

      if (rawTerm.charAt(rawTerm.length - 1) === "*") {
        const stem = _normalizeText(rawTerm.slice(0, -1));
        if (!stem) return false;
        const re1 = new RegExp("(?:^|\\s)" + escapeRegex(stem) + "[a-z]*?(?=\\s|$)");
        return re1.test(haystack);
      }

      const t = _normalizeText(rawTerm);
      if (!t) return false;
      const w = escapeRegex(t);
      const re2 = new RegExp("(?:^|\\s)" + w + "(?=\\s|$)");
      return re2.test(haystack);
    }

    function collectWordGates(e) {
      // Helper to reduce repetition for current and 'prev.' scopes.
      const getGateSet = (prefix = "") => {
        const p = (key) => `${prefix}${key}`;
        const r = (e && e[p('requires')]) ? e[p('requires')] : {};

        const any = [].concat(
          toArray(e && e[p('requireAny')]),
          toArray(e && e[p('andAny')]),
          toArray(r.any)
        );
        const all = [].concat(
          toArray(e && e[p('requireAll')]),
          toArray(e && e[p('andAll')]),
          toArray(r.all)
        );
        const none = [].concat(
          toArray(e && e[p('requireNone')]),
          toArray(e && e[p('notAny')]),
          toArray(r.none),
          // getBlocklist is only for current scope; 'prev.' uses 'prev.block'.
          prefix === "" ? toArray(getBlocklist(e)) : toArray(e && e[p('block')])
        );
        const nall = [].concat(toArray(e && e[p('notAll')]));

        return { any, all, none, nall };
      };

      return {
        current: getGateSet(),
        previous: getGateSet('prev.')
      };
    }

    function _checkWordGates(e) {
      const g = collectWordGates(e);

      const cur = g.current;
      if (cur.any.length && !cur.any.some(w => _hasTerm(_currentHaystack, w))) return false;
      if (cur.all.length && !cur.all.every(w => _hasTerm(_currentHaystack, w))) return false;
      if (cur.none.length && cur.none.some(w => _hasTerm(_currentHaystack, w))) return false;
      if (cur.nall.length && cur.nall.every(w => _hasTerm(_currentHaystack, w))) return false;

      const prevScope = g.previous;
      if (prevScope.any.length && !prevScope.any.some(w => _hasTerm(_previousHaystack, w))) return false;
      if (prevScope.all.length && !prevScope.all.every(w => _hasTerm(_previousHaystack, w))) return false;
      if (prevScope.none.length && prevScope.none.some(w => _hasTerm(_previousHaystack, w))) return false;
      if (prevScope.nall.length && prevScope.nall.every(w => _hasTerm(_previousHaystack, w))) return false;

      return true;
    }

    function _checkTagGates(e, activeTagsSet) {
      const anyT = toArray(e && e.andAnyTags);
      const allT = toArray(e && e.andAllTags);
      const noneT = toArray(e && e.notAnyTags);
      const nallT = toArray(e && e.notAllTags);
      const hasT = t => !!activeTagsSet && activeTagsSet[String(t)] === 1;

      if (anyT.length && !anyT.some(hasT)) return false;
      if (allT.length && !allT.every(hasT)) return false;
      if (noneT.length && noneT.some(hasT)) return false;
      if (nallT.length && nallT.every(hasT)) return false;
      return true;
    }

    function _checkIntentGates(e) {
      // Map old keys for backward compatibility and gather all aliases.
      // Support both 'intent.xxx' format and plain 'xxx' format
      const normalizeIntent = (intentStr) => {
        const s = String(intentStr).toLowerCase();
        // Strip 'intent.' prefix if present
        return s.startsWith('intent.') ? s.slice(7) : s;
      };

      const anyI = toArray(e && (e.requireAnyIntent || e.andAnyIntent || e.requireIntent)).map(normalizeIntent);
      const allI = toArray(e && (e.requireAllIntent || e.andAllIntent)).map(normalizeIntent);
      const noneI = toArray(e && (e.blockAnyIntent || e.notAnyIntent || e.blockIntent)).map(normalizeIntent);
      const nallI = toArray(e && (e.blockAllIntent || e.notAllIntent)).map(normalizeIntent);

      if (anyI.length === 0 && allI.length === 0 && noneI.length === 0 && nallI.length === 0) {
        return true; // No intent gates, pass.
      }

      // Check if context.intents exists and is an object
      const activeIntents = (context && typeof context.intents === 'object' && context.intents) ? context.intents : {};
      const hasI = intent => activeIntents[String(intent).toLowerCase()] === true;

      if (anyI.length > 0 && !anyI.some(hasI)) return false;
      if (allI.length > 0 && !allI.every(hasI)) return false;
      if (noneI.length > 0 && noneI.some(hasI)) return false;
      if (nallI.length > 0 && nallI.every(hasI)) return false;

      return true;
    }

    function _isAlwaysOn(e) {
      const hasKW = !!(e && e.keywords && e.keywords.length);
      const hasPrevKW = !!(e && e['prev.keywords'] && e['prev.keywords'].length);
      const hasTag = !!(e && e.tag);
      const hasMin = (e && e.minMessages != null);
      const hasMax = (e && e.maxMessages != null);
      return !hasKW && !hasPrevKW && !hasTag && !hasMin && !hasMax;
    }

    function _isEntryActive(e, activeTagsSet) {
      if (!(messageCount >= getMin(e) && messageCount <= getMax(e))) return false;
      if (_isNameBlocked(e)) return false;
      if (!_checkWordGates(e)) return false;
      if (!_checkTagGates(e, activeTagsSet || {})) return false;
      if (!_checkIntentGates(e)) return false;
      if (Math.random() > parseProbability(e && e.probability)) return false;
      return true;
    }

    function resolveActiveEntities(currentText, lastMessages) {
      // 1. Initialize Short-Term Memory
      let memory = { M: null, F: null, N: null };
      let activeEntities = new Set();

      // Helper to update memory based on a text string
      const scanTextForNames = (text) => {
        const lower = text.toLowerCase();
        for (const name in ENTITY_DB) {
          if (Object.prototype.hasOwnProperty.call(ENTITY_DB, name)) {
            // Use a word-boundary regex for more precise matching (e.g., "art" won't match "heart").
            const nameRegex = new RegExp(`\\b${escapeRegex(name)}\\b`);
            if (nameRegex.test(lower)) {
              const meta = ENTITY_DB[name];
              memory[meta.gender] = name; // Update "Last Mentioned Female", etc.
              memory.N = name;            // Update "Last Mentioned Entity"

              // If this is the current text, mark this entity as Active
              if (text === currentText) activeEntities.add(name);
            }
          }
        }
      };

      // 2. Scan History (Oldest -> Newest) to build state
      if (lastMessages && Array.isArray(lastMessages)) {
        for (const msg of lastMessages) {
          const msgText = (msg && typeof msg.message === 'string') ? msg.message : _toString(msg);
          scanTextForNames(msgText);
        }
      }

      // 3. Scan Current Text for Names (Overrides history)
      scanTextForNames(currentText);

      // 4. Resolve Pronouns in Current Text
      const lowerCurrent = currentText.toLowerCase();
      const words = lowerCurrent.split(/\W+/); // Split by non-word chars

      for (const word of words) {
        if (PRONOUN_MAP[word]) {
          const gender = PRONOUN_MAP[word];
          const target = memory[gender] || memory.N; // Try gender match, fallback to neutral/last

          if (target) {
            activeEntities.add(target);
            dbg(`Coreference: '${word}' -> ${target}`);
          }
        }
      }

      return Array.from(activeEntities);
    }

    function getDynamicRelationshipLore(activeTagsSet) {
      const lastMessages = (_lmArr || []).map(item => (item && typeof item.message === "string") ? item.message : _toString(item));
      const activeEntities = resolveActiveEntities(CHAT_WINDOW.text_last_only, lastMessages);

      if (activeEntities.length < 2) return []; // Need 2 people for a relationship

      let injections = [];

      for (const trigger of RELATIONSHIP_DB) {
        // 1. Check if both entities are present
        const hasPair = trigger.pair.every(name => activeEntities.includes(name));

        if (hasPair) {
          // 2. Check for required tags
          const requireTags = toArray(trigger.requireTags);
          if (requireTags.length === 0) continue;
          const hasTags = requireTags.every(t => hasTag(activeTagsSet, t));

          if (hasTags) {
            dbg(`Relationship Trigger: ${trigger.pair.join('+')}`);
            injections.push({
              injection: trigger.injection,
              group: trigger.group || null
            });
          }
        }
      }
      return injections;
    }

    function compileAuthorLore(authorLore, entityDb) {
      let src = Array.isArray(authorLore) ? authorLore.slice() : [];

      if (entityDb) {
        for (const entityName in entityDb) {
          if (Object.prototype.hasOwnProperty.call(entityDb, entityName)) {
            const entity = entityDb[entityName];
            if (entity.lore && Array.isArray(entity.lore)) {
              src = src.concat(entity.lore);
            }
          }
        }
      }

      const out = new Array(src.length);
      for (const [i, entry] of src.entries()) {
        out[i] = normalizeEntry(entry);
      }
      return out;
    }
    function normalizeEntry(e) {
      if (!e) return {};
      const out = {};
      for (const k in e) if (Object.prototype.hasOwnProperty.call(e, k)) out[k] = e[k];
      out.keywords = Array.isArray(e.keywords) ? e.keywords.slice(0) : [];
      if (Array.isArray(e.Shifts) && e.Shifts.length) {
        const shArr = new Array(e.Shifts.length);
        for (const [i, shift] of e.Shifts.entries()) {
          const sh = shift || {};
          const shOut = {};
          for (const sk in sh) if (Object.prototype.hasOwnProperty.call(sh, sk)) shOut[sk] = sh[sk];
          shOut.keywords = Array.isArray(sh.keywords) ? sh.keywords.slice(0) : [];
          shArr[i] = shOut;
        }
        out.Shifts = shArr;
      } else if (out.hasOwnProperty("Shifts")) {
        delete out.Shifts;
      }
      return out;
    }

    /* ============================================================================
       [SECTION] COMPILATION
       DO NOT EDIT: Behavior-sensitive
       ========================================================================== */
    //#region COMPILATION
    const _ENGINE_LORE = compileAuthorLore(typeof DYNAMIC_LORE !== "undefined" ? DYNAMIC_LORE : [], typeof ENTITY_DB !== "undefined" ? ENTITY_DB : {});

    // Expand `char.entity` keywords into their full alias lists.
    expandEntityKeywords(_ENGINE_LORE, ENTITY_DB, dbg);


    /* ============================================================================
       [SECTION] SELECTION PIPELINE
       DO NOT EDIT: Behavior-sensitive
       ========================================================================== */
    //#region SELECTION_PIPELINE
    // --- State -------------------------------------------------------------------
    const buckets = [null, [], [], [], [], []];
    const picked = new Array(_ENGINE_LORE.length).fill(0);
    const inclusionGroups = {}; // For mutual exclusion

    function makeTagSet() { return Object.create(null); }
    const trigSet = makeTagSet();
    const postShiftTrigSet = makeTagSet();

    function addTag(set, key) { set[String(key)] = 1; }
    function hasTag(set, key) { return set[String(key)] === 1; }

    // --- 1) Direct pass ----------------------------------------------------------
    for (const [i1, e1] of _ENGINE_LORE.entries()) {
      const hit = _isAlwaysOn(e1) || getKeywords(e1).some(kw => _hasTerm(_currentHaystack, kw)) || toArray(e1['prev.keywords']).some(kw => _hasTerm(_previousHaystack, kw));
      if (!hit) continue;
      if (!_isEntryActive(e1, undefined)) { dbg(`filtered entry[${i1}]`); continue; }
      buckets[getPriority(e1)].push(i1);
      picked[i1] = 1;
      const trg1 = getTriggers(e1);
      for (const tag of trg1) {
        addTag(trigSet, tag);
      }
      dbg(`hit entry[${i1}] p=${getPriority(e1)}`);
    }

    // --- 2) Trigger pass ---------------------------------------------------------
    for (const [i2, e2] of _ENGINE_LORE.entries()) {
      if (picked[i2]) continue;
      if (!(e2 && e2.tag && hasTag(trigSet, e2.tag))) continue;
      if (!_isEntryActive(e2, trigSet)) { dbg(`filtered triggered entry[${i2}]`); continue; }
      buckets[getPriority(e2)].push(i2);
      picked[i2] = 1;
      const trg2 = getTriggers(e2);
      for (const tag of trg2) {
        addTag(trigSet, tag);
      }
      dbg(`triggered entry[${i2}] p=${getPriority(e2)}`);
    }

    // --- 3) Priority selection (capped) -----------------------------------------
    const selected = [];
    let pickedCount = 0;
    const applyLimit = (typeof APPLY_LIMIT === "number" && APPLY_LIMIT >= 1) ? APPLY_LIMIT : 99999;

    for (let p = 5; p >= 1 && pickedCount < applyLimit; p--) {
      const bucket = buckets[p];
      for (const item of bucket) {
        if (pickedCount >= applyLimit) break;

        // NEW: Inclusion group logic
        // To use this, add a `group` property to your lore entries.
        // Entries sharing a group name will be mutually exclusive.
        const entry = _ENGINE_LORE[item];
        // v14 lore entries don't have 'id' by default, so we rely on the 'group' property.
        const group = entry.group || (entry.id ? String(entry.id).split('_')[0] : null);
        if (group) {
          if (inclusionGroups[group]) {
            dbg(`Skipping entry in group '${group}' because an entry from this group was already selected.`);
            continue;
          }
          inclusionGroups[group] = true;
        }

        selected.push(item);
        pickedCount++;
      }
    }
    if (pickedCount === applyLimit) dbg("APPLY_LIMIT reached");

    /* ============================================================================
       [SECTION] APPLY + SHIFTS + POST-SHIFT
       DO NOT EDIT: Behavior-sensitive
       ========================================================================== */
    //#region APPLY_AND_SHIFTS
    let personalityBuffer = "";
    let scenarioBuffer = "";

    for (const idx of selected) {
      const e3 = _ENGINE_LORE[idx];
      if (e3 && e3.personality) personalityBuffer += `\n\n${e3.personality}`;
      if (e3 && e3.scenario) scenarioBuffer += `\n\n${e3.scenario}`;
      if (!(e3 && Array.isArray(e3.Shifts) && e3.Shifts.length)) continue;

      for (const sh of e3.Shifts) {
        const activated = _isAlwaysOn(sh) || getKeywords(sh).some(kw => _hasTerm(_currentHaystack, kw)) || toArray(sh['prev.keywords']).some(kw => _hasTerm(_previousHaystack, kw));
        if (!activated) continue;

        const trgSh = getTriggers(sh);
        for (const tag of trgSh) {
          addTag(postShiftTrigSet, tag);
        }

        if (!_isEntryActive(sh, trigSet)) { dbg("shift filtered"); continue; }

        if (sh.personality) personalityBuffer += `\n\n${sh.personality}`;
        if (sh.scenario) scenarioBuffer += `\n\n${sh.scenario}`;
      }
    }

    // --- Post-shift triggers -----------------------------------------------------
    const unionTags = (() => {
      const dst = makeTagSet();
      for (const k in trigSet) if (trigSet[k] === 1) dst[k] = 1;
      for (const k in postShiftTrigSet) if (postShiftTrigSet[k] === 1) dst[k] = 1;
      return dst;
    })();

    for (const [i3, e4] of _ENGINE_LORE.entries()) {
      if (picked[i3]) continue;
      if (!(e4 && e4.tag && hasTag(postShiftTrigSet, e4.tag))) continue;
      if (!_isEntryActive(e4, unionTags)) { dbg(`post-filter entry[${i3}]`); continue; }
      if (e4.personality) personalityBuffer += `\n\n${e4.personality}`;
      if (e4.scenario) scenarioBuffer += `\n\n${e4.scenario}`;
      dbg(`post-shift triggered entry[${i3}] p=${getPriority(e4)}`);
    }

    // --- Dynamic Relationship Injections ---------------------------------------
    const relationshipInjections = getDynamicRelationshipLore(unionTags);
    if (relationshipInjections.length > 0) {
      for (const injectionObj of relationshipInjections) {
        const group = injectionObj.group;
        if (group) {
          if (inclusionGroups[group]) {
            dbg(`Skipping relationship injection in group '${group}' due to exclusion.`);
            continue;
          }
          inclusionGroups[group] = true;
        }
        personalityBuffer += `\n\n${injectionObj.injection}`;
      }
    }

    /* ============================================================================
       [SECTION] FLUSH
       DO NOT EDIT: Behavior-sensitive
       ========================================================================== */
    //#region FLUSH
    if (personalityBuffer) context.character.personality += personalityBuffer;
    if (scenarioBuffer) context.character.scenario += scenarioBuffer;
    //#endregion
  }) ();
