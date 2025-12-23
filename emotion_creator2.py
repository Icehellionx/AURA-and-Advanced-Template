import pandas as pd
import numpy as np
import re
import csv
from sklearn.linear_model import LogisticRegression
from sklearn.utils import resample
from sklearn.feature_extraction.text import TfidfTransformer

# ==========================================
# CONFIGURATION
# ==========================================
TARGET_EMOTIONS = ["anger", "joy", "sadness", "fear", "romance", "neutral"]
BINARY_TARGETS = [
    "positive", "negative",
    "question", "command", "statement", "agree",
    "confusion", "curiosity", "realization"
]
ALL_TARGETS = TARGET_EMOTIONS + BINARY_TARGETS

HASH_SIZE = 16384 
SAMPLES_PER_CLASS = 3000
SYNTHETIC_AMPLIFICATION = 100 

# ==========================================
# 1. SUPER DICTIONARY (Synthetics)
# ==========================================
SYNTHETICS = {
    # --- ORIGINAL EMOTIONS ---
    "anger": [
        "hate", "hated", "hating", "furious", "livid", "angry", "anger", "mad", "pissed",
        "rage", "raging", "outraged", "resent", "resentment", "hostile", "bitter",
        "stupid", "idiot", "dumb", "moron", "imbecile", "jerk", "asshole", "bitch",
        "bastard", "pathetic", "useless", "incompetent", "garbage", "trash", "filth",
        "repulsive", "disgusting", "gross", "revolting", "nasty", "vile", "sickening",
        "liar", "lying", "cheat", "cheater", "fake", "fraud", "hypocrite",
        "kill you", "punch", "hit", "smack", "beat you", "destroy", "smash", "break",
        "strangle", "fight me", "hurt you", "kick", "slap", "attack", "weapon",
        "shoot", "stab", "violence", "violent", "dead meat", "regret this",
        "shut up", "shut it", "silence", "quiet", "stop talking", "don't speak",
        "get out", "get lost", "get away", "leave me", "go away", "beat it", "scram",
        "don't touch", "hands off", "let go", "back off", "stay away",
        "have it your way", "don't care anymore",
        "not happy", "not amused", "not funny", "not cool", "not okay", "not fair",
        "tired of", "sick of", "fed up", "done with", "over it", "finished with",
        "annoying", "annoyed", "annoy", "bother", "bothering", "irritating", "irritated",
        "frustrated", "frustrating", "aggravated", "aggravating",
        "how dare", "what the hell", "wtf", "screw you", "damn it", "damn you",
        "fuck off", "fuck you", "bullshit", "crap", "ridiculous", "absurd", "nonsense"
    ],
    "joy": [
        "happy", "happiness", "joy", "joyful", "glad", "delighted", "pleased",
        "content", "satisfied", "cheerful", "beaming", "radiant", "smiling", "smile",
        "laugh", "laughing", "laughter", "haha", "lol", "lmao", "rofl", "yay",
        "wonderful", "amazing", "great", "awesome", "fantastic", "perfect", "excellent",
        "brilliant", "genius", "smart", "cool", "neat", "nice", "good job", "well done",
        "impressive", "impressed", "proud", "proud of", "best thing", "favorite",
        "thank you", "thanks", "appreciate", "grateful", "gratitude", "blessed",
        "lifesaver", "saved me", "help a lot", "relief", "relieved", "finally",
        "luck", "lucky", "fortunate", "phew", "thank god",
        "excited", "exciting", "excitement", "can't wait", "looking forward",
        "thrilled", "pumped", "hyped", "eager", "enthusiastic", "fun", "funny",
        "enjoy", "enjoying", "loved it", "like it", "love this", "like this"
    ],
    "sadness": [
        "sad", "sadness", "unhappy", "depressed", "depression", "miserable", "sorrow",
        "grief", "grieving", "mourn", "mourning", "cry", "crying", "tears", "sob",
        "sobbing", "weeping", "heartbroken", "broken heart", "devastated", "crushed",
        "give up", "gave up", "giving up", "quit", "quitting", "failure", "fail",
        "failed", "loser", "hopeless", "no hope", "pointless", "useless", "waste",
        "ruined", "destroyed", "mistake", "bad person", "worthless", "nothing",
        "lonely", "alone", "isolated", "abandoned", "ignored", "forgotten", "left out",
        "miss you", "missing you", "miss them", "empty", "hollow", "numb",
        "sorry", "apologize", "apology", "forgive me", "my fault", "regret", "regretting",
        "guilt", "guilty", "shame", "ashamed", "embarrassed", "didn't mean", "bad about",
        "terrible about", "feel awful", "feel bad"
    ],
    "fear": [
        "scared", "scary", "fear", "afraid", "terrified", "petrified", "horror",
        "horrified", "terror", "panic", "panicking", "scream", "screaming", "shriek",
        "trembling", "shaking", "shiver", "frozen", "paralyzed", "frightened",
        "nervous", "anxious", "anxiety", "worried", "worry", "worrying", "concerned",
        "stress", "stressed", "tense", "uneasy", "dread", "dreading", "hesitate",
        "unsure", "unsafe", "danger", "dangerous", "risk", "risky",
        "help me", "please help", "save me", "rescue", "trapped", "stuck", "run away",
        "running away", "hide", "hiding", "escape", "don't hurt", "please stop",
        "mercy", "begging", "nightmare", "bad feeling", "something wrong"
    ],
    "romance": [
        "love", "loving", "loved", "lover", "adore", "adored", "cherish", "worship",
        "soulmate", "partner", "spouse", "husband", "wife", "boyfriend", "girlfriend",
        "marry", "marriage", "wedding", "forever", "always", "eternity",
        "kiss", "kissing", "kissed", "hug", "hugging", "hugged", "cuddle", "snuggle",
        "hold me", "holding hands", "touch me", "caress", "stroke", "embrace",
        "passion", "passionate", "desire", "want you", "need you", "crave",
        "beautiful", "gorgeous", "handsome", "cute", "sexy", "hot", "stunning",
        "breathtaking", "angel", "darling", "honey", "sweetheart", "babe", "baby",
        "dearest", "beloved", "attractive", "charming", "brother i never had",
        "strangle and kiss", "future without you", "imagine a future",
        "you are mine", "i am yours", "you belong to me", "we belong", "my girl", "my boy",
        "jealous", "jealousy", "all mine", "don't share", "stay with me", "never leave",
        "don't go", "need to be with you", "obsessed", "obsession",
        "blush", "blushing", "fluster", "flustered", "shy", "face red", "heart beating",
        "heart racing", "butterflies", "warmth", "soft", "gentle", "tender", "intense",
        "stare", "staring", "gaze", "gazing", "eyes locked", "lean in", "leaning in",
        "whisper", "whispering", "breath", "breathing", "skin", "lips", "bed", "bedroom",
        "sleep with", "make love", "clothes off", "undress"
    ],
    "neutral": [
        "what", "when", "where", "who", "why", "how", "question", "answer", "ask",
        "asking", "inquire", "information", "details", "explain", "describe",
        "know", "understand", "clarify", "mean", "meaning", "curious", 
        "time", "clock", "hour", "minute", "day", "train", "bus", "car", "drive",
        "leave", "arrive", "schedule", "plan", "ready", "prepared", "pen", "paper",
        "book", "read", "write", "computer", "phone", "email", "message", "text",
        "okay", "ok", "fine", "alright", "sure", "maybe", "perhaps", "possibly",
        "yes", "no", "nope", "yep", "correct", "incorrect", "true", "false",
        "standard", "normal", "average", "typical", "regular", "usual",
        "just", "merely", "simply", "random", "bought this", "specifically", 
        "went to", "going to", "looking at", "saw", "heard", "said"
    ],

    # --- NEW SYNTHETICS: BINARY TRIGGERS ---
    "positive": [
        "good", "great", "excellent", "amazing", "wonderful", "cool", "nice", "love",
        "like", "enjoy", "beautiful", "happy", "fun", "best", "perfect", "glad",
        "sweet", "awesome", "fantastic", "lovely", "better", "right", "correct",
        "yes", "agree", "support", "fan", "excited", "pretty", "clean", "fresh",
        "safe", "strong", "fast", "smart", "kind", "friendly", "polite"
    ],
    "negative": [
        "bad", "terrible", "awful", "horrible", "worst", "hate", "dislike", "suck",
        "gross", "nasty", "evil", "dirty", "wrong", "incorrect", "no", "disagree",
        "stupid", "dumb", "ugly", "sad", "angry", "annoying", "boring", "slow",
        "weak", "dangerous", "rude", "mean", "cruel", "hostile", "fail", "failure",
        "useless", "broken", "garbage", "trash", "crap", "shit", "fuck", "damn"
    ],
    "question": [
        "?", "what", "where", "when", "who", "why", "how", "can you", "could you",
        "would you", "is it", "are you", "do you", "did you", "will you", "which",
        "whose", "whom", "tell me", "explain", "describe", "answer", "asking",
        "question", "inquire", "curious", "know", "wonder", "anyone", "anything"
    ],
    "command": [
        "go", "stop", "come", "do", "make", "give", "take", "tell", "say", "speak",
        "look", "listen", "watch", "move", "wait", "stay", "leave", "help", "kill",
        "attack", "defend", "follow", "lead", "open", "close", "shut", "start",
        "end", "finish", "complete", "continue", "change", "wear", "remove", "eat",
        "drink", "sleep", "wake", "stand", "sit", "kneel", "bow", "hurry"
    ],
    "statement": [
        ".", "it is", "i am", "you are", "they are", "we are", "there is", "there are",
        "this is", "that is", "i think", "i believe", "i feel", "i saw", "i heard",
        "i know", "happened", "occurred", "went", "came", "took", "gave", "said",
        "told", "fact", "true", "history", "story", "yesterday", "today", "tomorrow"
    ],
    "agree": [
        "yes", "yeah", "yep", "yup", "okay", "ok", "sure", "alright", "fine",
        "agreed", "agree", "correct", "right", "true", "exactly", "definitely",
        "absolutely", "certainly", "indeed", "of course", "no problem", "will do",
        "i will", "good idea", "sounds good", "deal", "understood", "copy that"
    ],
    "confusion": [
        "huh", "what", "wait", "confused", "confusion", "don't understand",
        "don't get it", "mean", "meaning", "lost", "unsure", "puzzled", "weird",
        "strange", "odd", "baffled", "perplexed", "clarify", "unclear", "sense",
        "make sense", "explain", "explanation", "complicate", "complex", "hard"
    ],
    "curiosity": [
        "curious", "wonder", "wondering", "interesting", "intriguing", "fascinating",
        "tell me more", "elaborate", "details", "why is that", "how come",
        "want to know", "interested", "learn", "teach", "discover", "explore",
        "what if", "suppose", "imagine", "guess"
    ],
    "realization": [
        "oh", "ah", "aha", "wow", "see", "i see", "now i get it", "understood",
        "understand", "realize", "realized", "realization", "found", "discovered",
        "notice", "noticed", "makes sense", "clear", "clarity", "suddenly",
        "remember", "remembered", "forgot", "remind", "reminded"
    ]
}

