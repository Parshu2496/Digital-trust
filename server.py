# ==========================================================
# EMAIL VERIFIER + ML SPAM DETECTION + VERIFALIA CHECK
# ==========================================================
import re
import dns.resolver
import whois
import joblib
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from requests.auth import HTTPBasicAuth
import requests
from colorama import Fore, Style, init
import json
import sys

init(autoreset=True)

# ========================= CONFIG ==========================
VERIFALIA_USERNAME = "your_email@example.com"  # Replace
VERIFALIA_API_KEY = "your_verifalia_api_key"   # Replace

# ========================= CLEAN TEXT ======================
def clean_text(s):
    if not isinstance(s, str):
        return ""
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

# ========================= ML MODELS ======================
def load_and_train_spam_models(dataset_csv_path):
    print(Fore.CYAN + "[⚙] Training models using Kaggle dataset...")

    df = pd.read_csv(dataset_csv_path, encoding='latin-1', usecols=['v1', 'v2'])
    df.rename(columns={'v1': 'label', 'v2': 'text'}, inplace=True)

    df['text_clean'] = df['text'].apply(clean_text)
    df['label_num'] = df['label'].map({'ham': 0, 'spam': 1})

    X_train, X_test, y_train, y_test = train_test_split(
        df['text_clean'], df['label_num'], test_size=0.2, random_state=42
    )

    vectorizer = TfidfVectorizer(max_features=4000)
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    nb = MultinomialNB()
    dt = DecisionTreeClassifier(max_depth=10, random_state=42)
    rf = RandomForestClassifier(n_estimators=120, random_state=42)

    nb.fit(X_train_vec, y_train)
    dt.fit(X_train_vec, y_train)
    rf.fit(X_train_vec, y_train)

    for name, model in zip(['NB', 'DT', 'RF'], [nb, dt, rf]):
        preds = model.predict(X_test_vec)
        print(f"{name} Accuracy: {accuracy_score(y_test, preds):.3f}")

    joblib.dump((vectorizer, nb, dt, rf), "spam_models.pkl")
    print(Fore.GREEN + "[✅] Models trained and saved to spam_models.pkl")

    return vectorizer, nb, dt, rf

def load_spam_models_or_train(dataset_csv_path):
    try:
        vectorizer, nb, dt, rf = joblib.load("spam_models.pkl")
        print(Fore.GREEN + "[📦] Loaded existing trained models.")
    except:
        vectorizer, nb, dt, rf = load_and_train_spam_models(dataset_csv_path)
    return vectorizer, nb, dt, rf

# ========================= DNS / WHOIS =====================
def check_dns_record(domain, record_type):
    try:
        dns.resolver.resolve(domain, record_type)
        return True
    except:
        return False

def get_domain_age(domain):
    public_domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"]
    if domain.lower() in public_domains:
        return 365*20  # assume 20 years old

    if domain.endswith(".edu") or domain.endswith(".edu.in") or domain.endswith(".gov") or domain.endswith(".gov.in"):
        return 365*15  # assume 15 years old

    try:
        w = whois.whois(domain)
        if w.creation_date:
            creation_date = w.creation_date[0] if isinstance(w.creation_date, list) else w.creation_date
            age_days = (datetime.now() - creation_date).days
            return age_days if age_days > 0 else 0
    except:
        return 0
    return 0

def validate_email(email):
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return bool(re.match(pattern, email))

