import pandas as pd
from faker import Faker
import random
import os
import sys
from datetime import datetime, timedelta
from xhtml2pdf import pisa
from io import BytesIO
import json

fake = Faker('fr_FR')

# --- CONFIGURATION ---
CSV_PATH = "../dataset/DataGouv.csv"
TEMPLATES_DIR = "./templates"
OUTPUT_DIR = "../output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def load_data():
    try:
        df = pd.read_csv(CSV_PATH, low_memory=False)
        print(" Dataset CSV chargé avec succès.")
        df['company_name'] = df['denominationUniteLegale'].fillna(df['nomUniteLegale'])
        return df.dropna(subset=['siren', 'company_name'])
    except Exception as e:
        print(f" Erreur CSV : {e}. Utilisation de données fictives.")
        return pd.DataFrame({
            'siren': [str(fake.numerify('#########')) for _ in range(10)],
            'company_name': [fake.company() for _ in range(10)]
        })

df_sirene = load_data()

def render_template(template_name, context):
    """Charge et remplit un modèle HTML"""
    template_path = os.path.join(TEMPLATES_DIR, f"{template_name}.html")
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except FileNotFoundError:
        print(f" Modèle non trouvé : {template_path}")
        return None
    
    print(f" Template chargé : {template_path}")
    
    # Remplace les variables {{ key }} et {{key}}
    replaced_count = 0
    for key, value in context.items():
        # Essayer d'abord sans espaces {{key}}
        pattern_no_space = f"{{{{{key}}}}}"
        if pattern_no_space in html_content:
            html_content = html_content.replace(pattern_no_space, str(value))
            replaced_count += 1
        # Puis avec espaces {{ key }}
        pattern_with_space = f"{{{{ {key} }}}}"
        if pattern_with_space in html_content:
            html_content = html_content.replace(pattern_with_space, str(value))
            replaced_count += 1
    
    print(f" {replaced_count} variable(s) remplacée(s)")
    return html_content

def html_to_pdf(html_content, output_path):
    """Convertit HTML en PDF avec xhtml2pdf"""
    try:
        result_file = BytesIO()
        # Nécessaire d'encoder l'UTF-8 pour xhtml2pdf
        pisa_status = pisa.CreatePDF(BytesIO(html_content.encode('utf-8')), dest=result_file)
        
        with open(output_path, 'wb') as f:
            f.write(result_file.getvalue())
            
        return not pisa_status.err
    except Exception as e:
        print(f" Erreur lors de la génération PDF : {e}")
        return False

# --- DONNÉES ALÉATOIRES ---

def generate_facture():
    row = df_sirene.sample(1).iloc[0]
    subtotal = random.uniform(1000, 3000)
    tax_amount = subtotal * 0.20
    total_ttc = subtotal + tax_amount
    
    context = {
        'company_name': row['company_name'],
        'siren': str(int(row['siren'])),
        'invoice_number': f"FAC-{fake.numerify('######')}",
        'address': fake.street_address(),
        'zip_code': fake.postcode(),
        'city': fake.city(),
        'phone': fake.phone_number(),
        'client_name': fake.company(),
        'client_address': fake.street_address(),
        'client_zip': fake.postcode(),
        'client_city': fake.city(),
        'item1_description': 'Prestation de conseil',
        'item1_qty': random.randint(1, 5),
        'item1_price': f"{random.uniform(50, 200):.2f}",
        'item1_total': f"{random.uniform(100, 1000):.2f}",
        'item2_description': 'Développement logiciel',
        'item2_qty': random.randint(1, 10),
        'item2_price': f"{random.uniform(75, 150):.2f}",
        'item2_total': f"{random.uniform(500, 2000):.2f}",
        'subtotal': f"{subtotal:.2f}",
        'tax_rate': 20,
        'tax_amount': f"{tax_amount:.2f}",
        'total_ttc': f"{total_ttc:.2f}",
        'payment_terms': '30 jours net',
        'date': datetime.now().strftime('%d/%m/%Y'),
    }
    return context, 'facture'

def generate_devis():
    row = df_sirene.sample(1).iloc[0]
    subtotal = random.uniform(4000, 10000)
    tax_amount = subtotal * 0.20
    total_ttc = subtotal + tax_amount
    
    context = {
        'company_name': row['company_name'],
        'siren': str(int(row['siren'])),
        'quote_number': f"DEV-{fake.numerify('######')}",
        'address': fake.street_address(),
        'zip_code': fake.postcode(),
        'city': fake.city(),
        'phone': fake.phone_number(),
        'client_name': fake.company(),
        'client_address': fake.street_address(),
        'client_zip': fake.postcode(),
        'client_city': fake.city(),
        'item1_description': 'Étude de faisabilité',
        'item1_qty': 1,
        'item1_price': f"{random.uniform(500, 1500):.2f}",
        'item1_total': f"{random.uniform(500, 1500):.2f}",
        'item2_description': 'Développement application web',
        'item2_qty': 1,
        'item2_price': f"{random.uniform(3000, 8000):.2f}",
        'item2_total': f"{random.uniform(3000, 8000):.2f}",
        'subtotal': f"{subtotal:.2f}",
        'tax_rate': 20,
        'tax_amount': f"{tax_amount:.2f}",
        'total_ttc': f"{total_ttc:.2f}",
        'validity_days': 30,
        'date': datetime.now().strftime('%d/%m/%Y'),
    }
    return context, 'devis'

