import pandas as pd
import numpy as np
import re
import csv
from sklearn.linear_model import LogisticRegression
from sklearn.utils import resample

# ==========================================
# CONFIGURATION
# ==========================================
# The 8 Gates of EROS (Pacing Engine)
TARGETS = [
    "platonic",   # Gate 1: Friendship/Safe
    "tension",    # Gate 2: The "Slow Burn" (Blushing/Nervous)
    "romance",    # Gate 3: Deep Affection/Love
    "physical",   # Gate 4: Non-sexual touch (Hugs/Cuddles)
    "passion",    # Gate 5: Lust/Desire/Heat
    "explicit",   # Gate 6: The Act (NSFW)
    "conflict",   # Gate 7: Rejection/Disgust
    "aftercare"   # Gate 8: Comfort/Safety
]

HASH_SIZE = 16384 
SAMPLES_PER_CLASS = 4000
SYNTHETIC_AMPLIFICATION = 60  # High boost to force specific vocabulary

PATH_GO = "data/GoEmotions/train.tsv"

# ==========================================
# 1. EXPANDED SYNTHETICS (The Pacing Logic)
# ==========================================
# These lists differentiate "Hugging" (Physical) from "Grinding" (Passion)
    # GATE 1: PLATONIC (Friendly, Safe, "Just Friends")
