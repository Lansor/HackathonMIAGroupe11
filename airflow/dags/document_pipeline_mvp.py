from __future__ import annotations

import json
import os
import re
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import gridfs
import pymongo
from airflow.decorators import dag, task

BASE_DATA_PATH = Path("/opt/airflow/data")
INCOMING_PATH = BASE_DATA_PATH / "incoming"
RAW_PATH = BASE_DATA_PATH / "raw"
CLEAN_PATH = BASE_DATA_PATH / "clean"
CURATED_PATH = BASE_DATA_PATH / "curated"
MOISE_PIPELINE_PATH = Path("/opt/airflow/hackaipipelinegrp11")


def _detect_doc_type(filename: str) -> str:
    lower = filename.lower()
    if "facture" in lower:
        return "facture"
    if "devis" in lower:
        return "devis"
    if "kbis" in lower:
        return "kbis"
    if "rib" in lower:
        return "rib"
    if "attestation" in lower:
        return "attestation"
    return "unknown"


def _ensure_paths() -> None:
    INCOMING_PATH.mkdir(parents=True, exist_ok=True)
    RAW_PATH.mkdir(parents=True, exist_ok=True)
    CLEAN_PATH.mkdir(parents=True, exist_ok=True)
    CURATED_PATH.mkdir(parents=True, exist_ok=True)


def _load_moise_modules() -> tuple[Any, Any, Any]:
    if not MOISE_PIPELINE_PATH.exists():
        print("[Moise] dossier hackaipipelinegrp11 non monté, fallback MVP activé")
        return None, None, None

    path_str = str(MOISE_PIPELINE_PATH)
    if path_str not in sys.path:
        sys.path.append(path_str)

    try:
        from ocr_service import ocr_from_image, ocr_from_pdf
        from classifier import classify_document
        from extractor import extract_info

        return (ocr_from_pdf, ocr_from_image), classify_document, extract_info
    except Exception as exc:
        print(f"[Moise] import modules impossible: {exc} | fallback MVP activé")
        return None, None, None


def _normalize_doc_type(label: str | None) -> str | None:
    if not label:
        return None
    lowered = label.lower().strip()
    if lowered == "attestation siret":
        return "attestation"
    return lowered


def _get_mongo_client() -> pymongo.MongoClient:
    uri = os.environ["MONGODB_URI"]
    return pymongo.MongoClient(uri, serverSelectionTimeoutMS=10000)


def _get_db(client: pymongo.MongoClient) -> pymongo.database.Database:
    return client.get_database()


OCR_FUNCS, CLASSIFY_DOCUMENT, EXTRACT_INFO = _load_moise_modules()


