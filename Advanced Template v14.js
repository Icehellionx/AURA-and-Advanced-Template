/* ============================================================================
   ADVANCED LORE BOOK SYSTEM v14
   Author: Icehellionx
   //#region HEADER
   ==========================================================================
   Inputs (read-only):  context.chat.last_message (or lastMessage), context.chat.message_count
   Outputs (write-only): context.character.personality, context.character.scenario

   AUTHOR CHEAT-SHEET (ASCII-safe):
     - keywords: real user words/phrases; supports suffix wildcard "welcom*" -> welcome/welcomed/welcoming.
     - tag: internal label for this entry (e.g., "base_open"); never matched against text.
     - triggers: list of tags to emit when this entry hits (e.g., ["base_open"]).

   Text gates (any of these aliases are accepted):
     - requireAny / andAny / requires: { any: [...] }
     - requireAll / andAll / requires: { all: [...] }
     - requireNone / notAny / block / requires: { none: [...] }
     - notAll  // reject only if *all* listed words are present simultaneously

   Tag gates (cross-entry by fired tags):
     - andAnyTags, andAllTags, notAnyTags, notAllTags

   Time gates:
     - minMessages / maxMessages

   Name block:
     - nameBlock: ["jamie"]  // blocks if active bot name equals any listed (case-insensitive)

   Priority and selection:
     - priority: 1..5 (default 3; clamped)
     - APPLY_LIMIT caps how many entries apply per turn (engine-level)

   Probability:
     - probability: 0..1 or "40%" (both supported)

   Shifts:
     - optional sub-entries with same fields as entries; evaluated after the parent entry hits

   Multi-message window (engine behavior summary):
     - Engine normalizes a joined window of recent messages (WINDOW_DEPTH) for keyword checks.
     - Whole-word matching with optional suffix wildcard "stem*".
     - Hyphen/underscore treated as spaces during normalization.

   Output formatting:
     - Engine prepends "\\n\\n" before each applied personality/scenario fragment.
   ========================================================================== */


/* ============================================================================
   [SECTION] GLOBAL KNOBS
   SAFE TO EDIT: Yes
   ========================================================================== */
//#region GLOBAL_KNOBS
let DEBUG       = 0;     // 1 -> emit [DBG] lines inline in personality
let APPLY_LIMIT = 6;     // cap applied entries per turn; higher priorities win

/* ============================================================================
   [SECTION] DYNAMIC RELATIONSHIP
   SAFE TO EDIT: Yes
   ========================================================================== */
//#region DYNAMIC_RELATIONSHIP
// 1. ENTITY DEFINITIONS (Who exists in the story?)
// Keys should be lower case for matching.
const ENTITY_DB = {
    "marcus": {
        gender: "M",
        aliases: ["marc", "brooding warrior"],
        lore: [
            {
                group: "marcus_base",
                keywords: ["char.marcus"],
                personality: "Marcus is a brooding warrior with a hidden heart of gold."
            }
        ]
    },
    "elara": { gender: "F" },
    "king": { gender: "M" }, // Titles work too
    "guard": { gender: "N" },
    "avery": {
        gender: "N",
        aliases: ["aves", "avie", "avi", "avee"]
    }
};

