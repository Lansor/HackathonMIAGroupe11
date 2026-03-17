import os
from ocr_service import ocr_from_pdf, ocr_from_image
from classifier import classify_document
from extractor import extract_info
from mongo.service import store_raw, store_clean, store_curated

def process_document(file_path):
    ext = file_path.lower().split('.')[-1]

    # Lire le fichier en bytes pour Raw zone
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    # Stocker brut
    store_raw(file_path, file_bytes)

    # OCR
    if ext == "pdf":
        text = ocr_from_pdf(file_path)
    else:
        text = ocr_from_image(file_path)

    # Stocker OCR
    store_clean(file_path, text)

    # Classification + extraction
    doc_type = classify_document(text)
    infos = extract_info(text)

    # Stocker Curated
    store_curated(file_path, doc_type, infos)

    return {
        "filename": file_path,
        "type_document": doc_type,
        "ocr_text": text,
        "extracted": infos
    }

if __name__ == "__main__":
    folder = "test_files"  # dossier avec PDF / images
    results = []
    for f in os.listdir(folder):
        path = os.path.join(folder, f)
        result = process_document(path)
        results.append(result)

    for r in results:
        print(r)
        print("-"*50)