@dag(
    dag_id="document_pipeline_mvp",
    start_date=datetime(2026, 1, 1),
    schedule=None,
    catchup=False,
    max_active_runs=1,
    default_args={
        "owner": "hackathon-team",
        "retries": 2,
        "retry_delay": timedelta(minutes=2),
    },
    tags=["documents", "ocr", "compliance", "mvp"],
)
def document_pipeline_mvp() -> None:
    @task
    def detect_new_documents() -> list[dict[str, Any]]:
        _ensure_paths()
        documents: list[dict[str, Any]] = []

        for file_path in sorted(INCOMING_PATH.glob("*")):
            if file_path.is_file():
                documents.append(
                    {
                        "document_id": f"doc_{int(datetime.utcnow().timestamp())}_{file_path.stem}",
                        "filename": file_path.name,
                        "source_path": str(file_path),
                        "detected_type": _detect_doc_type(file_path.name),
                        "status": "DETECTED",
                        "detected_at": datetime.utcnow().isoformat(),
                    }
                )

        if not documents:
            print("Aucun nouveau document dans /incoming")
        else:
            print(f"{len(documents)} document(s) détecté(s)")

        return documents

    @task
    def ingest_to_raw(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
        ingested: list[dict[str, Any]] = []
        client = _get_mongo_client()
        db = _get_db(client)
        fs = gridfs.GridFS(db)
        col = db["documents"]

        for doc in documents:
            src = Path(doc["source_path"])
            dst = RAW_PATH / src.name

            if not src.exists():
                continue

            shutil.copy2(src, dst)

            # Stockage binaire dans GridFS
            with open(dst, "rb") as f:
                gridfs_id = fs.put(
                    f,
                    filename=doc["filename"],
                    document_id=doc["document_id"],
                    doc_type=doc["detected_type"],
                )

            updated = {
                **doc,
                "raw_path": str(dst),
                "gridfs_id": str(gridfs_id),
                "status": "INGESTED",
                "ingested_at": datetime.utcnow().isoformat(),
            }

            # Upsert MongoDB: ne duplique pas si relancé
            col.update_one(
                {"document_id": updated["document_id"]},
                {"$set": updated},
                upsert=True,
            )
            print(f"[Mongo] document '{updated['document_id']}' upserted (INGESTED)")
            ingested.append(updated)

        client.close()
        return ingested

    @task
    def run_ocr(ingested_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        clean_docs: list[dict[str, Any]] = []

        for doc in ingested_docs:
            source_file = Path(doc["raw_path"])
            text_output_file = CLEAN_PATH / f"{source_file.stem}.txt"

            detected_type = doc["detected_type"]
            text = ""
            ocr_confidence = 0.91

            try:
                suffix = source_file.suffix.lower()

                if suffix == ".txt":
                    text = source_file.read_text(encoding="utf-8")
                elif OCR_FUNCS and suffix == ".pdf":
                    text = OCR_FUNCS[0](str(source_file))
                elif OCR_FUNCS and suffix in {".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"}:
                    text = OCR_FUNCS[1](str(source_file))
                else:
                    text = (
                        f"Document: {source_file.name}\n"
                        f"Type: {detected_type}\n"
                        "Montant TTC: 1250.90 EUR\n"
                        "Date: 2026-03-16\n"
                        "SIREN: 552100554\n"
                        "IBAN: FR7630006000011234567890189\n"
                    )
                    ocr_confidence = 0.6

                if CLASSIFY_DOCUMENT:
                    classified = _normalize_doc_type(CLASSIFY_DOCUMENT(text))
                    if classified and classified != "autre":
                        detected_type = classified
            except Exception as exc:
                print(f"[OCR] erreur pour {source_file.name}: {exc} | fallback mock")
                text = (
                    f"Document: {source_file.name}\n"
                    f"Type: {detected_type}\n"
                    "Montant TTC: 1250.90 EUR\n"
                    "Date: 2026-03-16\n"
                    "SIREN: 552100554\n"
                    "IBAN: FR7630006000011234567890189\n"
                )
                ocr_confidence = 0.6

            text_output_file.write_text(text, encoding="utf-8")

            clean_docs.append(
                {
                    **doc,
                    "detected_type": detected_type,
                    "ocr_text_path": str(text_output_file),
                    "ocr_confidence": ocr_confidence,
                    "status": "OCR_DONE",
                    "ocr_at": datetime.utcnow().isoformat(),
                }
            )

        return clean_docs

    @task
    def extract_entities(clean_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        extracted_docs: list[dict[str, Any]] = []
        client = _get_mongo_client()
        db = _get_db(client)
        col_docs = db["documents"]
        col_extractions = db["extractions"]

        for doc in clean_docs:
            content = Path(doc["ocr_text_path"]).read_text(encoding="utf-8")

            extracted_raw = EXTRACT_INFO(content) if EXTRACT_INFO else {}

            amount_list = extracted_raw.get("montant", []) if isinstance(extracted_raw, dict) else []
            date_list = extracted_raw.get("date", []) if isinstance(extracted_raw, dict) else []
            siret = extracted_raw.get("siret") if isinstance(extracted_raw, dict) else None

            fallback_amount_match = re.search(r"Montant TTC:\s*([0-9]+[\.,][0-9]+)", content)
            fallback_date_match = re.search(r"Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})", content)
            fallback_siren_match = re.search(r"SIREN:\s*([0-9]{9})", content)
            iban_match = re.search(r"IBAN:\s*([A-Z]{2}[0-9A-Z]{25,32})", content)

            amount_value = None
            if amount_list:
                amount_value = amount_list[0].replace("€", "").strip().replace(" ", "")
            elif fallback_amount_match:
                amount_value = fallback_amount_match.group(1)

            date_value = date_list[0] if date_list else (fallback_date_match.group(1) if fallback_date_match else None)
            siren_value = (siret[:9] if siret else None) or (fallback_siren_match.group(1) if fallback_siren_match else None)

            extracted = {
                "amount_ttc": amount_value,
                "date": date_value,
                "siren": siren_value,
                "iban": iban_match.group(1) if iban_match else None,
                "doc_type": doc["detected_type"],
                "extracted_raw": extracted_raw,
            }

            updated = {
                **doc,
                "extracted_fields": extracted,
                "extraction_confidence": 0.87,
                "status": "EXTRACTED",
                "extracted_at": datetime.utcnow().isoformat(),
            }

            # Mise à jour statut dans documents
            col_docs.update_one(
                {"document_id": updated["document_id"]},
                {"$set": {"status": "EXTRACTED", "extracted_at": updated["extracted_at"]}},
            )

            # Upsert dans extractions
            col_extractions.update_one(
                {"document_id": updated["document_id"]},
                {"$set": {
                    "document_id": updated["document_id"],
                    "fields": extracted,
                    "confidence": 0.87,
                    "extracted_at": updated["extracted_at"],
                }},
                upsert=True,
            )
            print(f"[Mongo] extraction '{updated['document_id']}' upserted")
            extracted_docs.append(updated)

        client.close()
        return extracted_docs

    @task
    def validate_business_rules(extracted_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        validated_docs: list[dict[str, Any]] = []

        for doc in extracted_docs:
            fields = doc["extracted_fields"]
            alerts: list[dict[str, str]] = []

            if fields.get("doc_type") in {"facture", "devis"} and not fields.get("amount_ttc"):
                alerts.append({"level": "critical", "message": "Montant TTC manquant"})

            if not fields.get("date"):
                alerts.append({"level": "warning", "message": "Date manquante"})

            if fields.get("siren") and len(fields["siren"]) != 9:
                alerts.append({"level": "warning", "message": "SIREN invalide"})

            status = "VALIDATED" if len(alerts) == 0 else "NEEDS_REVIEW"

            validated_docs.append(
                {
                    **doc,
                    "validation_alerts": alerts,
                    "status": status,
                    "validated_at": datetime.utcnow().isoformat(),
                }
            )

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
    extracted = extract_entities(cleaned)
    validated = validate_business_rules(extracted)
    curated = write_curated(validated)
    create_alerts(curated)


document_pipeline_mvp()