# ========================= VERIFALIA CHECK =================
def verify_email_verifalia(email):
    url = "https://api.verifalia.com/v2.7/email-validations"
    payload = {"entries": [{"inputData": email}]}
    try:
        response = requests.post(url, json=payload, auth=HTTPBasicAuth(VERIFALIA_USERNAME, VERIFALIA_API_KEY))
        if response.status_code == 200:
            result = response.json()
            entry = result["entries"][0]
            return {
                "status": entry.get("status", "unknown"),
                "is_disposable": entry.get("isDisposable", False),
                "is_role_account": entry.get("isRoleAccount", False),
                "is_catch_all": entry.get("isCatchAll", False),
                "classification": entry.get("classification", "unknown")
            }
        else:
            return {"status": "error", "message": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ========================= MAIN ANALYSIS ==================
def analyze_email(email, vectorizer, nb, dt, rf):
    result = {}
    result["email"] = email

    if not validate_email(email):
        result["error"] = "Invalid email format."
        return result

    domain = email.split('@')[-1]
    domain_age = get_domain_age(domain)
    mx_exists = check_dns_record(domain, "MX")
    a_record = check_dns_record(domain, "A")
    spf = check_dns_record(domain, "TXT")
    dmarc = check_dns_record(f"_dmarc.{domain}", "TXT")

    # ================= Spam Content Analysis =================
    msg_features = vectorizer.transform([email])
    spam_probs = [
        nb.predict_proba(msg_features)[0][1],
        dt.predict_proba(msg_features)[0][1],
        rf.predict_proba(msg_features)[0][1],
    ]
    avg_spam_prob = sum(spam_probs) / len(spam_probs)
    is_spam_text = avg_spam_prob > 0.5

    # ================= Mailbox Verification =================
    verifalia_result = verify_email_verifalia(email)
    mailbox_exists = verifalia_result.get("status") == "Success"

    # ================= Trust Score =================
    trust_score = 100
    if is_spam_text: trust_score -= 30
    if domain_age < 1: trust_score -= 25
    if not mx_exists: trust_score -= 20
    if not a_record: trust_score -= 10
    if not spf: trust_score -= 10
    if not dmarc: trust_score -= 5
    if not mailbox_exists: trust_score -= 50  # major penalty
    if domain.lower() in ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"]: trust_score += 20

    trust_score = min(max(trust_score, 0), 100)
    is_spam = trust_score < 50 or is_spam_text or not mailbox_exists

    # ================= Reasons =================
    reasons = []
    if is_spam_text: reasons.append("Spammy content detected by ML.")
    if domain_age < 1: reasons.append("Newly created domain/email.")
    if not mailbox_exists: reasons.append("Mailbox does not exist (Verifalia check).")
    if not mx_exists: reasons.append("Missing MX record.")
    if not a_record: reasons.append("Missing A record.")
    if not spf: reasons.append("Missing SPF record.")
    if not dmarc: reasons.append("Missing DMARC record.")
    if not reasons: reasons.append("Email appears legitimate.")

    # ================= Prepare result =================
    result.update({
        "is_spam": is_spam,
        "spam_probability": avg_spam_prob,
        "trust_score": trust_score,
        "domain_age_days": domain_age,
        "mx_exists": mx_exists,
        "a_record": a_record,
        "spf": spf,
        "dmarc": dmarc,
        "mailbox_exists": mailbox_exists,
        "verifalia_status": verifalia_result,
        "reasons": reasons
    })

    return result

# ========================= MAIN LOOP =====================
if __name__ == "__main__":
    dataset_path = "spam.csv"  # Kaggle dataset
    vectorizer, nb_model, dt_model, rf_model = load_spam_models_or_train(dataset_path)

    if len(sys.argv) == 4:
        email_to_test = sys.argv[1]
        subject = sys.argv[2]
        body = sys.argv[3]
        analysis_result = analyze_email(email_to_test, vectorizer, nb_model, dt_model, rf_model)
        print(json.dumps(analysis_result))
    else:
        print(Fore.YELLOW + "\n🔹 Enter any email address to analyze (type 'exit' to quit)\n")
        while True:
            email_to_test = input(Fore.WHITE + "Enter email: ").strip()
            if email_to_test.lower() in ['exit', 'quit']:
                print(Fore.GREEN + "Exiting analyzer. ✅")
                break
            analysis_result = analyze_email(email_to_test, vectorizer, nb_model, dt_model, rf_model)
            print(json.dumps(analysis_result, indent=2))
