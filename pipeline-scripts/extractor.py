import re

def extract_info(text):
    siret = re.search(r"\b\d{14}\b", text)
    tva = re.search(r"\bFR\d{2}\s?\d{9}\b", text)
    montant = re.findall(r"\b\d+[,.]?\d*\s?€\b", text)
    date = re.findall(r"\b\d{2}/\d{2}/\d{4}\b", text)

    return {
        "siret": siret.group() if siret else None,
        "tva": tva.group() if tva else None,
        "montant": montant if montant else [],
        "date": date if date else []
    }