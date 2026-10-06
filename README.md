# Customer Churn Prediction

## Présentation

Ce projet vise à prédire le churn des clients d'une entreprise de télécommunications
à l'aide de plusieurs algorithmes de Machine Learning.

L'objectif principal est d'identifier efficacement les clients susceptibles de quitter
l'entreprise afin de permettre la mise en place d'actions de rétention ciblées.

---

## Dataset

Le dataset contient **7 043 clients** et plusieurs informations concernant :

- les caractéristiques démographiques ;
- les services souscrits ;
- l'ancienneté du client (`tenure`) ;
- le type de contrat ;
- la méthode de paiement ;
- les frais mensuels ;
- les frais totaux.

La variable cible est :

```text
Churn
```

avec deux classes :

```text
Yes / No
```

---

## Workflow du projet

Le projet suit un workflow complet de Machine Learning :

1. Nettoyage et préparation des données
2. Analyse exploratoire des données (EDA)
3. Préparation des variables
4. Séparation Train / Test
5. Prétraitement avec `ColumnTransformer`
6. Création de pipelines Machine Learning
7. Baseline avec `DummyClassifier`
8. Entraînement et optimisation de plusieurs modèles
9. Comparaison des modèles par validation croisée
10. Sélection de la Logistic Regression
11. Interprétation des coefficients
12. Optimisation du seuil de décision
13. Évaluation finale sur le jeu de test
14. Sauvegarde du modèle
15. Prédiction sur de nouveaux clients

---

## Prétraitement des données

Le prétraitement est réalisé avec un `ColumnTransformer`.

Les variables numériques sont standardisées avec :

```python
StandardScaler()
```

Les variables catégorielles sont encodées avec :

```python
OneHotEncoder(handle_unknown="ignore")
```

Le prétraitement et le modèle sont ensuite regroupés dans un `Pipeline` afin de
garantir un traitement cohérent des données pendant l'entraînement et la prédiction.

---

## Modèles testés

Plusieurs algorithmes de classification ont été comparés :

- Logistic Regression
- Decision Tree
- Random Forest
- Gradient Boosting
- Support Vector Machine
- K-Nearest Neighbors
- Multi-Layer Perceptron

Les hyperparamètres des modèles ont été optimisés avec `GridSearchCV`.

La sélection du modèle final est réalisée principalement à partir du
**F1-score en validation croisée**.

---

## Modèle final

La **Logistic Regression** a été sélectionnée comme modèle final.

Elle obtient un F1-score moyen en validation croisée d'environ :

```text
F1 CV ≈ 0.599
```

Le modèle a été choisi sur la base des performances obtenues sur les données
d'entraînement par validation croisée, sans utiliser le jeu de test pour la sélection.

---

## Optimisation du seuil de décision

Le seuil par défaut de classification est généralement :

```text
0.50
```

Dans ce projet, le seuil a été optimisé à partir de prédictions
**Out-of-Fold** générées uniquement sur les données d'entraînement.

Le seuil sélectionné est :

```text
0.30
```

Ce seuil permet d'améliorer le Recall et donc de détecter davantage de clients
susceptibles de churner.

Ce choix accepte une baisse de la Precision en échange d'une meilleure détection
des churners.

---

## Résultats sur le jeu de test

Le modèle final est évalué une seule fois sur le jeu de test.

| Métrique | Score |
|---|---:|
| Accuracy | 0.749 |
| Precision | 0.518 |
| Recall | 0.751 |
| F1-score | 0.614 |
| ROC-AUC | 0.841 |
| PR-AUC | 0.628 |

Le modèle détecte environ **75 % des clients qui churnent**.

La ROC-AUC de **0.841** montre une bonne capacité du modèle à distinguer les
clients qui churnent de ceux qui restent.

La PR-AUC de **0.628** est également largement supérieure à la proportion de
la classe positive dans le dataset.

---

## Interprétation du modèle

L'analyse des coefficients de la Logistic Regression permet d'identifier les
variables les plus associées au churn.

