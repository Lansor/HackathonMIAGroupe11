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
        Path("/opt/airflow/pipeline_ocr/orc_pipeline.py"),
        Path(__file__).resolve().parents[2] / "pipeline_ocr" / "orc_pipeline.py",
    ]

    for module_path in candidates:
        if not module_path.exists():
            continue

        try:
            import cv2
            import numpy as np

            spec = importlib.util.spec_from_file_location("project_orc_pipeline", str(module_path))
            if spec is None or spec.loader is None:
                continue

            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            return {
                "cv2": cv2,
                "np": np,
                "pdf_to_images": module.pdf_to_images,
                "correct_rotation": module.correct_rotation,
                "preprocess_image": module.preprocess_image,
                "run_ocr_engine": module.run_ocr,
                "process_document": module.process_document,
            }
        except Exception as exc:
            print(f"[OCR pipeline] import impossible depuis {module_path}: {exc}")

    print("[OCR pipeline] module pipeline_ocr/orc_pipeline.py non disponible")
    return None


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


def _normalize_doc_type(label: Any) -> str | None:
    if not label:
        return None

    if isinstance(label, dict):
        label = label.get("type_document")

    if not isinstance(label, str):
        return None

    lowered = label.lower().strip()
    if lowered == "attestation siret":
        return "attestation"
    return lowered