# ==========================================
# 2. SHARED LOGIC
# ==========================================
def stem(w):
    if len(w) < 4: return w
    if w.endswith("ies"): return w[:-3] + "y"
    if w.endswith("es"): return w[:-2]
    if w.endswith("s") and not w.endswith("ss"): return w[:-1]
    if w.endswith("ing"):
        base = w[:-3]
        if len(base) > 2: return base
    if w.endswith("ed"):
        base = w[:-2]
        if len(base) > 2: return base
    if w.endswith("ly"): return w[:-2]
    if w.endswith("ment"): return w[:-4]
    if w.endswith("ness"): return w[:-4]
    if w.endswith("ful"): return w[:-3]
    if w.endswith("able"): return w[:-4]
    if w.endswith("ibility"): return w[:-7]
    return w

STOP_WORDS = set(["i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"])

def advanced_clean(text):
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s]', '', text)
    tokens = text.split()
    tokens = [stem(t) for t in tokens if t not in STOP_WORDS and len(t) > 2]
    return " ".join(tokens)

# PATHS
PATH_ISEAR = "data/ISEAR/eng_dataset.csv"
PATH_GO = "data/GoEmotions/train.tsv"
PATH_SST = "data/SST-2/train.tsv"
PATH_DAILY_DIAL_TXT = "data/DailyDialogue/dialogues_train.txt"
PATH_DAILY_DIAL_ACT = "data/DailyDialogue/dialogues_act_train.txt"

