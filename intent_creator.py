import pandas as pd
import numpy as np
import re
import csv
import os
from sklearn.linear_model import LogisticRegression
from sklearn.utils import resample
from sklearn.feature_extraction.text import TfidfTransformer

# ==========================================
# CONFIGURATION
# ==========================================
# The 8 Gates of EIDOS
TARGETS = [
    "question",   # Gate 1: Inquiry
    "disclosure", # Gate 2: Inform/Statement
    "directive",  # Gate 3: Command
    "commissive", # Gate 4: Agree/Promise
    "conflict",   # Gate 5: Anger/Disagreement
    "phatic",     # Gate 6: Small talk/Greetings
    "meta",       # Gate 7: OOC/System commands
    "narrative"   # Gate 8: Action/Roleplay descriptions
]

HASH_SIZE = 8192 # Fits comfortably in 9-gate budget
SAMPLES_PER_CLASS = 4000
SYNTHETIC_AMPLIFICATION = 50 

# PATHS (Adjusted to your tree.txt structure)
PATH_DD_TXT = "data/DailyDialogue/dialogues_train.txt"
PATH_DD_ACT = "data/DailyDialogue/dialogues_act_train.txt"
PATH_DD_EMO = "data/DailyDialogue/dialogues_emotion_train.txt"
PATH_PERSONA = "data/PersonaChat/personality.csv"

# ==========================================
# 1. SYNTHETIC DICTIONARIES (For gaps in data)
# ==========================================
SYNTHETICS = {
    # GATE 1: INQUIRY (The User wants an answer)
    "question": [
        "what", "where", "when", "who", "why", "how", "?", 
        "can you", "could you", "would you", "should i", "may i",
        "is it", "are you", "do you", "did you", "will you", "won't you",
        "which one", "whose", "whom", "tell me", "explain to me", "describe",
        "answer me", "asking you", "inquire", "curious about", "i wonder",
        "anyone here", "anything else", "guess what", "suppose", "imagine if",
        "what if", "how come", "details", "elaborate"
    ],

    # GATE 2: DISCLOSURE (The User is dumping lore/facts/story)
    "disclosure": [
        "i think", "i believe", "i feel", "i saw", "i heard", "i know",
        "it is", "i am", "you are", "they are", "we are", "there is",
        "once upon a time", "years ago", "yesterday", "tomorrow", "history",
        "the truth is", "actually", "basically", "literally", "specifically",
        "my name is", "i work as", "i live in", "my backstory", "the lore",
        "happened", "occurred", "went to", "came from", "took the",
        "because", "since", "therefore", "however", "although"
    ],

    # GATE 3: DIRECTIVE (The User is giving orders)
    "directive": [
        "go", "stop", "come", "give", "take", "shut up", "listen", "obey", "do this",
        "stand up", "sit down", "kneel", "bow", "stay here", "leave me", "help me",
        "kill him", "attack", "defend", "follow me", "lead the way", "open it",
        "close it", "start", "end this", "finish it", "complete the", "continue",
        "wear this", "remove that", "eat", "drink", "sleep", "wake up", "hurry up",
        "silence", "quiet", "don't speak", "get out", "get lost", "hands off",
        "let go", "back off", "look at me", "watch out", "tell me", "say it",
        "bring me", "fetch", "find it", "hide", "run", "wait"
    ],

    # GATE 4: COMMISSIVE (The User agrees/promises/submits)
    "commissive": [
        "yes", "okay", "sure", "i will", "promise", "agreed", "deal", "fine",
        "yeah", "yep", "yup", "alright", "correct", "right", "true", "exactly",
        "definitely", "absolutely", "certainly", "indeed", "of course", "no problem",
        "will do", "understood", "copy that", "pledge", "swear", "vow", "guarantee",
        "assure you", "bet on it", "accept", "consent", "comply", "i obey",
        "submit", "yield", "surrender", "at your service", "as you wish"
    ],

    # GATE 5: CONFLICT (The User is hostile/refusing)
    "conflict": [
        "hate", "liar", "stupid", "idiot", "shut up", "no", "wrong", "enemy", "fight",
        "die", "kill", "attack", "refuse", "never", "worst", "terrible", "garbage",
        "furious", "livid", "angry", "mad", "pissed", "rage", "outraged", "resent",
        "hostile", "bitter", "moron", "imbecile", "jerk", "asshole", "bitch",
        "bastard", "pathetic", "useless", "incompetent", "trash", "filth", "repulsive",
        "disgusting", "gross", "revolting", "vile", "sickening", "cheat", "fake",
        "fraud", "hypocrite", "punch", "hit", "smack", "beat", "destroy", "smash",
        "break", "strangle", "hurt", "kick", "slap", "shoot", "stab", "violence",
        "violent", "dead meat", "regret", "screw you", "damn", "fuck", "shitty"
    ],

    # GATE 6: PHATIC (Small talk/Social Glue)
    "phatic": [
        "hi", "hello", "hey", "good morning", "good night", "bye", "see ya", "thanks",
        "cool", "wow", "oh", "ah", "haha", "lol", "nice", "okay then",
        "greetings", "welcome", "good afternoon", "good evening", "farewell",
        "goodbye", "later", "cya", "thank you", "appreciate it", "pleasure",
        "meet you", "howdy", "sup", "yo", "hmm", "umm", "well...", "so...",
        "anyway", "no worries", "you're welcome", "bless you"
    ],

    # GATE 7: META (OOC/System Instructions)
    "meta": [
        "(ooc:", "(OOC:", "[system]", "scenario:", "prompt:", "ignore previous",
        "write a", "generate", "character definition", "pause rp", "skip to",
        "out of character", "your llm", "ai model", "((", "))", "//", "instruction:",
        "developer", "openai", "anthropic", "gpt", "bot", "assistant", "language model",
        "jailbreak", "nsfw", "sfw", "trigger warning", "content warning", "summary",
        "recap", "rewrite", "edit", "continue", "stop generating", "memory", "token",
        "context", "remember that", "reminder", "note:"
    ],

    # GATE 8: NARRATIVE (Roleplay Actions/Descriptions)
    "narrative": [
        "*looks*", "*walks*", "*smiles*", "*sighs*", "*takes*", "*grabs*",
        "he walked", "she said", "they went", "the room was", "suddenly",
        "meanwhile", "later", "eyes", "hands", "door", "window",
        "*nods*", "*shakes*", "*leans*", "*whispers*", "*shouts*", "*runs*",
        "*jumps*", "*sits*", "*stands*", "*laughs*", "*cries*", "*thinks*",
        "*remembers*", "sun", "moon", "sky", "ground", "floor", "wall", "ceiling",
        "table", "chair", "bed", "light", "dark", "shadow", "sound", "silence",
        "voice", "noise", "smell", "scent", "felt", "saw", "heard", "touched",
        "tasted", "air", "wind", "rain", "fire", "water", "corridor", "hallway"
    ]
}

