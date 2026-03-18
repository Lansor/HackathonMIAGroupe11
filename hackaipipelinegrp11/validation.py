from datetime import datetime

def validate_data(data):
    errors = []

    # Vérification SIRET
    if data.get("siret") and len(data["siret"]) != 14:
        errors.append("SIRET invalide")

    # Vérification date expiration
    if data.get("date_expiration"):
        try:
            date_exp = datetime.strptime(data["date_expiration"], "%d/%m/%Y")
            if date_exp < datetime.today():
                errors.append("Document expiré")
        except:
            errors.append("Format date invalide")

    # Champs obligatoires
    if not data.get("siret"):
        errors.append("SIRET manquant")

    return errors