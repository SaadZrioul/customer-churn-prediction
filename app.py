
from pathlib import Path
from io import StringIO

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "final_churn_model.joblib"

app = Flask(__name__)

FEATURE_COLUMNS = [
    "gender",
    "SeniorCitizen",
    "Partner",
    "Dependents",
    "tenure",
    "PhoneService",
    "MultipleLines",
    "InternetService",
    "OnlineSecurity",
    "OnlineBackup",
    "DeviceProtection",
    "TechSupport",
    "StreamingTV",
    "StreamingMovies",
    "Contract",
    "PaperlessBilling",
    "PaymentMethod",
    "MonthlyCharges",
    "TotalCharges",
]

NUMERIC_COLUMNS = [
    "SeniorCitizen",
    "tenure",
    "MonthlyCharges",
    "TotalCharges",
]

MODEL_METRICS = {
    "f1_cv": 0.599,
    "accuracy": 0.749,
    "precision": 0.518,
    "recall": 0.751,
    "f1": 0.614,
    "roc_auc": 0.841,
    "pr_auc": 0.628,
}


def load_artifact():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Modèle introuvable : {MODEL_PATH}. "
            "Place final_churn_model.joblib dans le même dossier que app.py."
        )

    artifact = joblib.load(MODEL_PATH)

    if not isinstance(artifact, dict):
        raise ValueError("Le fichier joblib doit contenir un dictionnaire.")

    if "model" not in artifact or "threshold" not in artifact:
        raise ValueError(
            "Le fichier joblib doit contenir les clés 'model' et 'threshold'."
        )

    return artifact["model"], float(artifact["threshold"])


MODEL, THRESHOLD = load_artifact()


def get_classifier(pipeline):
    if hasattr(pipeline, "named_steps"):
        if "model" in pipeline.named_steps:
            return pipeline.named_steps["model"]
        return list(pipeline.named_steps.values())[-1]
    return pipeline


def get_preprocessor(pipeline):
    if not hasattr(pipeline, "named_steps"):
        return None

    if "preprocessor" in pipeline.named_steps:
        return pipeline.named_steps["preprocessor"]

    for step in pipeline.named_steps.values():
        if hasattr(step, "transform") and hasattr(step, "get_feature_names_out"):
            return step

    return None


def get_yes_index(pipeline):
    classifier = get_classifier(pipeline)
    classes = list(getattr(classifier, "classes_", []))

    if "Yes" not in classes:
        raise ValueError("La classe 'Yes' n'existe pas dans les classes du modèle.")

    return classes.index("Yes")


def normalize_single_customer(payload):
    missing = [column for column in FEATURE_COLUMNS if column not in payload]
    if missing:
        raise ValueError("Champs manquants : " + ", ".join(missing))

    data = {column: payload[column] for column in FEATURE_COLUMNS}

    # Conversion de SeniorCitizen.
    senior = data["SeniorCitizen"]
    if isinstance(senior, str):
        senior_lower = senior.strip().lower()
        if senior_lower in {"yes", "oui", "1", "true"}:
            data["SeniorCitizen"] = 1
        elif senior_lower in {"no", "non", "0", "false"}:
            data["SeniorCitizen"] = 0
        else:
            data["SeniorCitizen"] = int(float(senior))
    else:
        data["SeniorCitizen"] = int(senior)

    data["tenure"] = int(float(data["tenure"]))
    data["MonthlyCharges"] = float(data["MonthlyCharges"])
    data["TotalCharges"] = float(data["TotalCharges"])

    if data["tenure"] < 0 or data["tenure"] > 72:
        raise ValueError("tenure doit être compris entre 0 et 72 mois.")

    if data["MonthlyCharges"] < 0 or data["TotalCharges"] < 0:
        raise ValueError("Les montants ne peuvent pas être négatifs.")

    # Cohérence métier avec les catégories présentes dans le dataset.
    if data["PhoneService"] == "No":
        data["MultipleLines"] = "No phone service"

    if data["InternetService"] == "No":
        for column in [
            "OnlineSecurity",
            "OnlineBackup",
            "DeviceProtection",
            "TechSupport",
            "StreamingTV",
            "StreamingMovies",
        ]:
            data[column] = "No internet service"

    return pd.DataFrame([data], columns=FEATURE_COLUMNS)


