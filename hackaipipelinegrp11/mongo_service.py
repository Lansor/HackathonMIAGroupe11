from pymongo import MongoClient

# Connexion MongoDB
client = MongoClient("mongodb://localhost:27017/")  # changer si nécessaire
db = client.hackathon_docs

# Zones
raw_collection = db.raw_zone
clean_collection = db.clean_zone
curated_collection = db.curated_zone

def store_raw(filename, file_bytes):
    raw_collection.insert_one({
        "filename": filename,
        "raw_data": file_bytes
    })

def store_clean(filename, text):
    clean_collection.insert_one({
        "filename": filename,
        "ocr_text": text
    })

def store_curated(filename, doc_type, extracted):
    curated_collection.insert_one({
        "filename": filename,
        "type_document": doc_type,
        "extracted": extracted
    })