# ==========================================
# 2. UTILITIES
# ==========================================
STOP_WORDS = set(["a", "an", "the", "and", "but", "if", "or", "as", "of", "at", "by", "for", "with", "is", "it", "to"])

def stem(w):
    # Simple stemmer to match the JS runtime one
    if len(w) < 4: return w
    if w.endswith("ies"): return w[:-3] + "y"
    if w.endswith("es"): return w[:-2]
    if w.endswith("s") and not w.endswith("ss"): return w[:-1]
    if w.endswith("ing"): return w[:-3]
    if w.endswith("ed"): return w[:-2]
    return w

def advanced_clean(text):
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s]', '', text)
    tokens = text.split()
    tokens = [stem(t) for t in tokens if t not in STOP_WORDS and len(t) > 2]
    return " ".join(tokens)

# ==========================================
# 3. DATA LOADERS
# ==========================================
data_pool = []

# --- LOAD DAILY DIALOGUE (Acts & Emotions) ---
# Acts: 1=Inform(Disclosure), 2=Question, 3=Directive, 4=Commissive
# Emotions: 0=Neutral, 1=Anger, 2=Disgust, ...
try:
    print(f"Loading DailyDialogue...")
    with open(PATH_DD_TXT, 'r', encoding='utf-8') as ft, \
         open(PATH_DD_ACT, 'r', encoding='utf-8') as fa, \
         open(PATH_DD_EMO, 'r', encoding='utf-8') as fe:
        
        lines_txt = ft.readlines()
        lines_act = fa.readlines()
        lines_emo = fe.readlines()
        
        for l_t, l_a, l_e in zip(lines_txt, lines_act, lines_emo):
            parts_t = l_t.strip().split('__eou__')
            parts_a = l_a.strip().split(' ')
            parts_e = l_e.strip().split(' ')
            
            for t, a, e in zip(parts_t, parts_a, parts_e):
                if len(t) < 2: continue
                text = t.strip()
                
                # MAP ACTS
                if a == '1': 
                    # Act 1 is "Inform", but we want to split it. 
                    # If it's short & neutral -> Phatic. Else -> Disclosure.
                    if e == '0' and len(text.split()) < 6:
                        data_pool.append({'text': text, 'label': 'phatic'})
                    else:
                        data_pool.append({'text': text, 'label': 'disclosure'})
                elif a == '2': data_pool.append({'text': text, 'label': 'question'})
                elif a == '3': data_pool.append({'text': text, 'label': 'directive'})
                elif a == '4': data_pool.append({'text': text, 'label': 'commissive'})
                
                # MAP EMOTIONS (Override Acts if strong emotion)
                if e == '1' or e == '2': # Anger or Disgust
                    data_pool.append({'text': text, 'label': 'conflict'})

