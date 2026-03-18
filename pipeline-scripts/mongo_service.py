import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

mongo_uri = os.getenv("MONGODB_URI")
if not mongo_uri:
    raise RuntimeError("MONGODB_URI is missing in environment variables.")

mongo_db_name = os.getenv("MONGODB_DBNAME", "hackathon")

client = MongoClient(mongo_uri)
db = client[mongo_db_name]

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
