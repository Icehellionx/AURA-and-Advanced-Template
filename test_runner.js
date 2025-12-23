"use strict";

// test_runner.js
// Simple harness to load main_logic.js and run a set of test messages through it.

const fs = require("fs");
const vm = require("vm");

// ============================================================
// TOGGLES
// ============================================================

// If true, pass a history array (last_messages) into context.chat.
// If false, only the current message is considered.
const USE_MULTI_MESSAGE = false;

// If using multi-message, decide whether to alternate roles (user/bot).
// - If false: every message in history is marked isUser: true.
// - If true: messages alternate isUser: true / false / true / false...
const USE_ALTERNATING_ROLES = false;

// Path to your main logic / engine script
const ENGINE_PATH = "./v14.js";

// ============================================================
// Load engine code
// ============================================================
const code = fs.readFileSync(ENGINE_PATH, "utf8");

// ============================================================
// Test messages
// ============================================================
const testMessagesRelational = [
// --- GROUP A: THE "PATCH" VALIDATION (Logic Gates) ---
    // 1. VOMIT PATCH: High Disgust (S5) must KILL Lust/Romance.
    // Testing: "Sick", "Repulsive", physical aversion.
    "I think I'm going to be sick looking at that.",
    "Get away from me, you smell repulsive.",

    // 2. SALT PATCH: Mundane questions must NOT trigger S6/S10.
    // Testing: "Borrow", "Time", boring logistics.
    "Do you have a pen I could borrow?",
    "What time does the train leave?",

    // 3. BRO ZONE: "Dude/Buddy" must KILL Romance/Lust.
    // Testing: Platonic markers.
    "Thanks dude, you're a lifesaver.",
    "You're like the brother I never had.",

    // 4. RESIGNATION: "Giving up" must KILL Anger.
    // Testing: Low energy, defeat.
    "Fine, have it your way, I don't care anymore.",
    "It doesn't matter what I do, so I give up.",

    // --- GROUP B: THE NORMALIZATION CHECK (Vocab Generalization) ---
    // 5. IRREGULAR VERBS & TENSES.
    // Testing: "Bought" (Buy), "Thought" (Think) - ensuring semantic understanding.
    "I bought this specifically for you.",
    "I thought you were someone else for a second.",

    // 6. CONTRACTIONS & NEGATIVES.
    // Testing: "Shouldn't", "Wouldn't".
    "You shouldn't be here right now.",
    "I wouldn't do that if I were you.",

    // 7. SYNONYMS (High Intensity).
    // Testing: "Livid" (Anger), "Petrified" (Fear).
    "I am absolutely livid right now!",
    "I'm petrified to even move a muscle.",

    // --- GROUP C: THE 12-HEAD SPECTRUM (Raw Signals) ---
    // 8. PRIMAL DRIVES (Lust S7 vs Romance S8).
    // Testing: Physical urgency vs Emotional future.
    "Stop talking and take your clothes off.", // Explicit Lust
    "I can't imagine a future without you in it.", // Deep Romance

    // 9. POWER DYNAMICS (Dominance S9 vs Comfort S10).
    // Testing: Command vs Soothing.
    "Get on the floor and wait for my instruction.", // Dominance
    "Shh, it's okay, I've got you now.", // Comfort

    // 10. DARK TRIAD (Deception S12 vs Regret S11).
    // Testing: Denial vs Guilt.
    "I never saw that email, it must have gone to spam.", // Deception
    "I feel terrible about what I said yesterday.", // Regret

    // --- GROUP D: COMPLEX SYNTHESIS (The "Mixer") ---
    // 11. HATE-SEX (Anger S3 + Lust S7).
    // Testing: Conflict + Desire keywords.
    "You are so annoying, get over here.",
    "I want to strangle you and kiss you at the same time.",

    // 12. BANTER / TSUNDERE (Joy S1 + Anger S3).
    // Testing: Playful insults.
    "I hate how funny you think you are.",
    "You're such a brat, but I guess I'll keep you.",

    "I am so happy you are here.",

    "Don't ever stop loving me",

    "You are a wonderful person.",
];

// ============================================================
// Helper: build last_messages array
// ============================================================
function buildLastMessages(allMessages, currentIndex) {
  if (!USE_MULTI_MESSAGE) {
    // Only current message as a single-entry history, or none if you prefer to ignore history.
    return [];
  }

  const slice = allMessages.slice(0, currentIndex + 1);

  if (!USE_ALTERNATING_ROLES) {
    // Every message treated as user
    return slice.map(m => ({ message: m, isUser: true }));
  }

  // Alternate user/bot roles for debugging more realistic logs
  return slice.map((m, i) => ({
    message: m,
    isUser: i % 2 === 0 // even indexes: user, odd: bot
  }));
}

// ============================================================
// Run each message through the engine
// ============================================================
testMessagesRelational.forEach((msg, idx) => {
  const lastMessages = buildLastMessages(testMessagesRelational, idx);

  // Context for this test case
  let context = {
    chat: {
      last_message: msg,
      last_messages: lastMessages,
      message_count: USE_MULTI_MESSAGE ? lastMessages.length : 1,
      multi_depth_enabled: USE_MULTI_MESSAGE
    },
    character: {
      name: "",
      personality: "",
      scenario: "",
      example_dialogues: ""
    }
  };

  // Capture AURA's console output per test case
  const auraLogs = [];
  const auraConsole = {
    log: (...args) => {
      const line = args.map(a => String(a)).join(" ");
      auraLogs.push(line);
    },
    error: (...args) => {
      const line = args.map(a => String(a)).join(" ");
      auraLogs.push("[ERROR] " + line);
    },
    warn: (...args) => {
      const line = args.map(a => String(a)).join(" ");
      auraLogs.push("[WARN] " + line);
    }
  };

  const sandbox = { context, console: auraConsole, Math, Buffer };
  vm.createContext(sandbox);

  // Print header & input FIRST
  console.log("\n=== Test Case " + (idx + 1) + " ===");
  console.log("Input:", msg);

  // Run engine for this test
  try {
    vm.runInContext(code, sandbox);
  } catch (e) {
    auraLogs.push("[AURA ERROR] " + e.message);
  }

  // Now print AURA logs neatly inside the test block
  if (auraLogs.length > 0) {
    auraLogs.forEach(line => console.log(line));
  }

  // Then print final scenario/personality/example from context
  const personality = sandbox.context.character.personality || "";
  const scenario = sandbox.context.character.scenario || "";
  const example = sandbox.context.character.example_dialogues || "";

  console.log("Personality:", personality || "(none)");
  console.log("Scenario:", scenario || "(none)");
  console.log("Example Dialogues:", example || "(none)");
});