// 2. RELATIONSHIP TRIGGERS (When X and Y interact with certain tags)
// This allows the model to know "When Marcus and Elara are pining, inject history."
const RELATIONSHIP_DB = [
    {
        // Example: "The One That Got Away"
        pair: ["marcus", "elara"],
        // Engine will check if ALL of these tags were triggered this turn.
        // NOTE: You must have lore entries that emit these tags!
        requireTags: ["yearning", "angst"],
        injection: "[HISTORY] Marcus and Elara share a painful past. They want each other but are afraid to bridge the gap.",
        // Groups are used for mutual exclusion. Only one entry from a group will be picked.
        group: "relationship_history"
    },
    {
        // Example: "The Rivalry"
        pair: ["marcus", "king"],
        requireTags: ["jealousy", "conflict"],
        injection: "[RIVALRY] The tension between Marcus and the King is palpable. A power struggle.",
        group: "rivalry"
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
//#region AUTHOR_ENTRIES
const dynamicLore = [
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

  /* L7a — Inventory with multiple triggers and nested requires
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

  /* L7b — Base inventory (trigger-only)
     What it does: Prompts a check and heuristic planning for tomorrow.
     Why use: Keeps the inventory conversation concrete (logs, estimates, flags).
  */
  {
    tag: "base_inventory",
    priority: 5,
    personality: " {{char}} should check the log, estimate tomorrow's usage, and flag low items."
  },

  /* L7c — Order supplies (trigger-only)
     What it does: Converts assessment into explicit quantities and an action (PO).
     Why use: Ensures conversations end with a clear operational decision.
  */
  {
    tag: "order_supplies",
    priority: 4,
    personality: " {{char}} should specify exact quantities for beans and milk and should submit the purchase order."
  },

  /* L8a — Milk steaming with Shifts (branching refinements)
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

  /* L9a — Operations cameo with nameBlock and exclusion
     New tools: nameBlock prevents self-referential loops if the character is "jamie".
     What it does: If user mentions "jamie" or "manager" (but character named 'jamie' is blocked from acting on it),
                   and not off-duty, emit base_ops and assign roles.
     Why use: Avoids awkward self-cameo; still supports talking about someone else named Jamie.
  */
  {
    keywords: ["jamie", "manager"],
    nameBlock: ["jamie"],
    priority: 4,
    triggers: ["base_ops"],
    notAny: ["off-duty"],
    personality: " {{char}} should assign roles during peak hours and should confirm the plan."
  },

  /* L9b — Base ops (trigger-only)
     What it does: Defines the stations and the handoff checkpoints.
     Why use: Operational clarity during busy periods.
  */
  {
    tag: "base_ops",
    priority: 5,
    personality: " {{char}} should assign register, bar, and runner positions and should confirm handoff points."
  },

  /* L10a — Inspection flow with multi-triggers and requires(all)
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

  /* L10b — Base inspection (trigger-only)
     What it does: Details the sanitizer and labeling checks.
     Why use: Keeps inspectors’ expectations visible and precise.
  */
  {
    tag: "base_inspection",
    priority: 5,
    personality: " {{char}} should verify sanitizer ppm, check date labels, and should note any required corrections."
  },

  /* L10c — Health check (trigger-only) with its own requires bundle
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

  /* L13 - Emotion-based Targeting
     New tools: `requireEmotion` and `blockEmotion` properties.
     What it does: This entry only triggers if the AURA v8 emotion-detection system has detected 'anger' in the user's last message. It is blocked if 'sadness' is also detected (unlikely, but for demonstration).
     Why use: To create reactions that are tailored to the user's perceived emotional state, making the character more responsive and dynamic.
  */
  {
    requireEmotion: "anger",
    blockEmotion: "sadness",
    personality: "[This entry triggers because the user seems angry.]"
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
// --- How many recent messages to scan together (tune as needed) -------------
const WINDOW_DEPTH = ((n) => {
  n = parseInt(n, 10);
  if (isNaN(n)) n = 5;
  if (n < 1) n = 1;
  if (n > 20) n = 20; // safety cap
  return n;
})(typeof globalThis.WINDOW_DEPTH === 'number' ? globalThis.WINDOW_DEPTH : 5);

// --- Utilities ---------------------------------------------------------------
function _str(x) { return (x == null ? "" : String(x)); }
function _normalizeText(s) {
  s = _str(s).toLowerCase();
  s = s.replace(/[^a-z0-9_\s-]/g, " "); // keep letters/digits/underscore/hyphen/space
  s = s.replace(/[-_]+/g, " ");         // treat hyphen/underscore as spaces
  s = s.replace(/\s+/g, " ").trim();    // collapse spaces
  return s;
}

// --- Build multi-message window ---------------------------------------------
const _lmArr = (context && context.chat && context.chat.last_messages && typeof context.chat.last_messages.length === "number")
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

// --- Public struct + haystack ------------------------------------------------
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
const last = " " + CHAT_WINDOW.text_joined_norm + " ";
const prev = " " + CHAT_WINDOW.text_prev_only_norm + " ";

// --- Message count -----------------------------------------------------------
let messageCount = 0;
if (_lmArr && typeof _lmArr.length === "number") {
  messageCount = _lmArr.length;
} else if (context && context.chat && typeof context.chat.message_count === "number") {
  messageCount = context.chat.message_count;
} else if (typeof context_chat_message_count === "number") {
  messageCount = context_chat_message_count;
}

// --- Active character name ---------------------------------------------------
const activeName = _normalizeText(
  (context && context.character && typeof context.character.name === "string")
    ? context.character.name
    : ""
);

/* ============================================================================
   [SECTION] UTILITIES
   SAFE TO EDIT: Yes
   ========================================================================== */
//#region UTILITIES
function dbg(msg) {
  try {
    if (typeof DEBUG !== "undefined" && DEBUG) {
      context.character.personality += `\n\n[DBG] ${String(msg)}`;
    }
  } catch (e) {}
}
function arr(x) { return Array.isArray(x) ? x : (x == null ? [] : [x]); }
function clamp01(v) { v = +v; if (!isFinite(v)) return 0; return Math.max(0, Math.min(1, v)); }
function parseProbability(v) {
  if (v == null) return 1;
  if (typeof v === "number") return clamp01(v);
  const s = String(v).trim().toLowerCase();
  const n = parseFloat(s.replace("%", ""));
  if (!isFinite(n)) return 1;
  return s.indexOf("%") !== -1 ? clamp01(n / 100) : clamp01(n);
}
function prio(e) {
  let p = (e && isFinite(e.priority)) ? +e.priority : 3;
  if (p < 1) p = 1;
  if (p > 5) p = 5;
  return p;
}
function getMin(e) { return (e && isFinite(e.minMessages)) ? +e.minMessages : -Infinity; }
function getMax(e) { return (e && isFinite(e.maxMessages)) ? +e.maxMessages :  Infinity; }
function getKW(e)  { return (e && Array.isArray(e.keywords)) ? e.keywords.slice(0) : []; }
function getTrg(e) { return (e && Array.isArray(e.triggers)) ? e.triggers.slice(0) : []; }
function getBlk(e) {
  if (!e) return [];
  if (Array.isArray(e.block)) return e.block.slice(0);
  if (Array.isArray(e.Block)) return e.Block.slice(0);
  return [];
}
function getNameBlock(e) { return (e && Array.isArray(e.nameBlock)) ? e.nameBlock.slice(0) : []; }
function normName(s) { return _normalizeText(s); }
function isNameBlocked(e) {
  if (!activeName) return false;
  const nb = getNameBlock(e);
  for (const item of nb) {
    const n = normName(item);
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

function reEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function hasTerm(hay, term) {
  const rawTerm = (term == null ? "" : String(term)).trim();
  if (!rawTerm) return false;

  if (rawTerm.charAt(rawTerm.length - 1) === "*") {
    const stem = _normalizeText(rawTerm.slice(0, -1));
    if (!stem) return false;
    const re1 = new RegExp("(?:^|\\s)" + reEsc(stem) + "[a-z]*?(?=\\s|$)");
    return re1.test(hay);
  }

  const t = _normalizeText(rawTerm);
  if (!t) return false;
  const w = reEsc(t);
  const re2 = new RegExp("(?:^|\\s)" + w + "(?=\\s|$)");
  return re2.test(hay);
}

function collectWordGates(e) {
  const r = (e && e.requires) ? e.requires : {};
  const any = [].concat(
      arr(e && e.requireAny),
      HEURISTICS_USAGE.andAny ? arr(e && e.andAny) : [],
      arr(r.any)
  );
  const all = [].concat(
      arr(e && e.requireAll),
      HEURISTICS_USAGE.andAll ? arr(e && e.andAll) : [],
      arr(r.all)
  );
  const none = [].concat(
      arr(e && e.requireNone),
      HEURISTICS_USAGE.notAny ? arr(e && e.notAny) : [],
      arr(r.none),
      arr(getBlk(e))
  );
  const nall = HEURISTICS_USAGE.notAll ? [].concat(arr(e && e.notAll)) : [];

  const r_prev = (e && e['prev.requires']) ? e['prev.requires'] : {};
  const any_prev = [].concat(
      arr(e && e['prev.requireAny']),
      HEURISTICS_USAGE.andAny ? arr(e && e['prev.andAny']) : [],
      arr(r_prev.any)
  );
  const all_prev = [].concat(
      arr(e && e['prev.requireAll']),
      HEURISTICS_USAGE.andAll ? arr(e && e['prev.andAll']) : [],
      arr(r_prev.all)
  );
  const none_prev = [].concat(
      arr(e && e['prev.requireNone']),
      HEURISTICS_USAGE.notAny ? arr(e && e['prev.notAny']) : [],
      arr(r_prev.none),
      arr(e && e['prev.block'])
  );
  const nall_prev = HEURISTICS_USAGE.notAll ? [].concat(arr(e && e['prev.notAll'])) : [];

  return {
    current: { any, all, none, nall },
    previous: { any: any_prev, all: all_prev, none: none_prev, nall: nall_prev }
  };
}

function wordGatesPass(e) {
  const g = collectWordGates(e);

  const cur = g.current;
  if (cur.any.length  && !cur.any.some(w => hasTerm(last, w))) return false;
  if (cur.all.length  && !cur.all.every(w => hasTerm(last, w))) return false;
  if (cur.none.length &&  cur.none.some(w => hasTerm(last, w))) return false;
  if (cur.nall.length &&   cur.nall.every(w => hasTerm(last, w))) return false;

  const prevScope = g.previous;
  if (prevScope.any.length  && !prevScope.any.some(w => hasTerm(prev, w))) return false;
  if (prevScope.all.length  && !prevScope.all.every(w => hasTerm(prev, w))) return false;
  if (prevScope.none.length &&  prevScope.none.some(w => hasTerm(prev, w))) return false;
  if (prevScope.nall.length &&   prevScope.nall.every(w => hasTerm(prev, w))) return false;

  return true;
}

function tagsPass(e, activeTagsSet) {
  const anyT  = arr(e && e.andAnyTags);
  const allT  = arr(e && e.andAllTags);
  const noneT = arr(e && e.notAnyTags);
  const nallT = arr(e && e.notAllTags);
  const hasT  = t => !!activeTagsSet && activeTagsSet[String(t)] === 1;

  if (anyT.length  && !anyT.some(hasT)) return false;
  if (allT.length  && !allT.every(hasT)) return false;
  if (noneT.length &&  noneT.some(hasT)) return false;
  if (nallT.length &&   nallT.every(hasT)) return false;
  return true;
}

function emotionGatesPass(e) {
    const reqEmotion = arr(e && e.requireEmotion);
    const blockEmotion = arr(e && e.blockEmotion);

    if (reqEmotion.length === 0 && blockEmotion.length === 0) {
        return true; // No emotion gates, pass.
    }

    // Check if context.emotions exists and is an object
    const activeEmotions = (context && typeof context.emotions === 'object' && context.emotions) ? context.emotions : {};

    // Check required emotions (ANY of them)
    if (reqEmotion.length > 0) {
        if (!reqEmotion.some(emo => activeEmotions[String(emo).toLowerCase()] === true)) {
            return false;
        }
    }

    // Check blocked emotions (ANY of them)
    if (blockEmotion.length > 0) {
        if (blockEmotion.some(emo => activeEmotions[String(emo).toLowerCase()] === true)) {
            return false;
        }
    }

    return true;
}

function isAlwaysOn(e) {
  const hasKW  = !!(e && e.keywords && e.keywords.length);
  const hasPrevKW = !!(e && e['prev.keywords'] && e['prev.keywords'].length);
  const hasTag = !!(e && e.tag);
  const hasMin = (e && e.minMessages != null);
  const hasMax = (e && e.maxMessages != null);
  return !hasKW && !hasPrevKW && !hasTag && !hasMin && !hasMax;
}

function entryPasses(e, activeTagsSet) {
  if (!(messageCount >= getMin(e) && messageCount <= getMax(e))) return false;
  if (isNameBlocked(e)) return false;
  if (!wordGatesPass(e)) return false;
  if (!tagsPass(e, activeTagsSet || {})) return false;
  if (!emotionGatesPass(e)) return false;
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
                if (lower.includes(name)) {
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
            const msgText = (msg && typeof msg.message === 'string') ? msg.message : String(msg);
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
    const lastMessages = (_lmArr || []).map(item => (item && typeof item.message === "string") ? item.message : String(item));
    const activeEntities = resolveActiveEntities(CHAT_WINDOW.text_last_only, lastMessages);

    if (activeEntities.length < 2) return []; // Need 2 people for a relationship

    let injections = [];

    for (const trigger of RELATIONSHIP_DB) {
        // 1. Check if both entities are present
        const hasPair = trigger.pair.every(name => activeEntities.includes(name));

        if (hasPair) {
            // 2. Check for required tags
            const requireTags = arr(trigger.requireTags);
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
const _ENGINE_LORE = compileAuthorLore(typeof dynamicLore !== "undefined" ? dynamicLore : [], typeof ENTITY_DB !== "undefined" ? ENTITY_DB : {});

// Expand `char.entity` keywords into their full alias lists.
expandEntityKeywords(_ENGINE_LORE, ENTITY_DB, dbg);

// Detect which heuristics are actively used across all lore entries.
const HEURISTICS_USAGE = {
    andAny: false,
    andAll: false,
    notAny: false,
    notAll: false,
};
for (const entry of _ENGINE_LORE) {
    if (entry.andAny && entry.andAny.length > 0) HEURISTICS_USAGE.andAny = true;
    if (entry.andAll && entry.andAll.length > 0) HEURISTICS_USAGE.andAll = true;
    if (entry.notAny && entry.notAny.length > 0) HEURISTICS_USAGE.notAny = true;
    if (entry.notAll && entry.notAll.length > 0) HEURISTICS_USAGE.notAll = true;
    if (HEURISTICS_USAGE.andAny && HEURISTICS_USAGE.andAll && HEURISTICS_USAGE.notAny && HEURISTICS_USAGE.notAll) {
        break; // All found, no need to scan further
    }
}


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
  const hit = isAlwaysOn(e1) || getKW(e1).some(kw => hasTerm(last, kw)) || arr(e1['prev.keywords']).some(kw => hasTerm(prev, kw));
  if (!hit) continue;
  if (!entryPasses(e1, undefined)) { dbg(`filtered entry[${i1}]`); continue; }
  buckets[prio(e1)].push(i1);
  picked[i1] = 1;
  const trg1 = getTrg(e1);
  for (const tag of trg1) {
    addTag(trigSet, tag);
  }
  dbg(`hit entry[${i1}] p=${prio(e1)}`);
}

// --- 2) Trigger pass ---------------------------------------------------------
for (const [i2, e2] of _ENGINE_LORE.entries()) {
  if (picked[i2]) continue;
  if (!(e2 && e2.tag && hasTag(trigSet, e2.tag))) continue;
  if (!entryPasses(e2, trigSet)) { dbg(`filtered triggered entry[${i2}]`); continue; }
  buckets[prio(e2)].push(i2);
  picked[i2] = 1;
  const trg2 = getTrg(e2);
  for (const tag of trg2) {
    addTag(trigSet, tag);
  }
  dbg(`triggered entry[${i2}] p=${prio(e2)}`);
}

// --- 3) Priority selection (capped) -----------------------------------------
const selected = [];
let pickedCount = 0;
const __APPLY_LIMIT = (typeof APPLY_LIMIT === "number" && APPLY_LIMIT >= 1) ? APPLY_LIMIT : 99999;

for (let p = 5; p >= 1 && pickedCount < __APPLY_LIMIT; p--) {
  const bucket = buckets[p];
  for (const item of bucket) {
    if (pickedCount >= __APPLY_LIMIT) break;

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
if (pickedCount === __APPLY_LIMIT) dbg("APPLY_LIMIT reached");

/* ============================================================================
   [SECTION] APPLY + SHIFTS + POST-SHIFT
   DO NOT EDIT: Behavior-sensitive
   ========================================================================== */
//#region APPLY_AND_SHIFTS
let bufP = "";
let bufS = "";

for (const idx of selected) {
  const e3 = _ENGINE_LORE[idx];
  if (e3 && e3.personality) bufP += `\n\n${e3.personality}`;
  if (e3 && e3.scenario)    bufS += `\n\n${e3.scenario}`;
  if (!(e3 && Array.isArray(e3.Shifts) && e3.Shifts.length)) continue;

  for (const sh of e3.Shifts) {
    const activated = isAlwaysOn(sh) || getKW(sh).some(kw => hasTerm(last, kw)) || arr(sh['prev.keywords']).some(kw => hasTerm(prev, kw));
    if (!activated) continue;

    const trgSh = getTrg(sh);
    for (const tag of trgSh) {
      addTag(postShiftTrigSet, tag);
    }

    if (!entryPasses(sh, trigSet)) { dbg("shift filtered"); continue; }

    if (sh.personality) bufP += `\n\n${sh.personality}`;
    if (sh.scenario)    bufS += `\n\n${sh.scenario}`;
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
  if (!entryPasses(e4, unionTags)) { dbg(`post-filter entry[${i3}]`); continue; }
  if (e4.personality) bufP += `\n\n${e4.personality}`;
  if (e4.scenario)    bufS += `\n\n${e4.scenario}`;
  dbg(`post-shift triggered entry[${i3}] p=${prio(e4)}`);
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
        bufP += `\n\n${injectionObj.injection}`;
    }
}

/* ============================================================================
   [SECTION] FLUSH
   DO NOT EDIT: Behavior-sensitive
   ========================================================================== */
//#region FLUSH
if (bufP) context.character.personality += bufP;
if (bufS) context.character.scenario    += bufS;