def _parse_date_value(value: str | None) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def _to_float(value: str | None) -> float | None:
    if not value:
        return None
    cleaned = value.replace("€", "").replace("EUR", "").replace(" ", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


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


OCR_FUNCS, CLASSIFY_DOCUMENT, EXTRACT_INFO = _load_moise_modules()
OCR_PIPELINE = _load_ocr_pipeline_modules()


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

        client = _get_mongo_client()
        db = _get_db(client)
        raw_col = db["rawdocuments"]

        pending_raw_docs = list(
            raw_col.find(
                {
                    "status": "PENDING",
                    "gridfs_id": {"$exists": True},
                    "pipeline_status": {"$nin": ["DETECTED", "INGESTED", "OCR_DONE", "EXTRACTED", "CURATED"]},
                }
            ).sort("createdAt", pymongo.ASCENDING)
        )

        now_iso = datetime.utcnow().isoformat()
        for raw_doc in pending_raw_docs:
            filename = str(raw_doc.get("filename", "uploaded_document"))
            document_id = str(raw_doc.get("document_id") or raw_doc.get("_id"))
            documents.append(
                {
                    "document_id": document_id,
                    "raw_doc_id": str(raw_doc.get("_id")),
                    "user_id": str(raw_doc.get("user_id")) if raw_doc.get("user_id") else None,
                    "filename": filename,
                    "gridfs_id": str(raw_doc.get("gridfs_id")),
                    "detected_type": _detect_doc_type(filename),
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
        col = db["documents"]
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
                "status": "INGESTED",
                "ingested_at": datetime.utcnow().isoformat(),
            }

            # Upsert MongoDB: ne duplique pas si relancé
            col.update_one(
                {"document_id": updated["document_id"]},
                {"$set": updated},
                upsert=True,
            )

            if updated.get("raw_doc_id"):
                raw_col.update_one(
                    {"_id": ObjectId(updated["raw_doc_id"])},
                    {"$set": {"pipeline_status": "INGESTED", "ingested_at": updated["ingested_at"]}},
                )

            print(f"[Mongo] document '{updated['document_id']}' upserted (INGESTED)")
            ingested.append(updated)

        client.close()
        return ingested

    @task
    def run_ocr(ingested_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        clean_docs: list[dict[str, Any]] = []
        image_extensions = {".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"}
        client = _get_mongo_client()
        db = _get_db(client)
        clean_ocr_col = db["clean_ocr"]

        for doc in ingested_docs:
            source_file = Path(doc["raw_path"])
            text_output_file = CLEAN_PATH / f"{source_file.stem}.txt"

            detected_type = doc["detected_type"]
            text = ""
            ocr_confidence = 0.0

            try:
                suffix = source_file.suffix.lower()

                if suffix == ".txt":
                    text = source_file.read_text(encoding="utf-8")
                elif suffix == ".pdf":
                    if OCR_PIPELINE:
                        OCR_PIPELINE["process_document"](
                            str(source_file),
                            doc["document_id"],
                            doc.get("user_id"),
                            db,
                        )
                        clean_ocr_doc = clean_ocr_col.find_one(
                            {"raw_document_id": doc["document_id"]},
                            sort=[("createdAt", pymongo.DESCENDING)],
                        )
                        if not clean_ocr_doc:
                            raise RuntimeError("Résultat clean_ocr introuvable après process_document")
                        text = str(clean_ocr_doc.get("raw_text", ""))
                        ocr_confidence = float(clean_ocr_doc.get("conf_score", 0.0))
                    elif OCR_FUNCS:
                        text = OCR_FUNCS[0](str(source_file))
                    else:
                        raise RuntimeError("Aucun moteur OCR disponible pour les PDF")
                elif suffix in image_extensions:
                    if OCR_PIPELINE:
                        OCR_PIPELINE["process_document"](
                            str(source_file),
                            doc["document_id"],
                            doc.get("user_id"),
                            db,
                        )
                        clean_ocr_doc = clean_ocr_col.find_one(
                            {"raw_document_id": doc["document_id"]},
                            sort=[("createdAt", pymongo.DESCENDING)],
                        )
                        if not clean_ocr_doc:
                            raise RuntimeError("Résultat clean_ocr introuvable après process_document")
                        text = str(clean_ocr_doc.get("raw_text", ""))
                        ocr_confidence = float(clean_ocr_doc.get("conf_score", 0.0))
                    elif OCR_FUNCS:
                        text = OCR_FUNCS[1](str(source_file))
                    else:
                        raise RuntimeError("Aucun moteur OCR disponible pour les images")
                else:
                    raise RuntimeError(f"Type de fichier non supporté pour OCR: {suffix}")

                if not text.strip():
                    raise RuntimeError("OCR vide: aucun texte extrait")

                if CLASSIFY_DOCUMENT:
                    classified_output = CLASSIFY_DOCUMENT(text)
                    classified = _normalize_doc_type(classified_output)
                    if classified and classified != "autre":
                        detected_type = classified
                    if isinstance(classified_output, dict):
                        ocr_confidence = max(ocr_confidence, float(classified_output.get("confidence", 0.0)))
            except Exception as exc:
                raise RuntimeError(f"[OCR] échec pour {source_file.name}: {exc}") from exc

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

        # Mise à jour pipeline_status dans rawdocuments après OCR réussi
        if clean_docs:
            raw_col = db["rawdocuments"]
            raw_col.update_many(
                {"_id": {"$in": [ObjectId(doc["raw_doc_id"]) for doc in clean_docs]}},
                {"$set": {"pipeline_status": "OCR_DONE", "ocr_completed_at": datetime.utcnow().isoformat()}},
            )

        client.close()
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
            siret_match = re.search(r"\b([0-9]{14})\b", content)
            tva_match = re.search(r"\b(FR[0-9]{2}\s?[0-9]{9})\b", content)
            ht_match = re.search(r"(?:HT|Montant\s*HT|Total\s*HT)\s*[:=]?\s*([0-9]+[\.,][0-9]+)", content, flags=re.IGNORECASE)
            ttc_match = re.search(r"(?:TTC|Montant\s*TTC|Total\s*TTC)\s*[:=]?\s*([0-9]+[\.,][0-9]+)", content, flags=re.IGNORECASE)
            tva_rate_match = re.search(r"(?:TVA|Taux\s*TVA)\s*[:=]?\s*([0-9]{1,2}(?:[\.,][0-9]+)?)\s*%", content, flags=re.IGNORECASE)
            date_delivrance_match = re.search(r"(?:Date\s*de\s*d[ée]livrance|D[ée]livr[ée]\s*le)\s*[:=]?\s*([0-9]{2}[/-][0-9]{2}[/-][0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})", content, flags=re.IGNORECASE)
            date_expiration_match = re.search(r"(?:Date\s*d['’]?expiration|Valable\s*jusqu['’]?au?|Fin\s*de\s*validit[ée])\s*[:=]?\s*([0-9]{2}[/-][0-9]{2}[/-][0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})", content, flags=re.IGNORECASE)

            amount_value = None
            if amount_list:
                amount_value = amount_list[0].replace("€", "").strip().replace(" ", "")
            elif fallback_amount_match:
                amount_value = fallback_amount_match.group(1)

            date_value = date_list[0] if date_list else (fallback_date_match.group(1) if fallback_date_match else None)
            siren_value = (siret[:9] if siret else None) or (fallback_siren_match.group(1) if fallback_siren_match else None)
            siret_value = siret or (siret_match.group(1) if siret_match else None)

            extracted = {
                "amount_ht": ht_match.group(1) if ht_match else None,
                "amount_ttc": (ttc_match.group(1) if ttc_match else amount_value),
                "date_emission": date_value,
                "date_delivrance": date_delivrance_match.group(1) if date_delivrance_match else None,
                "date_expiration": date_expiration_match.group(1) if date_expiration_match else None,
                "siren": siren_value,
                "siret": siret_value,
                "tva": tva_match.group(1).replace(" ", "") if tva_match else None,
                "tva_rate": tva_rate_match.group(1).replace(",", ".") if tva_rate_match else None,
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
        client = _get_mongo_client()
        db = _get_db(client)
        curated_col = db["curated_data"]
        suppliers_col = db["supplier_status"]

        for doc in extracted_docs:
            fields = doc["extracted_fields"]
            alerts: list[dict[str, str]] = []
            status = "VALIDATED"

            doc_type = fields.get("doc_type")
            siren = fields.get("siren")
            siret = fields.get("siret")
            if not siren and siret:
                siren = siret[:9]

            now = datetime.utcnow()

            if doc_type == "kbis":
                date_delivrance = _parse_date_value(fields.get("date_delivrance") or fields.get("date_emission"))

                if not siren:
                    alerts.append({"level": "critical", "message": "KBIS sans SIREN exploitable"})
                    status = "NEEDS_REVIEW"
                else:
                    current_kbis = curated_col.find_one(
                        {"doc_type": "kbis", "siren": siren, "is_active": True},
                        sort=[("updated_at", pymongo.DESCENDING)],
                    )

                    if current_kbis:
                        current_date = _parse_date_value(current_kbis.get("date_delivrance"))
                        if date_delivrance and current_date and date_delivrance > current_date:
                            curated_col.update_one(
                                {"_id": current_kbis["_id"]},
                                {"$set": {"is_active": False, "archived_at": now.isoformat()}},
                            )
                        elif current_date and (not date_delivrance or date_delivrance <= current_date):
                            alerts.append({"level": "warning", "message": "KBIS plus ancien que celui déjà enregistré"})
                            status = "NEEDS_REVIEW"

                    if date_delivrance and (now - date_delivrance).days > 90:
                        alerts.append({"level": "critical", "message": "KBIS obsolète (> 3 mois)"})
                        status = "INCOMPLET_OBSOLETE"

            elif doc_type == "rib":
                iban = fields.get("iban")
                kbis_ok = bool(
                    siren
                    and curated_col.find_one(
                        {
                            "doc_type": "kbis",
                            "siren": siren,
                            "is_active": True,
                            "status": {"$in": ["VALIDATED", "UPDATED"]},
                        }
                    )
                )

                if not iban:
                    alerts.append({"level": "critical", "message": "RIB sans IBAN"})
                    status = "NEEDS_REVIEW"

                if not kbis_ok:
                    alerts.append({"level": "warning", "message": "Aucun KBIS validé correspondant au RIB"})
                    status = "PENDING"

                if siren:
                    existing_rib = curated_col.find_one({"doc_type": "rib", "siren": siren, "is_active": True})
                    if existing_rib:
                        curated_col.update_one(
                            {"_id": existing_rib["_id"]},
                            {"$set": {"is_active": False, "archived_at": now.isoformat()}},
                        )

            elif doc_type == "attestation":
                expiration = _parse_date_value(fields.get("date_expiration"))
                link_siren = siren or (siret[:9] if siret else None)

                kbis_ok = bool(
                    link_siren
                    and curated_col.find_one(
                        {
                            "doc_type": "kbis",
                            "siren": link_siren,
                            "is_active": True,
                            "status": {"$in": ["VALIDATED", "UPDATED"]},
                        }
                    )
                )

                if not kbis_ok:
                    alerts.append({"level": "warning", "message": "Attestation sans KBIS lié via SIRET/SIREN"})
                    status = "PENDING"

                if expiration and expiration.date() < now.date():
                    alerts.append({"level": "critical", "message": "Attestation URSSAF expirée: fournisseur bloqué paiement"})
                    status = "BLOQUE_PAIEMENT"
                    if link_siren:
                        suppliers_col.update_one(
                            {"siren": link_siren},
                            {
                                "$set": {
                                    "siren": link_siren,
                                    "payment_status": "BLOCKED",
                                    "reason": "URSSAF_EXPIRED",
                                    "updated_at": now.isoformat(),
                                }
                            },
                            upsert=True,
                        )

            elif doc_type == "devis":
                amount_ht = _to_float(fields.get("amount_ht"))
                kbis_ok = bool(
                    siren
                    and curated_col.find_one(
                        {
                            "doc_type": "kbis",
                            "siren": siren,
                            "is_active": True,
                            "status": {"$in": ["VALIDATED", "UPDATED"]},
                        }
                    )
                )

                if not kbis_ok:
                    alerts.append({"level": "critical", "message": "Devis émis par une entreprise non validée (KBIS manquant)"})
                    status = "NEEDS_REVIEW"

                if amount_ht is None:
                    alerts.append({"level": "critical", "message": "Montant HT manquant sur devis"})
                    status = "NEEDS_REVIEW"
                else:
                    fields["montant_max_autorise"] = amount_ht

            elif doc_type == "facture":
                amount_ht = _to_float(fields.get("amount_ht"))
                amount_ttc = _to_float(fields.get("amount_ttc"))
                tva_rate = _to_float(fields.get("tva_rate"))

                if amount_ht is None or amount_ttc is None or tva_rate is None:
                    alerts.append({"level": "warning", "message": "Facture incomplète pour contrôle HT/TVA/TTC"})
                    status = "NEEDS_REVIEW"
                else:
                    expected_ttc = round(amount_ht * (1 + tva_rate / 100), 2)
                    if abs(expected_ttc - amount_ttc) > 0.02:
                        alerts.append({"level": "critical", "message": "Incohérence facture: HT + TVA != TTC"})
                        status = "NEEDS_REVIEW"

                link_siren = siren or (siret[:9] if siret else None)
                kbis_ok = bool(
                    link_siren
                    and curated_col.find_one(
                        {
                            "doc_type": "kbis",
                            "siren": link_siren,
                            "is_active": True,
                            "status": {"$in": ["VALIDATED", "UPDATED"]},
                        }
                    )
                )
                if not kbis_ok:
                    alerts.append({"level": "critical", "message": "SIRET/SIREN facture absent de la base fournisseurs validés"})
                    status = "NEEDS_REVIEW"

                latest_devis = None
                if link_siren:
                    latest_devis = curated_col.find_one(
                        {
                            "doc_type": "devis",
                            "siren": link_siren,
                            "is_active": True,
                            "status": {"$in": ["VALIDATED", "UPDATED"]},
                        },
                        sort=[("updated_at", pymongo.DESCENDING)],
                    )
                montant_max = _to_float(latest_devis.get("montant_max_autorise")) if latest_devis else None
                if montant_max is not None and amount_ttc is not None and amount_ttc > montant_max:
                    alerts.append({"level": "critical", "message": "Dépassement de budget: Total facture > Total devis"})
                    status = "VALIDATION_HUMAINE"

            if siren and len(siren) != 9:
                alerts.append({"level": "warning", "message": "SIREN invalide"})
                if status == "VALIDATED":
                    status = "NEEDS_REVIEW"

            curated_col.update_one(
                {"document_id": doc["document_id"]},
                {
                    "$set": {
                        "document_id": doc["document_id"],
                        "doc_type": doc_type,
                        "siren": siren,
                        "siret": siret,
                        "fields": fields,
                        "status": status,
                        "alerts": alerts,
                        "is_active": True,
                        "updated_at": now.isoformat(),
                        "date_delivrance": fields.get("date_delivrance"),
                        "montant_max_autorise": fields.get("montant_max_autorise"),
                    }
                },
                upsert=True,
            )

            validated_docs.append(
                {
                    **doc,
                    "validation_alerts": alerts,
                    "status": status,
                    "validated_at": datetime.utcnow().isoformat(),
                }
            )

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
    # extracted = extract_entities(cleaned)
    # validated = validate_business_rules(extracted)
    # curated = write_curated(validated)
    # create_alerts(curated)


document_pipeline_mvp()