except Exception as e:
    print(f"[ERROR] DailyDialogue Load Failed: {e}")

# --- LOAD PERSONA CHAT (For Disclosure Augmentation) ---
try:
    print(f"Loading PersonaChat...")
    df_p = pd.read_csv(PATH_PERSONA)
    # The 'Persona' column contains sentences like "I like to hunt." -> Great for Disclosure
    for _, row in df_p.iterrows():
        personas = str(row['Persona']).split('.')
        for p in personas:
            if len(p) > 5:
                data_pool.append({'text': p, 'label': 'disclosure'})
except Exception as e:
    print(f"[ERROR] PersonaChat Load Failed: {e}")

# ==========================================
# 4. INJECTION & BALANCING
# ==========================================
print(f"Injecting Synthetics...")
for label, phrases in SYNTHETICS.items():
    for p in phrases:
        clean = advanced_clean(p)
        if clean:
            for _ in range(SYNTHETIC_AMPLIFICATION):
                data_pool.append({'text': p, 'label': label})

df_raw = pd.DataFrame(data_pool)
df_raw['clean_text'] = df_raw['text'].apply(advanced_clean)
df_raw = df_raw[df_raw['clean_text'].str.len() > 0]

print(f"Balancing Classes ({SAMPLES_PER_CLASS} per class)...")
balanced_dfs = []
for target in TARGETS:
    df_class = df_raw[df_raw['label'] == target]
    if len(df_class) == 0:
        print(f"!! WARNING: No data for {target}")
        continue
    df_res = resample(df_class, replace=True, n_samples=SAMPLES_PER_CLASS, random_state=42)
    balanced_dfs.append(df_res)

df_final = pd.concat(balanced_dfs)
print(f"Final Training Set: {len(df_final)} samples.")

# ==========================================
# 5. VECTORIZATION & TRAINING
# ==========================================
def fnv1a_32_js(text):
    h = 2166136261
    for char in text:
        h ^= ord(char)
        h = (h * 16777619) & 0xFFFFFFFF
    return h

def vectorizer_fnv(text_list, hash_size):
    matrix = np.zeros((len(text_list), hash_size), dtype=np.float32)
    for i, text in enumerate(text_list):
        tokens = text.split()
        for token in tokens:
            idx = fnv1a_32_js(token) % hash_size
            matrix[i, idx] += 1
    return matrix

print("Vectorizing...")
X = vectorizer_fnv(df_final['clean_text'].tolist(), HASH_SIZE)
y = df_final['label']

print("Training Gates...")
models_out = {}

for target in TARGETS:
    print(f"  Training [{target}]...")
    y_binary = (y == target).astype(int)
    clf = LogisticRegression(solver='liblinear', penalty='l2', C=1.0, class_weight='balanced')
    clf.fit(X, y_binary)
    
    # Quantize Weights to 4-bit (0-15) for Atomic Fragmentation
    w = clf.coef_[0]
    # Simple quantization: Map -max..+max to 0..15
    w_min, w_max = np.min(w), np.max(w)
    w_range = w_max - w_min if (w_max - w_min) > 0 else 1.0
    
    # Normalize to 0.0 - 1.0
    w_norm = (w - w_min) / w_range
    # Map to 0-15 integer
    w_int = np.round(w_norm * 15).astype(int)
    
    # Pack into string string
    # Alphabet for 0-15: A-P
    alphabet = "ABCDEFGHIJKLMNOP"
    w_str = "".join([alphabet[val] for val in w_int])
    
    # Store Metadata
    models_out[target] = {
        "bias": clf.intercept_[0],
        "min": w_min,
        "range": w_range,
        "weights": w_str
    }

# ==========================================
# 6. EXPORT (ATOMIC FRAGMENTATION)
# ==========================================
print("Exporting to JS...")
js_out = "// EIDOS INTENT ENGINE (DailyDialogue + PersonaChat)\n"
js_out += f"var EIDOS_HASH = {HASH_SIZE};\n\n"

# Export function wrapper
js_out += "function getEidosData() {\n  return {\n"

for target, data in models_out.items():
    # Split the massive weight string into 1000-char chunks
    full_str = data['weights']
    chunks = [full_str[i:i+1000] for i in range(0, len(full_str), 1000)]
    
    js_out += f"    '{target}': {{\n"
    js_out += f"      b: {data['bias']:.4f}, min: {data['min']:.4f}, r: {data['range']:.4f},\n"
    js_out += "      w: [\n"
    for chunk in chunks:
        js_out += f"        '{chunk}',\n"
    js_out += "      ]\n    },\n"

js_out += "  };\n}\n"

with open("EIDOS_Sister_Script.js", "w") as f:
    f.write(js_out)

print("DONE. File saved as 'EIDOS_Sister_Script.js'.")