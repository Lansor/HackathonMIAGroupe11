from __future__ import annotations

import json
import importlib.util
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import gridfs
import pymongo
from bson import ObjectId
from airflow.decorators import dag, task
from pymongo.errors import ConfigurationError

BASE_DATA_PATH = Path("/opt/airflow/data")
RAW_PATH = BASE_DATA_PATH / "raw"
CLEAN_PATH = BASE_DATA_PATH / "clean"
CURATED_PATH = BASE_DATA_PATH / "curated"
MOISE_PIPELINE_PATH = Path("/opt/airflow/hackaipipelinegrp11")


def _load_ocr_pipeline_modules() -> dict[str, Any] | None:
    candidates = [
        Path("/opt/airflow/script/ocr_pipeline.py"),
        Path(__file__).resolve().parent.parent / "script" / "ocr_pipeline.py",
    ]

    for module_path in candidates:
        print(f"[OCR pipeline] Teste: {module_path} (existe: {module_path.exists()})")
        if not module_path.exists():
            continue

        try:
            import cv2
            import numpy as np

            spec = importlib.util.spec_from_file_location("project_ocr_pipeline", str(module_path))
            if spec is None or spec.loader is None:
                continue

            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            print(f" [OCR pipeline] Chargé avec succès depuis: {module_path}")
            return {
                "cv2": cv2,
                "np": np,
                "pdf_to_images": module.pdf_to_images,
                "correct_rotation": module.correct_rotation,
                "preprocess_image": module.preprocess_image,
                "run_ocr_engine": module.run_ocr,
                "process_document": module.process_document,
                "detect_document_type": module.detect_document_type,
            }
        except Exception as exc:
            print(f" [OCR pipeline] Erreur lors du chargement depuis {module_path}: {exc}")

    print(" [OCR pipeline] Impossible de charger le module OCR depuis aucun chemin candidat")
    return None


def _to_float(value: str | None) -> float | None:
    """Convertit une chaîne de caractères en float"""
    if not value:
        return None
    try:
        return float(str(value).replace(",", "."))
    except (ValueError, AttributeError):
        return None


def _parse_date_value(date_str: str | None) -> datetime | None:
    """Parse une date depuis différents formats"""
    if not date_str:
        return None
    try:
        # Essayer format DD/MM/YYYY ou YYYY-MM-DD
        if "T" not in str(date_str):
            if "/" in str(date_str):
                parts = str(date_str).split("/")
                if len(parts) == 3:
                    return datetime(int(parts[2]), int(parts[1]), int(parts[0]))
            elif "-" in str(date_str):
                parts = str(date_str).split("-")
                if len(parts) == 3:
                    return datetime(int(parts[0]), int(parts[1]), int(parts[2]))
        return datetime.fromisoformat(str(date_str))
    except (ValueError, AttributeError):
        return None


