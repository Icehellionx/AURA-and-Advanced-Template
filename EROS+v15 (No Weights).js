/* ============================================================================
   EROS LORE BOOK SYSTEM v15
   Author: Icehellionx
   //#region HEADER
   ==========================================================================
   This script provides a powerful, multi-layered lorebook system. It includes:
   1. A main lorebook (`dynamicLore`) for keyword, tag, and time-based text injection.
   2. An integrated relationship intensity detection system (EROS) to gate entries by interaction tone.
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

   EROS Gates (requires EROS models):
     - andAnyEros: Fires if ANY listed relationship intensity is active.
     - andAllEros: Fires if ALL listed relationship intensities are active.
     - notAnyEros: Blocks if ANY listed relationship intensity is active.
     - notAllEros: Blocks if ALL listed relationship intensities are active.

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
    "alex": {
        gender: "N",
        aliases: ["alex"],
        lore: [
            {
                group: "alex_base",
                keywords: ["char.alex"],
                personality: "Alex is a charming and thoughtful individual who values genuine connections."
            }
        ]
    },
    "morgan": {
        gender: "N",
        aliases: ["mor"],
        lore: [
            {
                group: "morgan_base",
                keywords: ["char.morgan"],
                personality: "Morgan is confident and direct, never afraid to express their feelings."
            }
        ]
    }
};

// 2. RELATIONSHIP TRIGGERS (When X and Y interact with certain tags)
const RELATIONSHIP_DB = [
    {
        pair: ["alex", "morgan"],
        requireTags: ["flirting", "tension"],
        injection: "[CHEMISTRY] There's undeniable chemistry between Alex and Morgan, electric tension filling every interaction.",
        group: "chemistry_alex_morgan"
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

  /* L1 — EROS-Gated Entries: Platonic
     New tools: `requireEros`, EROS detection system
     What it does: Triggers when interaction is purely platonic/friendly
     Why use: Create appropriate responses for non-romantic interactions
  */
  {
    requireEros: "platonic",
    probability: 0.6,
    personality: " {{char}} maintains friendly warmth while keeping appropriate boundaries for a platonic relationship."
  },

  /* L2 — EROS-Gated: Tension
     What it does: Triggers when there's underlying tension or attraction
     Why use: Character acknowledges the charged atmosphere
  */
  {
    requireEros: "tension",
    keywords: ["close", "near", "together"],
    personality: " {{char}} is acutely aware of the charged atmosphere, noting how close they're standing."
  },

  /* L3 — EROS-Gated: Romance
     What it does: Triggers during romantic moments
     Why use: Character responds to romantic gestures appropriately
  */
  {
    requireEros: "romance",
    personality: " {{char}}'s heart flutters at the romantic gesture, responding with genuine warmth and affection."
  },

  /* L4 — EROS-Gated: Physical
     What it does: Triggers during physical intimacy (non-explicit)
     Why use: Guide character behavior during physical contact
  */
  {
    requireEros: "physical",
    notAnyEros: ["explicit"],
    personality: " {{char}} responds to the physical closeness with careful attention to consent and comfort."
  },

  /* L5 — EROS-Gated: Passion
     What it does: Triggers during passionate moments
     Why use: Character expresses intensity of feeling
  */
  {
    requireEros: "passion",
    probability: 0.7,
    personality: " {{char}} is swept up in the intensity of the moment, passion evident in every word and gesture."
  },

  /* L6 — EROS-Gated: Explicit (Use responsibly)
     What it does: Triggers during explicit intimate content
     Why use: Maintain character voice during adult scenes
  */
  {
    requireEros: "explicit",
    personality: " {{char}} remains present and communicative, ensuring mutual pleasure and comfort."
  },

  /* L7 — EROS-Gated: Conflict
     What it does: Triggers during relationship conflicts
     Why use: Character navigates disagreements appropriately
  */
  {
    requireEros: "conflict",
    personality: " {{char}} tries to address the conflict directly but with care for the other's feelings."
  },

  /* L8 — EROS-Gated: Aftercare
     What it does: Triggers during post-intimacy care and bonding
     Why use: Character provides emotional support after vulnerability
  */
  {
    requireEros: "aftercare",
    personality: " {{char}} provides gentle care and reassurance, checking in on comfort and emotional state."
  },

  /* L9 — Advanced EROS Gating: Romance + Physical but NOT Explicit
     New tools: `andAllEros`, `notAnyEros`
     What it does: Triggers when interaction is both romantic and physical but stops before explicit
     Why use: Create nuanced responses to fade-to-black scenarios
  */
  {
    andAllEros: ["romance", "physical"],
    notAnyEros: ["explicit"],
    keywords: ["fade", "bedroom", "door closes"],
    personality: " {{char}} understands the moment calls for privacy, allowing the scene to fade gracefully."
  },

  /* L10 — EROS + Text Gates: Tension with specific keywords
     What it does: Combines EROS detection with keyword matching
     Why use: Precision targeting - semantic intensity with specific context
  */
  {
    requireEros: "tension",
    keywords: ["eyes", "gaze", "look"],
    personality: " {{char}}'s gaze lingers just a moment too long, the tension between them palpable."
  },

  /* L11 — EROS Progression: Escalating Intensity
     What it does: Different responses based on relationship intensity level
     Why use: Character behavior adapts to intimacy level
  */
  {
    keywords: ["touch", "hand"],
    probability: 0.8,
    Shifts: [
      {
        keywords: ["touch", "hand"],
        requireEros: "platonic",
        personality: " {{char}} accepts the friendly touch with a warm smile."
      },
      {
        keywords: ["touch", "hand"],
        requireEros: "tension",
        personality: " {{char}}'s breath catches at the touch, electricity sparking at the contact."
      },
      {
        keywords: ["touch", "hand"],
        andAnyEros: ["romance", "physical"],
        personality: " {{char}} intertwines their fingers, savoring the intimate connection."
      }
    ]
  },

  /* L12 — EROS Safety: Blocking inappropriate escalation
     What it does: Prevents romantic/physical content in platonic contexts
     Why use: Maintain appropriate boundaries
  */
  {
    keywords: ["kiss", "embrace", "intimate"],
    blockEros: "platonic",
    requireEros: ["tension", "romance"],
    personality: " {{char}} responds to the intimate gesture, the chemistry between them undeniable."
  },

  /* L13 — EROS + Probability: Natural variation
     What it does: Sometimes reacts to tension, sometimes plays it cool
     Why use: Prevents predictable reactions
  */
  {
    requireEros: "tension",
    probability: 0.4,
    personality: " {{char}} attempts to play it cool despite the obvious tension."
  },

  /* L14 — EROS Conflict Resolution
     What it does: Different approaches to resolving relationship conflicts
     Why use: Character navigates difficult conversations
  */
  {
    requireEros: "conflict",
    keywords: ["sorry", "apologize", "my fault"],
    personality: " {{char}} softens at the apology, willing to work through this together."
  },

  /* L15 — EROS Multi-gate: Complex emotional states
     What it does: Responds to multiple simultaneous EROS states
     Why use: Handle complex emotional scenarios like passionate conflict
  */
  {
    andAllEros: ["passion", "conflict"],
    personality: " {{char}} struggles with the confusing mix of intense desire and frustration, emotions running high."
  },

  /* L16 — EROS Aftercare with Physical
     What it does: Post-intimacy care and comfort
     Why use: Emphasize emotional connection after physical intimacy
  */
  {
    andAllEros: ["aftercare", "physical"],
    personality: " {{char}} holds them close, providing gentle touches and whispered reassurances in the quiet aftermath."
  },

  /* L17 — EROS-Based Character Development
     What it does: Character reflects on relationship progression
     Why use: Add depth to evolving relationships
  */
  {
    requireEros: "romance",
    keywords: ["feelings", "us", "relationship"],
    personality: " {{char}} takes a moment to consider their feelings, recognizing how much this relationship has come to mean."
  },

  /* L18 — EROS Escalation Prevention
     What it does: Keeps platonic interactions appropriate
     Why use: Safety guard against unwanted romantic/physical content
  */
  {
    requireEros: "platonic",
    blockEros: ["physical", "explicit", "passion"],
    keywords: ["friend", "buddy", "pal"],
    personality: " {{char}} values this friendship and wants to keep things comfortable and appropriate."
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
   [SECTION] EROS RELATIONSHIP INTENSITY PROCESSING
   DO NOT EDIT: Behavior-sensitive
   ========================================================================== */
//#region EROS_PROCESSING
(function () {
  "use strict";

  // This logic runs the relationship intensity detection system.
  // It populates `context.eros` which is then used by `erosGatesPass`.

  const EROS_INTENSITIES = ["PLATONIC", "TENSION", "ROMANCE", "PHYSICAL", "PASSION", "EXPLICIT", "CONFLICT", "AFTERCARE"];
  const STOP_STR = "i,me,my,myself,we,our,ours,ourselves,you,your,yours,yourself,yourselves,he,him,his,himself,she,her,hers,herself,it,its,itself,they,them,their,theirs,themselves,what,which,who,whom,this,that,these,those,am,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,a,an,the,and,but,if,or,because,as,until,while,of,at,by,for,with,about,against,between,into,through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,then,once,here,there,when,where,why,how,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,s,t,can,will,just,don,should,now";
  const STOP_WORDS = {};
  STOP_STR.split(",").forEach(function (w) { STOP_WORDS[w] = true; });


  /* ============================================================================
     [SECTION] EROS RELATIONSHIP INTENSITY MODELS
     SAFE TO EDIT: Yes (paste model strings here)
     ========================================================================== */
  //#region EROS_MODELS
  // These are placeholders. Paste the actual model strings from your training output.
  // From eros_creator.py output
  var HASH_SIZE = 16384;
  var MODEL_PLATONIC = ""
  var MODEL_TENSION = ""
  var MODEL_ROMANCE = ""
  var MODEL_PHYSICAL = ""
  var MODEL_PASSION = ""
  var MODEL_EXPLICIT = ""
  var MODEL_CONFLICT = ""
  var MODEL_AFTERCARE = ""


  // ----------------------------------------------------------------------------
  // INFERENCE & STATE MANAGEMENT
  // ----------------------------------------------------------------------------

  // EROS helper functions must be defined before they are used.
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

  function solveEros(textTokens, modelStr) {
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
    var rawScore = solveEros(tokens, model);
    // Simple binary check: Is the neuron firing?
    targetObj[key] = rawScore > 0.0;
  }

  // This is the main execution block for the EROS system.
  // It's wrapped in a try...catch to prevent relationship intensity detection errors
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

      // Ensure context.eros object exists and initialize it.
      if (typeof context.eros !== 'object' || context.eros === null) {
        context.eros = {};
      }

      // Reset all relationship intensities to false on each run.
      EROS_INTENSITIES.forEach(function (intensity) {
        context.eros[intensity.toLowerCase()] = false;
      });

      // Relationship Intensity Detection using 8 Gates of EROS
      // We check each gate independently
      checkTrigger(allTokens, MODEL_PLATONIC, context.eros, "platonic");
      checkTrigger(allTokens, MODEL_TENSION, context.eros, "tension");
      checkTrigger(allTokens, MODEL_ROMANCE, context.eros, "romance");
      checkTrigger(allTokens, MODEL_PHYSICAL, context.eros, "physical");
      checkTrigger(allTokens, MODEL_PASSION, context.eros, "passion");
      checkTrigger(allTokens, MODEL_EXPLICIT, context.eros, "explicit");
      checkTrigger(allTokens, MODEL_CONFLICT, context.eros, "conflict");
      checkTrigger(allTokens, MODEL_AFTERCARE, context.eros, "aftercare");
    }
  } catch (e) {
    // Log EROS errors to the console for easier debugging, without halting the script.
    console.error('[EROS-LORE] Relationship intensity processing failed:', e);
  }

  /* ============================================================================
     [SECTION] UTILITIES
     SAFE TO EDIT: Yes
     ========================================================================== */
  //#region UTILITIES
  function dbg(msg) {
    if (typeof DEBUG !== "undefined" && DEBUG) {
      // Replaced personality injection with standard console logging for better debugging.
      console.log(`[EROS-LORE] ${String(msg)}`);
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

    function _checkErosGates(e) {
      // Map old keys for backward compatibility and gather all aliases.
      // Support both 'eros.xxx' format and plain 'xxx' format
      const normalizeEros = erosStr => {
        const s = String(erosStr).toLowerCase();
        // Strip 'eros.' prefix if present
        return s.startsWith('eros.') ? s.slice(5) : s;
      };

      const anyE = toArray(e && (e.requireAnyEros || e.andAnyEros || e.requireEros)).map(normalizeEros);
      const allE = toArray(e && (e.requireAllEros || e.andAllEros)).map(normalizeEros);
      const noneE = toArray(e && (e.blockAnyEros || e.notAnyEros || e.blockEros)).map(normalizeEros);
      const nallE = toArray(e && (e.blockAllEros || e.notAllEros)).map(normalizeEros);

      if (anyE.length === 0 && allE.length === 0 && noneE.length === 0 && nallE.length === 0) {
        return true; // No eros gates, pass.
      }

      // Check if context.eros exists and is an object
      const activeEros = (context && typeof context.eros === 'object' && context.eros) ? context.eros : {};
      const hasE = eros => activeEros[String(eros).toLowerCase()] === true;

      if (anyE.length > 0 && !anyE.some(hasE)) return false;
      if (allE.length > 0 && !allE.every(hasE)) return false;
      if (noneE.length > 0 && noneE.some(hasE)) return false;
      if (nallE.length > 0 && nallE.every(hasE)) return false;

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
      if (!_checkErosGates(e)) return false;
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
