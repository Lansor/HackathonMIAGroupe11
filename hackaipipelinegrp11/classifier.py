def classify_document(text):
    text = text.lower()
    if "facture" in text:
        return "facture"
    elif "devis" in text:
        return "devis"
    elif "siret" in text:
        return "attestation siret"
    elif "rib" in text:
        return "rib"
    else:
        return "autre"