def _extract_fields_by_type(doc_type: str, content: str) -> dict[str, Any]:
    """
    Extrait les champs spécifiques selon le type de document
    Chaque type a ses propres patterns et structures
    """
    extracted = {
        "amount_ht": None,
        "amount_ttc": None,
        "date_emission": None,
        "date_delivrance": None,
        "date_expiration": None,
        "siren": None,
        "siret": None,
        "tva": None,
        "tva_rate": None,
        "iban": None,
        "business_name": None,
        "doc_type": doc_type,
        "extracted_raw": {},
    }

    if doc_type == "facture":
        # FACTURE: Montant HT, TVA, Total TTC, SIRET
        # Patterns robustes pour variantes OCR et formats
        siret_match = re.search(r"SIRET\s+(\d{9,14})", content, flags=re.IGNORECASE)
        # HT: accepte "Montant HT" ou "HT" seul avec nombre après
        ht_match = re.search(r"(?:Montant\s+)?HT\s*[:\s]*([0-9]+[\.,][0-9]+)", content, flags=re.IGNORECASE)
        # TVA: accepte "TVA (20%)", "TVA 20%", "TVA (20)", avec espaces flexibles
        tva_rate_match = re.search(r"TVA\s*\(?\s*(\d{1,2})\s*%?\s*\)?", content, flags=re.IGNORECASE)
        # TTC: accepte "Total TTC", "TOTAL TTC", "Montant TTC", etc.
        ttc_match = re.search(r"(?:Total|Montant)\s+TTC\s*[:\s]*([0-9]+[\.,][0-9]+)", content, flags=re.IGNORECASE)
        # Date: flexible pour plusieurs formats
        date_match = re.search(r"(?:généré|émis?|date)?\s+le\s+(\d{1,2})/(\d{1,2})/(\d{4})", content, flags=re.IGNORECASE)
        
        extracted["siret"] = siret_match.group(1) if siret_match else None
        extracted["siren"] = siret_match.group(1)[:9] if siret_match and len(siret_match.group(1)) >= 9 else None
        extracted["amount_ht"] = ht_match.group(1).replace(",", ".") if ht_match else None
        extracted["amount_ttc"] = ttc_match.group(1).replace(",", ".") if ttc_match else None
        extracted["tva_rate"] = tva_rate_match.group(1) if tva_rate_match else None
        if date_match:
            extracted["date_emission"] = f"{date_match.group(3)}-{date_match.group(2)}-{date_match.group(1)}"

    elif doc_type == "rib":
        # RIB: IBAN, BIC, Titulaire, Nom/Dénomination
        # IBAN: CC + 2 digits (chèque) + max 30 caractères alphanumériques
        iban_match = re.search(r"IBAN\s+([A-Z]{2}\d{2}[A-Z0-9]{1,30})(?:\s|$|BIC)", content, flags=re.IGNORECASE)
        bic_match = re.search(r"BIC\s+(\w+)", content)
        # Nom/Dénomination: après "Nom / Dénomination" jusqu'à fin de ligne ou mot-clé suivant
        name_match = re.search(r"Nom\s+/\s+Dénomination\s+(.+?)(?:\n|Coordonnées)", content, flags=re.IGNORECASE)
        
        if iban_match:
            extracted["iban"] = iban_match.group(1).replace(" ", "")
        
        extracted["extracted_raw"]["bic"] = bic_match.group(1) if bic_match else None
        extracted["business_name"] = name_match.group(1).strip() if name_match else None

    elif doc_type == "urssaf":
        # URSSAF: SIRET (12-14 chiffres pour établissement), Période, Total cotisations, Date limite paiement
        # Accepte SIRET 12 chiffres (code établissement) ou 14 chiffres (SIRET complet)
        siret_match = re.search(r"SIRET\s+(\d{12,14})", content, flags=re.IGNORECASE)
        total_match = re.search(r"TOTAL\s*:\s*([0-9]+[\.,][0-9]+)", content, flags=re.IGNORECASE)
        period_match = re.search(r"Période\s+(\d{1,2})/(\d{4})", content, flags=re.IGNORECASE)
        # Accepte variantes OCR: "avant", "avanl", "avant le", etc.
        date_paiement_match = re.search(r"(?:Paiement|paiement)?\s*(?:attendu|avanl|avant)?\s*(?:avant|avanl)?\s+le\s+(\d{1,2})/(\d{1,2})/(\d{4})", content, flags=re.IGNORECASE)
        
        extracted["siret"] = siret_match.group(1) if siret_match else None
        extracted["siren"] = extracted["siret"][:9] if extracted["siret"] and len(extracted["siret"]) >= 9 else None
        extracted["amount_ttc"] = total_match.group(1).replace(",", ".") if total_match else None
        extracted["extracted_raw"]["period"] = f"{period_match.group(2)}-{period_match.group(1)}" if period_match else None
        
        if date_paiement_match:
            extracted["date_expiration"] = f"{date_paiement_match.group(3)}-{date_paiement_match.group(2)}-{date_paiement_match.group(1)}"

    elif doc_type == "kbis":
        # KBIS: SIREN, SIRET, Raison sociale, Capital, Date création, Gérant
        # Accepte variantes OCR: "N°", "N'", "N " pour le séparateur
        # SIREN: 7-9 chiffres, SIRET: 12-14 chiffres (flexibilité pour variantes)
        siren_match = re.search(r"N[°'\s]\s*SIREN\s+(\d{7,9})", content, flags=re.IGNORECASE)
        siret_match = re.search(r"N[°'\s]\s*SIRET\s+(\d{12,14})", content, flags=re.IGNORECASE)
        capital_match = re.search(r"Capital\s+social\s+([0-9]+[\s0-9]*)", content, flags=re.IGNORECASE)
        date_creation_match = re.search(r"Date\s+de\s+création\s+(\d{1,2})/(\d{1,2})/(\d{4})", content, flags=re.IGNORECASE)
        # Raison sociale: après "Raison sociale" jusqu'à fin de ligne ou N°
        raison_match = re.search(r"Raison\s+sociale\s+(.+?)(?:\n|N[°'\s])", content, flags=re.IGNORECASE)
        
        extracted["siren"] = siren_match.group(1) if siren_match else None
        extracted["siret"] = siret_match.group(1) if siret_match else None
        extracted["business_name"] = raison_match.group(1).strip() if raison_match else None
        extracted["extracted_raw"]["capital"] = capital_match.group(1).replace(" ", "") if capital_match else None
        
        if date_creation_match:
            extracted["date_emission"] = f"{date_creation_match.group(3)}-{date_creation_match.group(2)}-{date_creation_match.group(1)}"
        
        # KBIS valide 3 mois à partir de la date de création
        if extracted["date_emission"]:
            from datetime import timedelta
            creation_date = _parse_date_value(extracted["date_emission"])
            if creation_date:
                expiration = creation_date + timedelta(days=90)
                extracted["date_expiration"] = expiration.isoformat().split("T")[0]

    return extracted