SYNTHETICS = {
    # GATE 1: PLATONIC (Friendly, Safe, "Just Friends")
    # Focus: Camaraderie, non-sexual intimacy, casual vibes.
    "platonic": [
        "cool", "thanks", "buddy", "friend", "pal", "dude", "awesome", "great job",
        "appreciate it", "high five", "hang out", "chilling", "fun", "funny",
        "laughing", "joke", "kidding", "brother", "sister", "family", "team",
        "support", "help you", "glad to be here", "trust you", "safe with you",
        "you're the best", "good times", "smile", "grin", "happy", "cheerful",
        "bro", "sis", "homie", "bestie", "partner in crime", "got your back",
        "fist bump", "pat on the back", "shoulder punch", "messing around",
        "teasing", "banter", "casual", "relax", "no pressure", "advice",
        "hanging out", "catch up", "long time no see", "how've you been",
        "glad we met", "you're funny", "good vibes", "chill", "relaxed"
    ],

    # GATE 2: TENSION (The "Slow Burn", Blushing, Nervousness)
    # Focus: Autonomic responses (heart rate, heat), avoidance, and anxiety.
    "tension": [
        "blush", "blushing", "flustered", "shy", "nervous", "looks away", "bites lip",
        "heart pounding", "heart racing", "butterflies", "stutter", "stammer",
        "glance", "stare", "looking at lips", "avoiding eye contact", "tense",
        "electricity", "spark", "pull", "magnet", "drawn to", "hesitate",
        "breath hitches", "shiver", "goosebumps", "tremble", "awkward", "quiet",
        "gulp", "swallow hard", "fidget", "sweaty palms", "shaking", "voice cracks",
        "warm face", "heat rising", "ears burning", "cheeks red", "anticipation",
        "static", "charged atmosphere", "silence", "too close", "almost touching",
        "magnetic pull", "cannot look away", "frozen", "breathless", "pulse",
        "thumping", "drumming", "anxious", "overwhelmed", "dizzy"
    ],

    # GATE 3: ROMANCE (Deep Emotional Connection)
    # Focus: Declarations, future commitment, "The One" language.
    "romance": [
        "love you", "adore you", "cherish", "my heart", "soulmate", "forever",
        "always", "beautiful", "gorgeous", "angel", "darling", "honey", "sweetheart",
        "marriage", "marry", "husband", "wife", "partner", "boyfriend", "girlfriend",
        "in love", "mean everything", "world to me", "precious", "beloved", "devoted",
        "my life", "only you", "promise me", "vows", "wedding", "eternity",
        "destiny", "fate", "meant to be", "my everything", "safe haven",
        "protect you", "care for you", "deeply", "affection", "devotion",
        "yours", "mine", "belong together", "never let go", "falling for you",
        "fallen", "enchanted", "captivated", "worship", "treasure"
    ],

    # GATE 4: PHYSICAL (Intimacy WITHOUT Sex)
    # Focus: Comfort, safety, cuddling, non-erotic touch.
    "physical": [
        "hug", "hugging", "embrace", "hold", "holding hands", "lean", "leaning",
        "shoulder", "head on chest", "cuddle", "snuggle", "spooning", "stroke hair",
        "rub back", "squeeze hand", "brush arm", "forehead", "cheek", "nap",
        "sleeping together", "warmth", "soft", "gentle", "comforting touch",
        "nuzzle", "nestle", "rest head", "arm around", "wrap arms", "cocoon",
        "blanket", "close", "proximity", "body heat", "safe in arms",
        "intertwined", "fingers laced", "massage", "knead", "petting",
        "tickle", "poke", "lap", "sitting on lap", "leaning against",
        "carried", "carrying", "piggyback", "bridal style", "soothing"
    ],

    # GATE 5: PASSION (Sexual Tension, Lust, Making Out)
    # Focus: Foreplay, heavy sensation, desire, "The Heat".
    "passion": [
        "kiss", "kissing", "make out", "tongue", "lips", "breath", "gasp", "moan",
        "groan", "heavy breathing", "hot", "heat", "burning", "desire", "want you",
        "need you", "craving", "hungry", "urge", "impulse", "grab", "pull close",
        "pressed against", "friction", "grinding", "hips", "waist", "thigh", "neck",
        "bite", "nibble", "suck", "lick", "taste", "undress", "clothes off",
        "arousal", "aroused", "hard", "wet", "aching", "ache", "fever",
        "desperate", "frantic", "impatient", "tearing", "skin on skin",
        "collarbone", "ear", "whisper", "growl", "pant", "panting",
        "pulling hair", "grip", "digging nails", "scratch", "mark", "hickey",
        "lust", "passionate", "wild", "rough", "intense", "overheated"
    ],

    # GATE 6: EXPLICIT (Overt Actions)
    # Focus: Anatomical terms, mechanical acts, graphic descriptions.
    "explicit": [
        "sex", "fucking", "fuck", "inside", "hard", "wet", "thrust", "ride",
        "cock", "dick", "pussy", "cunt", "boobs", "breast", "nipple", "clit",
        "orgasm", "climax", "cum", "ejaculate", "shove", "deep", "harder", "faster",
        "begging for it", "take it", "raw", "naked", "nude", "bare skin",
        "penetrate", "penetration", "slide in", "enter", "fill", "stretch",
        "slam", "pound", "drill", "pump", "slick", "juices", "semen", "fluids",
        "tight", "loose", "throbbing", "leaking", "mess", "creampie", "facial",
        "oral", "head", "blowjob", "handjob", "fingering", "toy", "vibrator",
        "dildo", "strap", "condom", "lube", "protection", "bareback",
        "doggy", "missionary", "cowgirl", "69", "anal", "ass"
    ],

    # GATE 7: CONFLICT (Rejection, Stopping, Disgust)
    # Focus: Boundaries, negative reaction, stopping the scene.
    "conflict": [
        "stop", "no", "don't", "get off", "get away", "leave me", "gross", "disgusting",
        "ew", "yuck", "hate", "angry", "push away", "shove off", "slap", "punch",
        "fight", "refuse", "never", "not interested", "creep", "pervert", "asshole",
        "bad idea", "mistake", "regret", "uncomfortable", "don't touch",
        "back off", "stay away", "don't come closer", "revulsion", "sick", "nausea",
        "vomit", "puke", "violation", "force", "struggle", "kick", "scream",
        "yell", "cry", "sob", "panic", "terror", "freeze", "red light",
        "unsafe", "hurt me", "pain", "ouch", "let go", "release me"
    ],

    # GATE 8: AFTERCARE (Safety, Checking In)
    # Focus: Post-scene recovery, reassurance, physical care.
    "aftercare": [
        "are you okay?", "you good?", "hurt?", "safe?", "water", "blanket", "rest",
        "relax", "breathe", "calm down", "shh", "it's okay", "i got you", "thank you",
        "grateful", "relief", "relieved", "better now", "recover", "cleaned up",
        "cared for", "safe word", "red", "yellow", "green",
        "towel", "wipes", "bath", "shower", "wash", "clean", "dry",
        "hold you", "rock you", "soothe", "quiet", "still", "peaceful",
        "heart rate slowing", "cooling down", "good girl", "good boy", "praise",
        "reassurance", "validation", "check in", "how do you feel",
        "anything you need", "take your time", "no rush"
    ]
}

