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
from bson import ObjectId
import easyocr

tesseract_path = os.getenv("TESSERACT_CMD", "tesseract")  # par défaut 'tesseract' dans PATH
pytesseract.pytesseract.tesseract_cmd = tesseract_path
from pymongo import MongoClient

# EasyOCR reader (charge une fois, réutilisable)
try:
    easyocr_reader = easyocr.Reader(['fr', 'en'], gpu=False)
    print("EasyOCR Reader chargé")
except Exception as e:
    print(f"EasyOCR non disponible: {e}")
    easyocr_reader = None

# =========================
#  IMAGE PREPROCESSING (AMÉLIORÉ)
# =========================
def preprocess_image(image):
    """
    Améliore la qualité de l'image pour OCR
    Étapes améliorées :
    - grayscale
    - binarisation (Otsu)
    - réduction du bruit
    - dilation + erosion pour améliorer le contraste
    - upscaling pour petits textes
    """
    # Conversion en niveaux de gris
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Binarisation avec seuil automatique Otsu
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Réduction du bruit bilaterale (préserve les edges)
    denoised = cv2.bilateralFilter(thresh, 9, 75, 75)
    
    # Morphologie: dilate + erode pour améliorer connexité
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    denoised = cv2.dilate(denoised, kernel, iterations=1)
    denoised = cv2.erode(denoised, kernel, iterations=1)
    
    # Upscaling si image trop petite
    h, w = denoised.shape
    if w < 400 or h < 300:
        scale = max(400 / w, 300 / h)
        denoised = cv2.resize(denoised, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    
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
#  OCR TESSERACT + CONFIDENCE
# =========================
def run_ocr(image):
    """
    Lance Tesseract OCR et calcule un score de confiance moyen
    - oem 3  : moteur LSTM (le plus précis)
    - psm 6  : bloc de texte uniforme, meilleure gestion des colonnes
    - l fra  : langue française
    """
    custom_config = r'--oem 3 --psm 6 -l fra'
    data = pytesseract.image_to_data(image, config=custom_config, output_type=pytesseract.Output.DICT)
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
#  OCR EASYOCR (MEILLEUR POUR DOCUMENTS)
# =========================
def run_ocr_easyocr(image):
    """
    Lance EasyOCR pour extraction haute précision
    - Meilleur pour textes en français
    - Meilleur pour documents structurés (factures, KBIS, etc)
    """
    if easyocr_reader is None:
        return "", 0.0
    
    try:
        results = easyocr_reader.readtext(image, detail=1)
        
        if not results:
            return "", 0.0
        
        # Extraction texte + confiance
        texts = []
        confidences = []
        for detection in results:
            text = detection[1]
            conf = detection[2]
            if text.strip():
                texts.append(text)
                confidences.append(conf)
        
        full_text = " ".join(texts)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0
        
        return full_text, avg_conf
    except Exception as e:
        print(f"  ⚠️ EasyOCR erreur: {e}")
        return "", 0.0

# =========================
#  OCR HYBRIDE (TESSERACT + EASYOCR)
# =========================
def run_ocr_hybrid(image):
    """
    Combine Tesseract et EasyOCR pour meilleur résultat
    - Tesseract: rapide, bon pour texte uniforme
    - EasyOCR: plus lent, meilleur pour documents complexes
    
    Stratégie:
    1. Lance Tesseract (rapide)
    2. Si confiance faible (<0.7), lance aussi EasyOCR
    3. Fusionne les résultats ou prend le meilleur
    """
    text_tess, conf_tess = run_ocr(image)
    
    # Si Tesseract a une bonne confiance, retour directif
    if conf_tess > 0.75:
        return text_tess, conf_tess, "tesseract"
    
    # Sinon essayer EasyOCR
    text_easy, conf_easy = run_ocr_easyocr(image)
    
    # Choisir le meilleur résultat
    if conf_easy > conf_tess:
        return text_easy, conf_easy, "easyocr"
    else:
        return text_tess, conf_tess, "tesseract"
# =========================
#  PDF → IMAGES
# =========================
def pdf_to_images(pdf_path):
    """
    Convertit un PDF en liste d'images
    - dpi=300 : résolution plus élevée pour meilleure lisibilité OCR
    """
    return convert_from_path(pdf_path, dpi=300)

# =========================
#  DÉTECTION TYPE DOCUMENT
# =========================
def detect_document_type(raw_text):
    """
    Détecte le type de document basé sur le contenu OCR
    Utilise des mots-clés multiples et variantes pour robustesse
    Ordre: Spécifique → Général (FACTURE avant URSSAF pour éviter faux positifs sur "paiement")
    """
    text_lower = raw_text.lower()
    
    # RIB: Chercher IBAN, BIC, ou mots-clés bancaires
    if any(keyword in text_lower for keyword in ["iban", "bic", "titulaire du compte", "code banque", "numéro de compte"]):
        return "rib"
    
    # KBIS: Chercher SIREN, SIRET, ou mots-clés RCS
    elif any(keyword in text_lower for keyword in ["registre du commerce", "siren rcs", "siret rcs", "raison sociale", "extrait d immatriculation"]):
        return "kbis"
    
    # FACTURE: Tester AVANT URSSAF car plus spécifique (TVA, HT, TTC sont uniques à factures)
    elif any(keyword in text_lower for keyword in ["facture", "invoice", "montant ht", "montant ttc", "total ttc", "tva (20%)"]):
        return "facture"
    
    # URSSAF: Chercher URSSAF, cotisations (plus spécifique que "paiement")
    elif any(keyword in text_lower for keyword in ["urssaf", "cotisations", "période", "déclaration sociale", "total cotisations"]):
        return "urssaf"
    
    else:
        return "unknown"

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
    print(f"\n[START OCR] Traitement: {file_path}")
    print(f"  - document_id: {document_id}")
    print(f"  - user_id: {user_id}")

    pages_data = []
    full_text = ""
    # Gestion PDF vs image
    if file_path.endswith(".pdf"):
        images = pdf_to_images(file_path)
        source_type = "pdf"
        print(f"[DEBUG] PDF converti en {len(images)} page(s)")
    else:
        img = cv2.imread(file_path)
        if img is None:
            raise ValueError(f"Impossible de lire l'image: {file_path}")
        images = [img]
        source_type = "image"
        print(f"[DEBUG] Image lue: {file_path}")

    if not images:
        raise ValueError(f"Aucune image trouvée dans: {file_path}")

    # Traitement page par page
    ocr_engines_used = []
    for i, img in enumerate(images):
        if img is None:
            print(f"[WARN] Page {i+1} est None, suppression")
            continue
        img = np.array(img)
        img = correct_rotation(img)
        img = preprocess_image(img)
        
        # OCR HYBRIDE (Tesseract + EasyOCR)
        text, conf, engine = run_ocr_hybrid(img)
        ocr_engines_used.append(engine)
        
        pages_data.append({
            "page_number": i + 1,
            "text": text,
            "confidence": conf,
            "ocr_engine": engine
        })
        full_text += text + "\n"
    
    #  Métriques
    avg_conf = sum(p["confidence"] for p in pages_data) / len(pages_data)
    engines_summary = f"{ocr_engines_used[0] if ocr_engines_used else 'unknown'} + fallback"
    
    # Document adapté au modèle cleanOCRModel.js
    document = {
        "user_id": user_id,
        "raw_document_id": ObjectId(document_id),  # ← Convertit STRING en ObjectId
        "ocr_engine": engines_summary,  # Moteurs utilisés
        "raw_text": full_text,
        "conf_score": avg_conf,
        "pages": pages_data,
        "createdAt": datetime.now(),
    }
    #  Insertion MongoDB
    try:
        result = db.cleanocrs.insert_one(document)
        print(f"OCR terminé et inséré: {file_path}")
        print(f"   Document ID: {result.inserted_id}")
        return result.inserted_id
    except Exception as e:
        print(f"ERREUR insertion MongoDB: {e}")
        print(f"   collection: cleanocrs")
        print(f"   document: {document}")
        raise