def _ensure_paths() -> None:
    RAW_PATH.mkdir(parents=True, exist_ok=True)
    CLEAN_PATH.mkdir(parents=True, exist_ok=True)
    CURATED_PATH.mkdir(parents=True, exist_ok=True)


def _get_mongo_client() -> pymongo.MongoClient:
    uri = os.environ["MONGODB_URI"]
    return pymongo.MongoClient(uri, serverSelectionTimeoutMS=10000)


def _get_db(client: pymongo.MongoClient) -> pymongo.database.Database:
    db_name = os.getenv("MONGODB_DB")
    if db_name:
        return client[db_name]

    try:
        return client.get_database()
    except ConfigurationError:
        return client["buildup"]


OCR_PIPELINE = None


@dag(
    dag_id="document_pipeline_mvp",
    start_date=datetime(2026, 1, 1),
    schedule=None,
    catchup=False,
    max_active_runs=1,
    default_args={
        "owner": "hackathon-team",
        "retries": 0,
    },
    tags=["documents", "ocr", "compliance", "mvp"],
)
def document_pipeline_mvp() -> None:
    @task
    def detect_new_documents() -> list[dict[str, Any]]:
        _ensure_paths()
        documents: list[dict[str, Any]] = []

        client = _get_mongo_client()
        db = _get_db(client)
        raw_col = db["rawdocuments"]

        pending_raw_docs = list(
            raw_col.find(
                {
                    "status": "PENDING",
                    "gridfs_id": {"$exists": True},
                }
            ).sort("createdAt", pymongo.ASCENDING)
        )

        now_iso = datetime.utcnow().isoformat()
        for raw_doc in pending_raw_docs:
            filename = str(raw_doc.get("filename", "uploaded_document"))
            document_id = str(raw_doc.get("_id"))
            documents.append(
                {
                    "document_id": document_id,
                    "raw_doc_id": str(raw_doc.get("_id")),
                    "user_id": str(raw_doc.get("user_id")) if raw_doc.get("user_id") else None,
                    "filename": filename,
                    "gridfs_id": str(raw_doc.get("gridfs_id")),
                    "status": "DETECTED",
                    "detected_at": now_iso,
                }
            )

        if documents:
            print(f"{len(documents)} document(s) récupéré(s) depuis MongoDB")
            client.close()
            return documents

        client.close()

        print("Aucun nouveau document disponible dans MongoDB (rawdocuments)")

        return documents

    @task
    def ingest_to_raw(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
        ingested: list[dict[str, Any]] = []
        client = _get_mongo_client()
        db = _get_db(client)
        fs_bucket = gridfs.GridFSBucket(db, bucket_name="documents")
        raw_col = db["rawdocuments"]

        for doc in documents:
            filename = str(doc.get("filename", "uploaded_document"))
            dst = RAW_PATH / filename

            gridfs_id = doc.get("gridfs_id")

            if not gridfs_id:
                print(f"[WARN] document '{doc['document_id']}' ignoré: gridfs_id manquant")
                continue

            with open(dst, "wb") as local_file:
                download_stream = fs_bucket.open_download_stream(ObjectId(gridfs_id))
                local_file.write(download_stream.read())

            updated = {
                **doc,
                "raw_path": str(dst),
                "gridfs_id": str(gridfs_id),
                "ingested_at": datetime.utcnow().isoformat(),
            }

            print(f"[Mongo] document '{updated['document_id']}' ingéré (local)")
            ingested.append(updated)

        client.close()
        return ingested

    @task
    def run_ocr(ingested_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Applique l'OCR sur les documents avec ocr_pipeline et les stocke dans clean_ocr"""
        # Charger le module OCR AU MOMENT DE L'EXÉCUTION (pas au parsing du DAG)
        ocr_pipeline = _load_ocr_pipeline_modules()
        
        client = _get_mongo_client()
        db = _get_db(client)
        
        if ocr_pipeline is None:
            client.close()
            raise RuntimeError("[ERROR] OCR pipeline non disponible - Arrêt du workflow")
        
        process_document = ocr_pipeline["process_document"]
        
        for doc in ingested_docs:
            file_path = doc["raw_path"]
            document_id = doc["raw_doc_id"]
            user_id = doc["user_id"]
            
            print(f"\n[RUN_OCR CALL] process_document() avec:")
            print(f"   file_path: {file_path}")
            print(f"   document_id: {document_id}")
            print(f"   user_id: {user_id}")
            
            try:
                # Appel du script OCR qui insère directement dans clean_ocr
                process_document(file_path, document_id, user_id, db)
                print(f"[OCR] Document {document_id} traité avec succès")
                
                # Mise à jour du statut dans rawdocuments
                raw_col = db["rawdocuments"]
                raw_col.update_one(
                    {"_id": ObjectId(document_id)},
                    {"$set": {
                        "status": "OCR_COMPLETED",
                        "ocr_completed_at": datetime.now().isoformat()
                    }}
                )
                
            except Exception as exc:
                client.close()
                raise RuntimeError(f"[ERROR] OCR échoué pour {document_id}: {exc}") from exc
        
        print(f"\n [RUN_OCR OUTPUT] Retour {len(ingested_docs)} document(s)")
        print(f"   └─ Exemple premier doc keys: {list(ingested_docs[0].keys()) if ingested_docs else 'N/A'}")
        print(f"   └─ Exemple premier doc:\n{json.dumps(ingested_docs[0], indent=2, ensure_ascii=False, default=str) if ingested_docs else 'N/A'}")
        
        client.close()
        return ingested_docs

    @task
    def extract_entities(clean_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Extrait les entités depuis le raw_text stocké dans cleanocrs"""
        print(f"\n [EXTRACT INPUT] Reçu {len(clean_docs)} document(s) à traiter")
        print(f"   └─ Exemple premier doc keys: {list(clean_docs[0].keys()) if clean_docs else 'N/A'}")
        print(f"   └─ Exemple premier doc (complet):\n{json.dumps(clean_docs[0], indent=2, ensure_ascii=False, default=str) if clean_docs else 'N/A'}")
        if not clean_docs:
            raise RuntimeError("[ERREUR CRITIQUE] extract_entities: aucun document à traiter")
        
        # Charger le module OCR pour détecter les types
        ocr_pipeline = _load_ocr_pipeline_modules()
        detect_func = ocr_pipeline.get("detect_document_type") if ocr_pipeline else None
        
        extracted_docs = []
        client = _get_mongo_client()
        db = _get_db(client)
        clean_ocr_col = db["cleanocrs"]

        for doc in clean_docs:
            # Récupérer le raw_text depuis cleanocrs (créé par run_ocr)
            raw_doc_id_str = doc.get("raw_doc_id", "")
            print(f"\n    Cherche en MongoDB cleanocrs avec raw_document_id = ObjectId('{raw_doc_id_str}')")
            
            try:
                raw_doc_id_obj = ObjectId(raw_doc_id_str)
            except Exception as e:
                print(f"    Erreur conversion ObjectId: {e}")
                continue
            
            clean_ocr_doc = clean_ocr_col.find_one({"raw_document_id": raw_doc_id_obj})
            if not clean_ocr_doc:
                print(f"    Pas trouvé dans cleanocrs (total: {clean_ocr_col.count_documents({})} docs)")
                continue
            
            print(f"    Trouvé en cleanocrs !")
            
            content = clean_ocr_doc.get("raw_text", "")
            
            # Détecter le type de document à partir du contenu OCR
            doc_type = detect_func(content) if detect_func else "unknown"
            print(f"   └─ Type détecté: {doc_type}")
            
            print(f"\n [EXTRACT] Document: {doc.get('raw_doc_id')}")
            print(f"   └─ Raw text length: {len(content)} chars")
            print(f"   └─ OCR confidence: {clean_ocr_doc.get('conf_score', 'N/A')}")
            print(f"   └─ Pages: {len(clean_ocr_doc.get('pages', []))}")

            extracted_raw = {}  # TODO: Implémente EXTRACT_INFO si nécessaire

            # Extraction spécifique au type de document
            extracted = _extract_fields_by_type(doc_type, content)

            # Afficher seulement les champs non-None pour ce type
            non_null = {k: v for k, v in extracted.items() if v is not None and k != "extracted_raw"}
            print(f"   Champs extraits pour {doc_type}:")
            print(f"      └─ {json.dumps(non_null, ensure_ascii=False, indent=8)}")

            print(f"   Extracted fields created")
            print(f"      └─ Full extracted dict keys: {list(extracted.keys())}")

            updated = {
                **doc,
                "document_id": doc.get("document_id"),
                "raw_document_id": doc.get("raw_doc_id"),
                "extracted_fields": extracted,
                "status": "EXTRACTED",
                "extracted_at": datetime.utcnow().isoformat(),
            }

            # Mise à jour statut dans documents (si existe)
            if updated.get("document_id"):
                print(f"[Extraction] '{updated['document_id']}' extraite depuis cleanocrs")
            
            extracted_docs.append(updated)

        # Récupérer le count AVANT de fermer la connexion
        count_cleanocrs = clean_ocr_col.count_documents({})
        client.close()
        
        if not extracted_docs:
            print(f"\n [ERREUR CRITIQUE] extract_entities:")
            print(f"   Reçu en entrée: {len(clean_docs)} document(s)")
            print(f"   Extraits avec succès: {len(extracted_docs)} document(s)")
            print(f"   Collecte MongoDB cleanocrs total: {count_cleanocrs} documents")
            raise RuntimeError("[ERREUR CRITIQUE] extract_entities: aucun document extrait avec succès")
      
        
        print(f"\n[EXTRACT] Résumé: {len(extracted_docs)} document(s) traité(s)")
        if extracted_docs:
            print(f"   └─ Sample: {list(extracted_docs[0].get('extracted_fields', {}).keys())}")
        return extracted_docs

    @task
    def validate_business_rules(extracted_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Validation métier complète:
        1. KBIS: Socle du dossier, vérification de l'obsolescence
        2. RIB: Moyen de paiement, vérification du KBIS lié
        3. URSSAF: Conformité sociale, vérification de l'expiration
        4. FACTURE: Triple vérification (cohérence HT/TVA/TTC + existence SIRET)
        """
        validated_docs: list[dict[str, Any]] = []
        client = _get_mongo_client()
        db = _get_db(client)
        clean_ocr_col = db["cleanocrs"]
        curated_col = db["curated_data"]
        suppliers_col = db["supplier_status"]
        
        # Charger le module OCR une fois
        ocr_pipeline = _load_ocr_pipeline_modules()
        detect_func = ocr_pipeline.get("detect_document_type") if ocr_pipeline else None

        for doc in extracted_docs:
            fields = doc.get("extracted_fields", {})
            alerts: list[dict[str, str]] = []
            status = "VALIDATED"

            # Récupérer le document clean_ocr pour obtenir le raw_text
            clean_ocr_doc = clean_ocr_col.find_one({"raw_document_id": ObjectId(doc.get("document_id", ""))})
            raw_text = clean_ocr_doc.get("raw_text", "") if clean_ocr_doc else ""
            
            # Détecter le type basée sur le contenu OCR
            doc_type = detect_func(raw_text) if detect_func else "unknown"
            
            siren = fields.get("siren")
            siret = fields.get("siret")
            if not siren and siret:
                siren = siret[:9]

            now = datetime.utcnow()

            # ==================== KBIS ====================
            if doc_type == "kbis":
                date_delivrance = _parse_date_value(fields.get("date_delivrance") or fields.get("date_emission"))

                if not siren:
                    alerts.append({"level": "critical", "message": "KBIS sans SIREN exploitable"})
                    status = "NEEDS_REVIEW"
                else:
                    existing_kbis = curated_col.find_one(
                        {"doc_type": "kbis", "siren": siren, "is_active": True},
                        sort=[("date_delivrance", pymongo.DESCENDING)],
                    )

                    # Cas 1: SIREN inexistant en base → Création nouvelle entrée
                    if not existing_kbis:
                        print(f"[KBIS] Nouveau SIREN {siren}: création d'une nouvelle entrée")
                        curated_col.insert_one({
                            "document_id": doc.get("document_id"),
                            "doc_type": "kbis",
                            "siren": siren,
                            "siret": siret,
                            "fields": fields,
                            "status": "VALIDATED",
                            "alerts": [],
                            "is_active": True,
                            "date_delivrance": date_delivrance.isoformat() if date_delivrance else None,
                            "created_at": now.isoformat(),
                            "updated_at": now.isoformat(),
                        })
                    # Cas 2: SIREN existe - Vérification de la date
                    else:
                        existing_date = _parse_date_value(existing_kbis.get("date_delivrance"))
                        if date_delivrance and existing_date and date_delivrance > existing_date:
                            print(f"[KBIS] SIREN {siren}: remplacement de l'ancien Kbis")
                            curated_col.update_one(
                                {"_id": existing_kbis["_id"]},
                                {"$set": {
                                    "is_active": False,
                                    "archived_at": now.isoformat(),
                                    "archived_reason": "Nouvelle version disponible"
                                }},
                            )
                            # Créer la nouvelle entrée
                            curated_col.insert_one({
                                "document_id": doc.get("document_id"),
                                "doc_type": "kbis",
                                "siren": siren,
                                "siret": siret,
                                "fields": fields,
                                "status": "VALIDATED",
                                "alerts": [],
                                "is_active": True,
                                "date_delivrance": date_delivrance.isoformat() if date_delivrance else None,
                                "created_at": now.isoformat(),
                                "updated_at": now.isoformat(),
                            })
                        elif existing_date and (not date_delivrance or date_delivrance <= existing_date):
                            alerts.append({"level": "warning", "message": "KBIS plus ancien que celui en base"})
                            status = "NEEDS_REVIEW"
                    
                    # Vérification obsolescence (> 3 mois)
                    if date_delivrance and (now - date_delivrance).days > 90:
                        alerts.append({"level": "critical", "message": "KBIS obsolète (> 3 mois)"})
                        status = "INCOMPLET_OBSOLETE"

            # ==================== RIB ====================
            elif doc_type == "rib":
                iban = fields.get("iban")
                
                # Vérification: existe-t-il un KBIS validé?
                kbis_ok = bool(
                    siren
                    and curated_col.find_one({
                        "doc_type": "kbis",
                        "siren": siren,
                        "is_active": True,
                        "status": {"$in": ["VALIDATED", "UPDATED"]},
                    })
                )

                if not iban:
                    alerts.append({"level": "critical", "message": "RIB sans IBAN"})
                    status = "NEEDS_REVIEW"

                if not kbis_ok:
                    alerts.append({"level": "warning", "message": "Aucun KBIS validé correspondant au RIB"})
                    status = "PENDING"
                    print(f"[RIB] Pas de KBIS trouvé pour SIREN {siren}")
                else:
                    # Archive l'ancien RIB s'il existe
                    if siren:
                        existing_rib = curated_col.find_one({
                            "doc_type": "rib",
                            "siren": siren,
                            "is_active": True,
                        })
                        if existing_rib:
                            curated_col.update_one(
                                {"_id": existing_rib["_id"]},
                                {"$set": {
                                    "is_active": False,
                                    "archived_at": now.isoformat(),
                                    "archived_reason": "Nouveau RIB reçu"
                                }},
                            )
                            print(f"[RIB] Ancien RIB archivé pour SIREN {siren}")

            # ==================== URSSAF / ATTESTATION ====================
            elif doc_type == "urssaf" or doc_type == "attestation":
                expiration = _parse_date_value(fields.get("date_expiration"))
                link_siren = siren or (siret[:9] if siret else None)

                # Lien: existe-t-il un KBIS?
                kbis_ok = bool(
                    link_siren
                    and curated_col.find_one({
                        "doc_type": "kbis",
                        "siren": link_siren,
                        "is_active": True,
                        "status": {"$in": ["VALIDATED", "UPDATED"]},
                    })
                )

                if not kbis_ok:
                    alerts.append({"level": "warning", "message": "Attestation URSSAF sans KBIS lié"})
                    status = "PENDING"
                    print(f"[URSSAF] Pas de KBIS trouvé pour SIRET {siret}")

                # Vérification de l'expiration
                if expiration and expiration.date() < now.date():
                    alerts.append({"level": "critical", "message": "Attestation URSSAF expirée: fournisseur bloqué paiement"})
                    status = "BLOQUE_PAIEMENT"
                    if link_siren:
                        suppliers_col.update_one(
                            {"siren": link_siren},
                            {"$set": {
                                "siren": link_siren,
                                "payment_status": "BLOCKED",
                                "reason": "URSSAF_EXPIRED",
                                "expired_at": expiration.isoformat(),
                                "updated_at": now.isoformat(),
                            }},
                            upsert=True,
                        )
                        print(f"[URSSAF] Fournisseur {link_siren} BLOQUÉ pour paiement")

            # ==================== FACTURE ====================
            elif doc_type == "facture":
                amount_ht = _to_float(fields.get("amount_ht"))
                amount_ttc = _to_float(fields.get("amount_ttc"))
                tva_rate = _to_float(fields.get("tva_rate"))

                # Vérification 1: Cohérence interne HT + TVA = TTC
                if amount_ht is None or amount_ttc is None or tva_rate is None:
                    alerts.append({"level": "warning", "message": "Facture incomplète (HT/TVA/TTC manquants)"})
                    status = "NEEDS_REVIEW"
                else:
                    expected_ttc = round(amount_ht * (1 + tva_rate / 100), 2)
                    if abs(expected_ttc - amount_ttc) > 0.02:
                        alerts.append({"level": "critical", "message": f"Incohérence facture: HT({amount_ht}) + TVA({tva_rate}%) != TTC({amount_ttc})"})
                        status = "NEEDS_REVIEW"
                        print(f"[FACTURE] Incohérence: calcul {expected_ttc}, facture {amount_ttc}")

                # Vérification 2: Existence du SIRET dans la base (KBIS validé)
                link_siren = siren or (siret[:9] if siret else None)
                kbis_ok = bool(
                    link_siren
                    and curated_col.find_one({
                        "doc_type": "kbis",
                        "siren": link_siren,
                        "is_active": True,
                        "status": {"$in": ["VALIDATED", "UPDATED"]},
                    })
                )
                if not kbis_ok:
                    alerts.append({"level": "critical", "message": "SIRET/SIREN facture absent de la base fournisseurs validés"})
                    status = "NEEDS_REVIEW"
                    print(f"[FACTURE] SIREN {link_siren} non trouvé ou non validé")

            # Vérification finale: SIREN valide (9 chiffres)
            if siren and len(siren) != 9:
                alerts.append({"level": "warning", "message": "SIREN invalide (doit faire 9 chiffres)"})
                if status == "VALIDATED":
                    status = "NEEDS_REVIEW"

            # Stockage dans curated_data
            if "document_id" in doc:
                curated_col.update_one(
                    {"document_id": doc["document_id"]},
                    {"$set": {
                        "document_id": doc["document_id"],
                        "doc_type": doc_type,
                        "siren": siren,
                        "siret": siret,
                        "fields": fields,
                        "status": status,
                        "alerts": alerts,
                        "is_active": True,
                        "updated_at": now.isoformat(),
                    }},
                    upsert=True,
                )

            validated_docs.append({
                **doc,
                "doc_type": doc_type,
                "validation_alerts": alerts,
                "status": status,
                "validated_at": datetime.utcnow().isoformat(),
            })

        client.close()
        return validated_docs

    @task
    def write_curated(validated_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        outputs: list[dict[str, Any]] = []
        client = _get_mongo_client()
        db = _get_db(client)
        col_docs = db["documents"]

        for doc in validated_docs:
            # Fichier local curated (gardé pour debug)
            curated_file = CURATED_PATH / f"{doc['document_id']}.json"
            curated_file.write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")

            # Mise à jour statut final + champs validés dans MongoDB
            col_docs.update_one(
                {"document_id": doc["document_id"]},
                {"$set": {
                    "status": doc["status"],
                    "validation_alerts": doc.get("validation_alerts", []),
                    "validated_at": doc.get("validated_at"),
                    "curated_path": str(curated_file),
                    "zone": "curated",
                }},
            )
            print(f"[Mongo] document '{doc['document_id']}' mis à jour → {doc['status']}")

            outputs.append(
                {
                    "document_id": doc["document_id"],
                    "curated_path": str(curated_file),
                    "status": doc["status"],
                    "alerts_count": len(doc.get("validation_alerts", [])),
                }
            )

        client.close()
        return outputs

    @task
    def create_alerts(curated_outputs: list[dict[str, Any]]) -> None:
        client = _get_mongo_client()
        db = _get_db(client)
        col_alerts = db["alerts"]
        col_runs = db["pipeline_runs"]

        alerts_payload = []
        for item in curated_outputs:
            alert = {
                "document_id": item["document_id"],
                "level": "warning" if item["alerts_count"] > 0 else "info",
                "message": "Revue manuelle requise" if item["alerts_count"] > 0 else "Aucune alerte",
                "status": item["status"],
                "created_at": datetime.utcnow().isoformat(),
            }
            # Upsert alerte pour ce document
            col_alerts.update_one(
                {"document_id": item["document_id"]},
                {"$set": alert},
                upsert=True,
            )
            alerts_payload.append(alert)
            print(f"[Mongo] alerte '{item['document_id']}' → {alert['level']}")

        # Enregistrement du run pipeline pour audit
        col_runs.insert_one({
            "run_at": datetime.utcnow().isoformat(),
            "documents_processed": len(curated_outputs),
            "alerts_generated": sum(1 for a in alerts_payload if a["level"] != "info"),
            "statuses": [item["status"] for item in curated_outputs],
        })
        print(f"[Mongo] pipeline_run enregistré — {len(curated_outputs)} document(s) traités")

        # Fichier local gardé pour debug
        alerts_file = CURATED_PATH / f"alerts_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        alerts_file.write_text(json.dumps(alerts_payload, indent=2, ensure_ascii=False), encoding="utf-8")
        client.close()

    detected = detect_new_documents()
    ingested = ingest_to_raw(detected)
    cleaned = run_ocr(ingested)
    # Pause temporaire après OCR
    extracted = extract_entities(cleaned)
    # validated = validate_business_rules(extracted)
    # curated = write_curated(validated)
    # create_alerts(curated)


document_pipeline_mvp()
