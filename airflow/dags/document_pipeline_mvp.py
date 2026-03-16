from __future__ import annotations

import json
import os
import re
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from airflow.decorators import dag, task

BASE_DATA_PATH = Path("/opt/airflow/data")
INCOMING_PATH = BASE_DATA_PATH / "incoming"
RAW_PATH = BASE_DATA_PATH / "raw"
CLEAN_PATH = BASE_DATA_PATH / "clean"
CURATED_PATH = BASE_DATA_PATH / "curated"


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

        for doc in documents:
            src = Path(doc["source_path"])
            dst = RAW_PATH / src.name

            if src.exists():
                shutil.copy2(src, dst)
                updated = {
                    **doc,
                    "raw_path": str(dst),
                    "status": "INGESTED",
                    "ingested_at": datetime.utcnow().isoformat(),
                }
                ingested.append(updated)

        metadata_path = RAW_PATH / f"ingest_metadata_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        metadata_path.write_text(json.dumps(ingested, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Métadonnées ingestion écrites: {metadata_path}")

        return ingested

    @task
    def run_ocr(ingested_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        clean_docs: list[dict[str, Any]] = []

        for doc in ingested_docs:
            source_file = Path(doc["raw_path"])
            text_output_file = CLEAN_PATH / f"{source_file.stem}.txt"

            mocked_text = (
                f"Document: {source_file.name}\n"
                f"Type: {doc['detected_type']}\n"
                "Montant TTC: 1250.90 EUR\n"
                "Date: 2026-03-16\n"
                "SIREN: 552100554\n"
                "IBAN: FR7630006000011234567890189\n"
            )
            text_output_file.write_text(mocked_text, encoding="utf-8")

            clean_docs.append(
                {
                    **doc,
                    "ocr_text_path": str(text_output_file),
                    "ocr_confidence": 0.91,
                    "status": "OCR_DONE",
                    "ocr_at": datetime.utcnow().isoformat(),
                }
            )

        return clean_docs

    @task
    def extract_entities(clean_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        extracted_docs: list[dict[str, Any]] = []

        for doc in clean_docs:
            content = Path(doc["ocr_text_path"]).read_text(encoding="utf-8")

            amount_match = re.search(r"Montant TTC:\s*([0-9]+[\.,][0-9]+)", content)
            date_match = re.search(r"Date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})", content)
            siren_match = re.search(r"SIREN:\s*([0-9]{9})", content)
            iban_match = re.search(r"IBAN:\s*([A-Z]{2}[0-9A-Z]{25,32})", content)

            extracted = {
                "amount_ttc": amount_match.group(1) if amount_match else None,
                "date": date_match.group(1) if date_match else None,
                "siren": siren_match.group(1) if siren_match else None,
                "iban": iban_match.group(1) if iban_match else None,
                "doc_type": doc["detected_type"],
            }

            extracted_docs.append(
                {
                    **doc,
                    "extracted_fields": extracted,
                    "extraction_confidence": 0.87,
                    "status": "EXTRACTED",
                    "extracted_at": datetime.utcnow().isoformat(),
                }
            )

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

        for doc in validated_docs:
            curated_file = CURATED_PATH / f"{doc['document_id']}.json"
            curated_file.write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")

            outputs.append(
                {
                    "document_id": doc["document_id"],
                    "curated_path": str(curated_file),
                    "status": doc["status"],
                    "alerts_count": len(doc.get("validation_alerts", [])),
                }
            )

        return outputs

    @task
    def create_alerts(curated_outputs: list[dict[str, Any]]) -> None:
        alerts_file = CURATED_PATH / f"alerts_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        alerts_payload = [
            {
                "document_id": item["document_id"],
                "level": "warning" if item["alerts_count"] > 0 else "info",
                "message": "Revue manuelle requise" if item["alerts_count"] > 0 else "Aucune alerte",
                "status": item["status"],
            }
            for item in curated_outputs
        ]

        alerts_file.write_text(json.dumps(alerts_payload, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Fichier alertes écrit: {alerts_file}")

        mongo_uri = os.getenv("MONGODB_URI", "")
        if mongo_uri and "<username>" not in mongo_uri:
            print("MONGODB_URI détectée: brancher ici l'écriture MongoDB/alerts")
        else:
            print("MONGODB_URI non configurée: stockage local uniquement pour le MVP")

    detected = detect_new_documents()
    ingested = ingest_to_raw(detected)
    cleaned = run_ocr(ingested)
    extracted = extract_entities(cleaned)
    validated = validate_business_rules(extracted)
    curated = write_curated(validated)
    create_alerts(curated)


document_pipeline_mvp()