def generate_urssaf():
    row = df_sirene.sample(1).iloc[0]
    base_amount = random.uniform(10000, 50000)
    
    context = {
        'company_name': row['company_name'],
        'siret': f"{int(row['siren'])}{fake.numerify('####')}",
        'address': fake.street_address(),
        'zip_code': fake.postcode(),
        'city': fake.city(),
        'period': f"{random.randint(1, 12)}/{random.randint(2020, 2024)}",
        'date': datetime.now().strftime('%d/%m/%Y'),
        'file_number': fake.numerify('##########'),
        'base1': f"{base_amount:.2f}",
        'amount1': f"{base_amount * 0.084:.2f}",
        'base2': f"{base_amount:.2f}",
        'amount2': f"{base_amount * 0.095:.2f}",
        'base3': f"{base_amount:.2f}",
        'amount3': f"{base_amount * 0.045:.2f}",
        'base4': f"{base_amount:.2f}",
        'amount4': f"{base_amount * 0.030:.2f}",
        'total_base': f"{base_amount:.2f}",
        'total_amount': f"{base_amount * 0.254:.2f}",
        'due_date': (datetime.now() + timedelta(days=30)).strftime('%d/%m/%Y'),
    }
    return context, 'urssaf'

def generate_kbis():
    row = df_sirene.sample(1).iloc[0]
    context = {
        'company_name': row['company_name'],
        'siren': str(int(row['siren'])),
        'siret': f"{int(row['siren'])}{fake.numerify('####')}",
        'naf_code': fake.numerify('####Z'),
        'legal_form': random.choice(['SARL', 'SAS', 'EURL', 'SA', 'EI']),
        'capital': f"{random.choice([10000, 20000, 50000, 100000])}",
        'creation_date': fake.date_between(start_date='-10y').strftime('%d/%m/%Y'),
        'manager_name': fake.name(),
        'address': fake.street_address(),
        'zip_code': fake.postcode(),
        'city': fake.city(),
        'business_activity': 'Services informatiques et conseil en technologie de l\'information',
        'date': datetime.now().strftime('%d/%m/%Y'),
        'validity_period': '3 mois',
    }
    return context, 'kbis'

def generate_rib():
    row = df_sirene.sample(1).iloc[0]
    context = {
        'company_name': row['company_name'],
        'iban': fake.iban(),
        'bic': fake.swift(),
        'bank_name': random.choice(['BNP Paribas', 'Société Générale', 'Crédit Agricole', 'BPCE']),
        'agency_name': f"Agence {fake.city()}",
        'bank_address': fake.street_address(),
        'bank_city': fake.city(),
        'account_number': fake.numerify('##############'),
        'account_type': random.choice(['Compte courant', 'Compte de dépôt', 'Compte d\'exploitation']),
        'currency': 'EUR',
        'opening_date': fake.date_between(start_date='-20y').strftime('%d/%m/%Y'),
        'date': datetime.now().strftime('%d/%m/%Y'),
    }
    return context, 'rib'

# --- GÉNÉRATION DES DOCUMENTS ---

doc_generators = {
    'facture': generate_facture,
    'devis': generate_devis,
    'urssaf': generate_urssaf,
    'kbis': generate_kbis,
    'rib': generate_rib,
}

def get_document_type():
    """Récupère le type de document à générer via argument ou via menu"""
    if len(sys.argv) > 1:
        doc_type = sys.argv[1].lower()
        if doc_type in doc_generators:
            return doc_type
        else:
            print(f" Erreur : Type de document '{doc_type}' non reconnu.")
            print(f" Types disponibles : {', '.join(doc_generators.keys())}")
            sys.exit(1)
    else:
        # Affiche un menu de sélection
        print(" \n=== Sélection du type de document ===")
        available_types = list(doc_generators.keys())
        for i, doc_type in enumerate(available_types, 1):
            print(f" {i}. {doc_type.capitalize()}")
        
        while True:
            try:
                choice = input(f"\n Entrez le numéro (1-{len(available_types)}) ou le nom du document : ").strip().lower()
                
                # Vérifier si c'est un numéro
                if choice.isdigit():
                    idx = int(choice) - 1
                    if 0 <= idx < len(available_types):
                        return available_types[idx]
                    else:
                        print(f" Erreur : Veuillez entrer un numéro entre 1 et {len(available_types)}.")
                # Vérifier si c'est un nom
                elif choice in doc_generators:
                    return choice
                else:
                    print(f" Erreur : Type non reconnu. Tapez un numéro ou un nom valide.")
            except KeyboardInterrupt:
                print("\n Génération annulée.")
                sys.exit(0)

print(" Génération des documents de test...\n")

# Récupère le type de document à générer
doc_type_to_generate = get_document_type()
generator = doc_generators[doc_type_to_generate]

try:
    context, template_name = generator()
    html_content = render_template(template_name, context)
    if html_content:
        output_path = os.path.join(OUTPUT_DIR, f"{doc_type_to_generate}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")
        if html_to_pdf(html_content, output_path):
            # Retourner le chemin du fichier en JSON pour Node.js
            result = {
                "success": True,
                "filepath": output_path,
                "filename": os.path.basename(output_path)
            }
            print(json.dumps(result))
    else:
        result = {"success": False, "error": f"Impossible de charger le template pour {doc_type_to_generate}"}
        print(json.dumps(result))
except Exception as e:
    result = {"success": False, "error": str(e)}
    print(json.dumps(result))

print("\n Génération terminée !")