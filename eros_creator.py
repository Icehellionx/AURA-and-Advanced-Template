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
    "tension",    # Gate 2: The "Slow Burn"
    "romance",    # Gate 3: Deep Affection
    "physical",   # Gate 4: Non-sexual touch
    "passion",    # Gate 5: Lust/Desire
    "explicit",   # Gate 6: The Act
    "conflict",   # Gate 7: Rejection
    "aftercare"   # Gate 8: Safety
]

# Matched to your requested output
HASH_SIZE = 16384 
SAMPLES_PER_CLASS = 4000
SYNTHETIC_AMPLIFICATION = 60 

PATH_GO = "data/GoEmotions/train.tsv"

# ==========================================
# 1. EXPANDED SYNTHETICS (The Pacing Logic)
# ==========================================
SYNTHETICS = {
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
MAP_GO_TO_GATE = {
    0: "platonic", 1: "platonic", 4: "platonic", 17: "platonic", 20: "platonic", 21: "platonic",
    12: "tension", 19: "tension", 13: "tension", 26: "tension",
    5: "romance", 18: "romance",
    8: "passion",
    2: "conflict", 3: "conflict", 10: "conflict", 11: "conflict",
    15: "aftercare", 23: "aftercare"
}

STOP_WORDS = set(["a", "an", "the", "and", "but", "if", "or", "is", "it", "to", "of"])

def stem(w):
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
# 3. LOADING & PROCESSING
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
            try:
                indices = [int(x) for x in row[1].split(',')]
            except ValueError:
                continue 
            for idx in indices:
                if idx in MAP_GO_TO_GATE:
                    target = MAP_GO_TO_GATE[idx]
                    data_pool.append({'text': text, 'label': target})
                    count_go += 1
except Exception as e:
    print(f"Error reading GoEmotions: {e}")
print(f"Loaded {count_go} samples from GoEmotions.")

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
# 4. TRAINING & EXPORT (Format: AURA v15)
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

print("Training & Formatting Output...")
# Initialize Output String
js_output = f"var HASH_SIZE = {HASH_SIZE};\n"

for target in TARGETS:
    print(f"  Training [{target}]...")
    y_binary = (y == target).astype(int)
    
    # Using simple Logistic Regression (matches the simple sum in JS)
    clf = LogisticRegression(solver='liblinear', penalty='l2', C=1.0, class_weight='balanced')
    clf.fit(X, y_binary)
    
    # Quantize and Format
    w = clf.coef_[0]
    # We scale weights to be integers for compaction, then normalize via 's' param
    # Max value becomes 127 (fits in signed 8-bit conceptually, though we store as text)
    max_val = np.max(np.abs(w)) or 1.0
    scale = 127.0 / max_val
    w_int = np.clip(np.round(w * scale), -127, 127).astype(int)
    
    # Create comma-separated string
    w_str = ",".join(map(str, w_int.flatten()))
    
    # Format: b=BIAS;s=SCALE;w=WEIGHTS
    # Note: 1.0/scale is what we multiply by in JS to get back to original range
    model_str = f"b={clf.intercept_[0]:.4f};s={1.0/scale:.6f};w={w_str}"
    
    # Append to JS output
    var_name = f"MODEL_{target.upper()}"
    js_output += f"var {var_name} = \"{model_str}\";\n"

# Write to file
with open("EROS_Sister_Script.js", "w") as f:
    f.write(js_output)

print("DONE. File saved as 'EROS_Sister_Script.js'.")