# Airflow - Pipeline Documents (MVP)

Ce dossier contient une stack Airflow locale pour orchestrer le pipeline:

1. Détection de documents entrants (`data/incoming`)
2. Ingestion en zone `raw`
3. OCR (mocké pour MVP)
4. Extraction d'informations clés
5. Validation métier
6. Écriture zone `curated` + alertes

## Prérequis

- Docker Desktop (WSL2 activé)
- Accès internet pour builder l'image

## 1) Configurer l'environnement

Mettre à jour `airflow/.env`:

- `MONGODB_URI` avec une vraie URI MongoDB
- changer les credentials admin Airflow si besoin

## 2) Démarrer Airflow

Depuis le dossier `airflow`:

```powershell
docker compose up airflow-init
docker compose up -d
```

Puis ouvrir: http://localhost:8080

Identifiants par défaut:

- utilisateur: `admin`
- mot de passe: `admin`

## 3) Lancer le DAG

- DAG: `document_pipeline_mvp`
- Déposer des fichiers test dans `airflow/data/incoming`
- Déclencher le DAG manuellement depuis l'UI (bouton Play)

## 4) Vérifier les sorties

- `airflow/data/raw`: copies des documents
- `airflow/data/clean`: textes OCR mockés (`.txt`)
- `airflow/data/curated`: JSON final par document + fichier alertes

## 5) Arrêter la stack

```powershell
docker compose down
```

## Notes MVP

- L'étape OCR est mockée pour valider l'orchestration.
- Le branchement MongoDB/GridFS est préparé via `MONGODB_URI`.
- Prochaine étape: remplacer le mock OCR par Tesseract réel et écrire en Mongo.