# MAPPINGS
# GoEmotions (0-27)
MAP_GO_EMOTION = {
    2:"anger", 3:"anger", 11:"anger",    # Anger + Annoyance + Disgust -> Anger
    17:"joy", 1:"joy", 13:"joy", 21:"joy", # Joy + Amusement + Excitement + Pride -> Joy
    25:"sadness", 16:"sadness", 9:"sadness", # Sadness + Grief + Disappointment -> Sadness
    14:"fear", 19:"fear",                 # Fear + Nervousness -> Fear
    18:"love", 8:"romance", 5:"romance",  # Love + Desire + Caring -> Romance
    27:"neutral"
}

# New: Epistemic Map (Fixed)
MAP_GO_EPISTEMIC = {
    6: "confusion",
    7: "curiosity",
    22: "realization"
}

# New: Sentiment Map (Recycling)
MAP_GO_SENTIMENT = {
    # POSITIVE
    0:"positive", 1:"positive", 4:"positive", 5:"positive", 7:"positive", 8:"positive",
    13:"positive", 15:"positive", 17:"positive", 18:"positive", 20:"positive", 21:"positive",
    22:"positive", 23:"positive",
    # NEGATIVE
    2:"negative", 3:"negative", 9:"negative", 10:"negative", 11:"negative", 12:"negative",
    14:"negative", 16:"negative", 19:"negative", 24:"negative", 25:"negative"
}