Parmi les facteurs associés à un risque de churn plus élevé :

- contrat `Month-to-month` ;
- service Internet `Fiber optic` ;
- certains services de streaming ;
- paiement par `Electronic check`.

Parmi les facteurs associés à un risque de churn plus faible :

- ancienneté élevée (`tenure`) ;
- contrat `Two year` ;
- certaines configurations de services Internet.

Ces résultats représentent des associations apprises par le modèle et ne doivent
pas être interprétés comme des relations causales.

---

## Justification métier

Dans un problème de churn, ne pas détecter un client qui risque de partir peut
être plus coûteux que contacter un client qui finalement reste.

Le seuil de **0.30** permet donc d'augmenter le Recall afin d'identifier un maximum
de clients à risque.

Cela peut permettre à l'entreprise de mettre en place plus tôt des actions telles que :

- offres personnalisées ;
- réductions ;
- programmes de fidélité ;
- amélioration du support client ;
- campagnes de rétention ciblées.

L'objectif n'est donc pas uniquement d'obtenir une bonne Accuracy, mais surtout
d'identifier efficacement les clients susceptibles de quitter l'entreprise.

---

## Technologies utilisées

- Python
- NumPy
- Pandas
- Matplotlib
- Seaborn
- Scikit-learn
- Joblib
- Jupyter Notebook
- VS Code

---

## Structure du projet

```text
Customer-Churn-Project/
│
├── customer_churn_NB_finale.ipynb
├── WA_Fn-UseC_-Telco-Customer-Churn.csv
├── final_churn_model.joblib
├── requirements.txt
├── README.md
└── .gitignore
```

---

## Installation

Cloner le projet :

```bash
git clone <https://github.com/SaadZrioul/customer-churn-prediction.git>
```

Accéder au dossier :

```bash
cd Customer-Churn-Project
```

Créer un environnement virtuel :

```bash
python -m venv .venv
```

Sous Windows, activer l'environnement :

```bash
.venv\Scripts\activate
```

Installer les dépendances :

```bash
pip install -r requirements.txt
```

Ensuite, ouvrir le notebook :

```text
customer_churn_NB_finale.ipynb
```

---

## Dépendances principales

Le projet utilise notamment :

```text
numpy==2.2.6
pandas==2.2.3
scikit-learn==1.5.2
scipy==1.14.1
matplotlib==3.9.2
seaborn==0.13.2
joblib==1.4.2
```

---

## Sauvegarde du modèle

Le modèle final et le seuil de décision sont sauvegardés avec `joblib`.

Le fichier généré est :

```text
final_churn_model.joblib
```

Il contient :

- le pipeline de prétraitement et de classification ;
- le seuil de décision optimisé.

Cela permet de recharger directement le modèle sans devoir réentraîner toute la pipeline.

---

## Exemple de prédiction

Le modèle peut être utilisé pour prédire le risque de churn d'un nouveau client.

Il retourne une probabilité de churn, par exemple :

```text
P(Churn) = 0.81
```

Cette probabilité est ensuite comparée au seuil :

```text
Seuil = 0.30
```

Si :

```text
P(Churn) >= 0.30
```

le client est considéré comme présentant un risque élevé de churn.

---

## Conclusion

Ce projet met en œuvre un workflow complet de Machine Learning pour la prédiction
du churn client.

Après comparaison de plusieurs algorithmes par validation croisée, la
**Logistic Regression** a été sélectionnée comme modèle final.

L'optimisation du seuil de décision à **0.30** permet d'augmenter la capacité du
modèle à détecter les clients susceptibles de churner.

Le projet met également en évidence l'importance :

- de la validation croisée ;
- du choix d'une métrique adaptée ;
- de l'interprétation du modèle ;
- de l'optimisation du seuil ;
- de la séparation rigoureuse entre données d'entraînement et données de test ;
- de la reproductibilité du projet.

Ce modèle peut servir de base à un système d'aide à la décision pour des campagnes
de rétention client.