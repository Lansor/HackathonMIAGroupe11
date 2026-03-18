"""
    RAW ZONE (MongoDB / stockage fichiers)
        ↓
    [1] Extraction fichier
            ↓
    [2] Préprocessing image
            ↓
    [3] OCR (Tesseract)
            ↓
    [4] Post-processing (nettoyage texte + score)
            ↓
    [5] Stockage MongoDB (clean_ocr)
            ↓
    [6] Monitoring (Airflow DAG)

"""

"""
OCR PIPELINE - Clean Zone


Description:
Pipeline complet pour extraire du texte depuis PDF/images,
appliquer un preprocessing, calculer un score de confiance,
et stocker dans MongoDB (clean_ocr).
"""

import cv2
import os
import pytesseract
import numpy as np
import time
from pdf2image import convert_from_path
from pymongo import MongoClient
from datetime import datetime

tesseract_path = os.getenv("TESSERACT_CMD", "tesseract")  # par défaut 'tesseract' dans PATH
pytesseract.pytesseract.tesseract_cmd = tesseract_path

from pymongo import MongoClient



# =========================
#  IMAGE PREPROCESSING
# =========================
def preprocess_image(image):
    """
    Améliore la qualité de l'image pour OCR
    
    Étapes:
    - grayscale
    - binarisation
    - réduction du bruit
    """

    # Conversion en niveaux de gris
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Binarisation (noir/blanc)
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)

    # Réduction du bruit
    denoised = cv2.medianBlur(thresh, 3)

    return denoised


# =========================
#  CORRECTION ROTATION
# =========================
def correct_rotation(image):
    """
    Corrige automatiquement l'orientation du texte
    """
    try:
        osd = pytesseract.image_to_osd(image)
        angle = int(osd.split("Rotate: ")[1].split("\n")[0])

        if angle != 0:
            (h, w) = image.shape[:2]
            center = (w // 2, h // 2)

            matrix = cv2.getRotationMatrix2D(center, -angle, 1.0)
            image = cv2.warpAffine(image, matrix, (w, h))

    except Exception:
        # fallback si OSD échoue
        pass

    return image


# =========================
#  OCR + CONFIDENCE
# =========================
def run_ocr(image):
    """
    Lance l'OCR et calcule un score de confiance moyen
    """

    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)

    # Reconstruction du texte
    words = [w for w in data['text'] if w.strip() != ""]
    text = " ".join(words)

    # Calcul du score de confiance
    confidences = [
        int(conf) for conf in data['conf']
        if conf != '-1'
    ]

    avg_conf = sum(confidences) / len(confidences) if confidences else 0

    return text, avg_conf / 100  # normalisé entre 0 et 1

# =========================
#  PDF → IMAGES
# =========================
def pdf_to_images(pdf_path):
    """
    Convertit un PDF en liste d'images
    """
    return convert_from_path(pdf_path)

# Connexion MongoDB
client = MongoClient("mongodb+srv://carlbrgs:xKcbcrj0TwiW4asW@tptwt.dj2ot.mongodb.net/")
db = client["buildup"]

# =========================
#  PIPELINE PRINCIPAL
# =========================
def process_document(file_path, document_id, user_id, db):
    """
    Pipeline complet OCR
    
    Params:
    - file_path: chemin du fichier
    - document_id: ID du document raw
    - user_id: ID de l'utilisateur
    - db: connexion MongoDB
    """

    pages_data = []
    full_text = ""

    # Gestion PDF vs image
    if file_path.endswith(".pdf"):
        images = pdf_to_images(file_path)
        source_type = "pdf"
    else:
        images = [cv2.imread(file_path)]
        source_type = "image"

    # Traitement page par page
    for i, img in enumerate(images):
        img = np.array(img)
        img = correct_rotation(img)
        img = preprocess_image(img)
        text, conf = run_ocr(img)

        pages_data.append({
            "page_number": i + 1,
            "text": text,
            "confidence": conf
        })
        full_text += text + "\n"

    #  Métriques
    avg_conf = sum(p["confidence"] for p in pages_data) / len(pages_data)

    # Document adapté au modèle cleanOCRModel.js
    document = {
        "user_id": user_id,
        "raw_document_id": document_id,
        "ocr_engine": "tesseract",
        "raw_text": full_text,
        "conf_score": avg_conf,
        "pages": pages_data,
        "createdAt": datetime.now(),
    }


    #  Insertion MongoDB
    db.cleanocrs.insert_one(document)

    print(f"OCR terminé: {file_path}")