data_pool = []
print("\n--- LOADING DATASETS ---")

# 1. LOAD ISEAR (With Explicit Counters)
try:
    df = pd.read_csv(PATH_ISEAR)
    count = 0
    for _,r in df.iterrows():
        # Load Main 6
        if r['sentiment'] in TARGET_EMOTIONS: 
            data_pool.append({'text':r['content'],'label':r['sentiment']})
            count += 1
        # Load Sentiment (Recycle)
        if r['sentiment'] in ["joy", "romance"]:
            data_pool.append({'text':r['content'],'label':"positive"})
        if r['sentiment'] in ["anger", "sadness", "fear", "disgust"]:
            data_pool.append({'text':r['content'],'label':"negative"})
    print(f"[SUCCESS] Loaded {count} rows from ISEAR")
except Exception as e:
    print(f"[FAILED] ISEAR: {e}")

# 2. LOAD GOEMOTIONS (With Explicit Counters & Header Check)
try:
    count_emo = 0
    count_epi = 0
    with open(PATH_GO,'r',encoding='utf-8') as f:
        reader=csv.reader(f,delimiter='\t')
        for r in reader:
            if len(r) > 1:
                # Skip header if present (check if column 1 is numeric)
                if not r[1][0].isdigit(): continue 
                
                indices = [int(x) for x in r[1].split(',')]
                
                for idx in indices:
                    # Load Emotions
                    if idx in MAP_GO_EMOTION:
                        data_pool.append({'text':r[0], 'label':MAP_GO_EMOTION[idx]})
                        count_emo += 1
                    # Load Epistemic
                    if idx in MAP_GO_EPISTEMIC:
                        data_pool.append({'text':r[0], 'label':MAP_GO_EPISTEMIC[idx]})
                        count_epi += 1
                    # Load Sentiment
                    if idx in MAP_GO_SENTIMENT:
                        data_pool.append({'text':r[0], 'label':MAP_GO_SENTIMENT[idx]})

    print(f"[SUCCESS] Loaded {count_emo} Emotions and {count_epi} Cognitive States from GoEmotions")
except Exception as e:
    print(f"[FAILED] GoEmotions: {e}")

# 3. LOAD SST-2 (Sentiment Only)
try:
    df_sst = pd.read_csv(PATH_SST, sep='\t')
    count_sst = 0
    for _, r in df_sst.iterrows():
        lbl = "positive" if r['label'] == 1 else "negative"
        data_pool.append({'text': r['sentence'], 'label': lbl})
        count_sst += 1
    print(f"[SUCCESS] Loaded {count_sst} rows from SST-2")
