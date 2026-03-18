def classify_document(text):
    text = text.lower()

    if "facture" in text:
        return {"type_document": "facture", "confidence": 0.9}

    elif "devis" in text:
        return {"type_document": "devis", "confidence": 0.9}

    elif "attestation" in text or "siret" in text:
        return {"type_document": "attestation", "confidence": 0.85}

    elif "kbis" in text:
        return {"type_document": "kbis", "confidence": 0.9}

    elif "rib" in text or "iban" in text:
        return {"type_document": "rib", "confidence": 0.9}

    else:
        return {"type_document": "unknown", "confidence": 0.3}