def clean_feature_name(name):
    name = str(name).replace("num__", "").replace("cat__", "")
    replacements = {
        "SeniorCitizen": "Senior Citizen",
        "tenure": "Ancienneté",
        "MonthlyCharges": "Frais mensuels",
        "TotalCharges": "Frais totaux",
        "InternetService": "Service internet",
        "OnlineSecurity": "Sécurité en ligne",
        "OnlineBackup": "Sauvegarde en ligne",
        "DeviceProtection": "Protection appareil",
        "TechSupport": "Support technique",
        "StreamingTV": "Streaming TV",
        "StreamingMovies": "Streaming Movies",
        "PaperlessBilling": "Facturation électronique",
        "PaymentMethod": "Méthode de paiement",
        "MultipleLines": "Lignes multiples",
        "PhoneService": "Service téléphonique",
        "Dependents": "Personnes à charge",
        "Partner": "Partenaire",
        "Contract": "Contrat",
        "gender": "Genre",
    }

    for old, new in replacements.items():
        if name.startswith(old):
            name = name.replace(old, new, 1)
            break

    return name.replace("_", " : ")


def local_contributions(pipeline, customer):
    preprocessor = get_preprocessor(pipeline)
    classifier = get_classifier(pipeline)

    if preprocessor is None or not hasattr(classifier, "coef_"):
        return [], []

    try:
        transformed = preprocessor.transform(customer)
        if hasattr(transformed, "toarray"):
            transformed = transformed.toarray()

        x = np.asarray(transformed)[0]
        coef = np.asarray(classifier.coef_)[0]
        names = preprocessor.get_feature_names_out()

        if not (len(x) == len(coef) == len(names)):
            return [], []

        contribution = x * coef

        df = pd.DataFrame({
            "feature": [clean_feature_name(name) for name in names],
            "contribution": contribution,
        })

        df = df[df["contribution"].abs() > 1e-12]

        positive = (
            df[df["contribution"] > 0]
            .sort_values("contribution", ascending=False)
            .head(5)
        )

        negative = (
            df[df["contribution"] < 0]
            .sort_values("contribution", ascending=True)
            .head(5)
        )

        return (
            positive.round(4).to_dict(orient="records"),
            negative.round(4).to_dict(orient="records"),
        )
    except Exception:
        # L'explication est un bonus : une erreur ici ne doit pas bloquer la prédiction.
        return [], []


def risk_level(probability):
    if probability < THRESHOLD:
        return "Faible"
    if probability < 0.60:
        return "Modéré"
    return "Élevé"


def recommendation(level):
    if level == "Élevé":
        return (
            "Priorité élevée : contacter rapidement le client, examiner son contrat "
            "et envisager une action de rétention personnalisée."
        )
    if level == "Modéré":
        return (
            "Client à surveiller : intégrer ce profil à une campagne de rétention "
            "ou proposer une offre ciblée."
        )
    return (
        "Risque faible selon le modèle : aucune alerte immédiate, maintenir le suivi "
        "habituel de la relation client."
    )


def predict_dataframe(df):
    probabilities = MODEL.predict_proba(df)[:, get_yes_index(MODEL)]
    predictions = np.where(probabilities >= THRESHOLD, "Yes", "No")
    levels = [risk_level(float(p)) for p in probabilities]
    return probabilities, predictions, levels


@app.get("/")
def index():
    return render_template(
        "index.html",
        threshold=THRESHOLD,
        metrics=MODEL_METRICS,
    )