except Exception as e:
    print(f"[FAILED] SST-2: {e}")

# 4. LOAD DAILY DIALOGUE (Acts)
try:
    count_dd = 0
    with open(PATH_DAILY_DIAL_TXT, 'r', encoding='utf-8') as ft, open(PATH_DAILY_DIAL_ACT, 'r', encoding='utf-8') as fa:
        lines_txt = ft.readlines()
        lines_act = fa.readlines()
        DD_MAP = { '1': 'statement', '2': 'question', '3': 'command', '4': 'agree' }
        
        for t_line, a_line in zip(lines_txt, lines_act):
            parts_t = t_line.strip().split('__eou__')
            parts_a = a_line.strip().split(' ')
            for t, a in zip(parts_t, parts_a):
                if a in DD_MAP and len(t) > 5:
                    data_pool.append({'text': t, 'label': DD_MAP[a]})
                    count_dd += 1
    print(f"[SUCCESS] Loaded {count_dd} rows from DailyDialogue")
except Exception as e:
    print(f"[FAILED] DailyDialogue: {e}")


# ==========================================
# 3. INJECTION & BALANCING
# ==========================================
df_raw = pd.DataFrame(data_pool)
if len(df_raw) == 0:
    print("CRITICAL ERROR: No data loaded from files. Checking Synthetics only.")
else:
    df_raw['clean_text'] = df_raw['text'].apply(advanced_clean)
    df_raw = df_raw[df_raw['clean_text'].str.len() > 0]

print("\n--- Injecting Synthetics ---")
synth_data = []
for emo, phrases in SYNTHETICS.items():
    for phrase in phrases:
        clean_phrase = advanced_clean(phrase)
        if len(clean_phrase) > 0:
            for _ in range(SYNTHETIC_AMPLIFICATION):
                synth_data.append({'clean_text': clean_phrase, 'label': emo})

df_synth = pd.DataFrame(synth_data)
df_combined = pd.concat([df_raw, df_synth])

# 4. BALANCE
balanced_chunks = []
print(f"Balancing...")
for target in ALL_TARGETS:
    df_class = df_combined[df_combined['label'] == target]
    if len(df_class) > 0:
        df_resampled = resample(df_class, replace=True, n_samples=SAMPLES_PER_CLASS, random_state=42)
        balanced_chunks.append(df_resampled)
    else:
        print(f"WARNING: No data found for {target}")

df_final = pd.concat(balanced_chunks)

# ==========================================
# 5. VECTORIZE & TRAIN
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
        for j in range(len(tokens) - 1):
            bigram = f"{tokens[j]} {tokens[j+1]}"
            idx = fnv1a_32_js(bigram) % hash_size
            matrix[i, idx] += 1
    return matrix

print("Hashing...")
X_counts = vectorizer_fnv(df_final['clean_text'].tolist(), HASH_SIZE)
print("TF-IDF...")
tfidf = TfidfTransformer(norm='l2', use_idf=True, smooth_idf=True)
X_tfidf = tfidf.fit_transform(X_counts)

print("Training Specialists...")
js_output = f"// HYBRID + SYNTHETIC V3 (ALL BINARY)\nvar HASH_SIZE = {HASH_SIZE};\n"

for target in ALL_TARGETS:
    print(f"Training [{target}]...")
    y = (df_final['label'] == target).astype(int)
    
    clf = LogisticRegression(solver='liblinear', penalty='l2', C=1.0, class_weight='balanced')
    clf.fit(X_tfidf, y)
    
    w = clf.coef_[0]
    max_val = np.max(np.abs(w)) or 1.0
    scale = 127.0 / max_val
    w_int = np.clip(np.round(w * scale), -127, 127).astype(int)
    w_str = ",".join(map(str, w_int.flatten()))
    
    js_output += f"var MODEL_{target.upper()} = \"b={clf.intercept_[0]:.4f};s={1.0/scale:.6f};w={w_str}\";\n"

with open("specialist_blob_synth.js", "w") as f:
    f.write(js_output)

print("Done.")