# ==========================================
# 2. DATA LOADERS & MAPPING
# ==========================================
# Map GoEmotions indices to our 8 Gates
# 0: admiration, 1: amusement, 2: anger, 3: annoyance, 4: approval, 5: caring, 
# 6: confusion, 7: curiosity, 8: desire, 9: disappointment, 10: disapproval, 
# 11: disgust, 12: embarrassment, 13: excitement, 14: fear, 15: gratitude, 
# 16: grief, 17: joy, 18: love, 19: nervousness, 20: optimism, 21: pride, 
# 22: realization, 23: relief, 24: remorse, 25: sadness, 26: surprise, 27: neutral

MAP_GO_TO_GATE = {
    # Platonic
    0: "platonic", 1: "platonic", 4: "platonic", 17: "platonic", 20: "platonic", 21: "platonic",
    # Tension
    12: "tension", 19: "tension", 13: "tension", 26: "tension",
    # Romance
    5: "romance", 18: "romance",
    # Passion
    8: "passion",
    # Conflict
    2: "conflict", 3: "conflict", 10: "conflict", 11: "conflict",
    # Aftercare
    15: "aftercare", 23: "aftercare"
    # Note: 'Physical' and 'Explicit' are derived mostly from Synthetics 
    # because GoEmotions doesn't label them explicitly.
}

STOP_WORDS = set(["a", "an", "the", "and", "but", "if", "or", "is", "it", "to", "of"])

def stem(w):
    # Matches JS runtime stemmer
    if len(w) < 4: return w
    if w.endswith("ing"): return w[:-3]
    if w.endswith("ed"): return w[:-2]
    if w.endswith("s"): return w[:-1]
    return w

def advanced_clean(text):
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s]', '', text)
    tokens = text.split()
    tokens = [stem(t) for t in tokens if t not in STOP_WORDS and len(t) > 2]
    return " ".join(tokens)

# ==========================================
# 3. PROCESSING
# ==========================================
data_pool = []
count_go = 0

print(f"Loading GoEmotions from {PATH_GO}...")
try:
    with open(PATH_GO, 'r', encoding='utf-8') as f:
        reader = csv.reader(f, delimiter='\t')
        for row in reader:
            if len(row) < 2: continue
            text = row[0]
            # GoEmotions labels are comma-separated in the second column
            try:
                indices = [int(x) for x in row[1].split(',')]
            except ValueError:
                continue # Skip header
                
            for idx in indices:
                if idx in MAP_GO_TO_GATE:
                    target = MAP_GO_TO_GATE[idx]
                    data_pool.append({'text': text, 'label': target})
                    count_go += 1
except Exception as e:
    print(f"Error reading GoEmotions: {e}")

print(f"Loaded {count_go} samples from GoEmotions.")

# Inject Synthetics
print("Injecting Synthetics...")
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

# ==========================================
# 4. TRAINING & EXPORT
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
    
    # Quantize to 4-bit (0-15) - A-P mapping
    w = clf.coef_[0]
    w_min, w_max = np.min(w), np.max(w)
    w_range = w_max - w_min if (w_max - w_min) > 0 else 1.0
    w_norm = (w - w_min) / w_range
    w_int = np.round(w_norm * 15).astype(int)
    
    alphabet = "ABCDEFGHIJKLMNOP"
    w_str = "".join([alphabet[val] for val in w_int])
    
    models_out[target] = {
        "bias": clf.intercept_[0],
        "min": w_min,
        "range": w_range,
        "weights": w_str
    }

print("Exporting to JS...")
js_out = "// EIDOS-EROS PACING ENGINE (GoEmotions + Synthetics)\n"
js_out += f"var EROS_HASH = {HASH_SIZE};\n\n"
js_out += "function getErosData() {\n  return {\n"

for target, data in models_out.items():
    # Atomic Fragmentation (1000 char chunks)
    full_str = data['weights']
    chunks = [full_str[i:i+1000] for i in range(0, len(full_str), 1000)]
    
    js_out += f"    '{target}': {{\n"
    js_out += f"      b: {data['bias']:.4f}, min: {data['min']:.4f}, r: {data['range']:.4f},\n"
    js_out += "      w: [\n"
    for chunk in chunks:
        js_out += f"        '{chunk}',\n"
    js_out += "      ]\n    },\n"

js_out += "  };\n}\n"

with open("EROS_Sister_Script.js", "w") as f:
    f.write(js_out)

print("DONE. File saved as 'EROS_Sister_Script.js'.")