@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": True,
        "threshold": THRESHOLD,
    })


@app.post("/api/predict")
def predict():
    try:
        payload = request.get_json(silent=True)
        if not payload:
            return jsonify({"error": "Aucune donnée JSON reçue."}), 400

        customer = normalize_single_customer(payload)

        probability = float(
            MODEL.predict_proba(customer)[0][get_yes_index(MODEL)]
        )

        decision = "Yes" if probability >= THRESHOLD else "No"
        level = risk_level(probability)
        positive, negative = local_contributions(MODEL, customer)

        return jsonify({
            "probability": round(probability, 6),
            "probability_percent": round(probability * 100, 1),
            "threshold": THRESHOLD,
            "decision": decision,
            "risk_level": level,
            "recommendation": recommendation(level),
            "drivers_positive": positive,
            "drivers_negative": negative,
        })

    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        app.logger.exception("Prediction error")
        return jsonify({
            "error": "La prédiction a échoué.",
            "details": str(error),
        }), 500


@app.post("/api/predict-batch")
def predict_batch():
    try:
        if "file" not in request.files:
            return jsonify({"error": "Aucun fichier CSV reçu."}), 400

        uploaded_file = request.files["file"]

        if not uploaded_file.filename.lower().endswith(".csv"):
            return jsonify({"error": "Le fichier doit être au format CSV."}), 400

        df = pd.read_csv(uploaded_file)

        missing = [column for column in FEATURE_COLUMNS if column not in df.columns]
        if missing:
            return jsonify({
                "error": "Colonnes manquantes : " + ", ".join(missing)
            }), 400

        model_df = df[FEATURE_COLUMNS].copy()

        # Tolère Yes/No dans SeniorCitizen en plus de 0/1.
        if model_df["SeniorCitizen"].dtype == "object":
            model_df["SeniorCitizen"] = (
                model_df["SeniorCitizen"]
                .astype(str)
                .str.strip()
                .str.lower()
                .replace({
                    "yes": "1",
                    "oui": "1",
                    "true": "1",
                    "no": "0",
                    "non": "0",
                    "false": "0",
                })
            )

        for column in NUMERIC_COLUMNS:
            model_df[column] = pd.to_numeric(model_df[column], errors="coerce")

        invalid_mask = model_df[NUMERIC_COLUMNS].isna().any(axis=1)
        if invalid_mask.any():
            invalid_rows = (model_df.index[invalid_mask] + 2).tolist()
            return jsonify({
                "error": (
                    "Valeurs numériques invalides dans le CSV. "
                    "Lignes concernées : "
                    + ", ".join(map(str, invalid_rows[:20]))
                    + ("..." if len(invalid_rows) > 20 else "")
                )
            }), 400

        probabilities, predictions, levels = predict_dataframe(model_df)

        results = df.copy()
        results["Churn_Probability"] = np.round(probabilities, 6)
        results["Churn_Prediction"] = predictions
        results["Risk_Level"] = levels

        total = len(results)
        at_risk = int((results["Churn_Prediction"] == "Yes").sum())
        high_risk = int((results["Risk_Level"] == "Élevé").sum())
        avg_probability = float(results["Churn_Probability"].mean()) if total else 0.0

        top = (
            results.sort_values("Churn_Probability", ascending=False)
            .head(10)
            .replace({np.nan: None})
        )

        csv_output = results.to_csv(index=False)

        return jsonify({
            "summary": {
                "total": total,
                "at_risk": at_risk,
                "high_risk": high_risk,
                "alert_rate": round((at_risk / total) * 100, 1) if total else 0,
                "average_probability": round(avg_probability * 100, 1),
            },
            "preview": top.to_dict(orient="records"),
            "csv": csv_output,
        })

    except Exception as error:
        app.logger.exception("Batch prediction error")
        return jsonify({
            "error": "Le scoring du fichier a échoué.",
            "details": str(error),
        }), 500


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
