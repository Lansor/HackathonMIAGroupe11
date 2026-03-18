import pandas as pd
from faker import Faker
import random
import os
import sys
import json
from datetime import datetime, timedelta
from xhtml2pdf import pisa
from io import BytesIO

fake = Faker('fr_FR')

# --- CONFIGURATION ---
CSV_PATH = "../dataset/DataGouv.csv"
OUTPUT_DIR = "../output"
TEMPLATES_DIR = "../script/templates"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- FONCTIONS IMPORTÉES DE generateDocuments.py ---

def render_template(template_name, context):
    """Charge et remplit un modèle HTML"""
    template_path = os.path.join(TEMPLATES_DIR, f"{template_name}.html")
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except FileNotFoundError:
        print(f"   Erreur: Modèle non trouvé : {template_path}")
        return None
    
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
        print(f"   Erreur lors de la génération PDF : {e}")
        return False

def load_real_companies(n=5):
    """Charge n entreprises réelles du CSV"""
    try:
        df = pd.read_csv(CSV_PATH, low_memory=False)
        df['company_name'] = df['denominationUniteLegale'].fillna(df['nomUniteLegale'])
        df['siret'] = df['siren'].astype(str) + df['nicSiegeUniteLegale'].fillna('00001').astype(str).str.zfill(5)
        df = df.dropna(subset=['siren', 'company_name', 'siret'])
        return df.sample(min(n, len(df)))
    except Exception as e:
        print(f"Erreur CSV: {e}")
        return None

def generate_coherent_group(company_row, group_id):
    """Génère un groupe cohérent de 4 documents pour une entreprise"""
    
    siren = str(int(company_row['siren']))
    siret = str(company_row['siret'])
    company_name = company_row['company_name']
    
    # -- KBIS --
    kbis_date = datetime.now() - timedelta(days=random.randint(1, 50))  # < 3 mois
    kbis_context = {
        'company_name': company_name,
        'siren': siren,
        'siret': siret,
        'naf_code': fake.numerify('####Z'),
        'legal_form': random.choice(['SARL', 'SAS', 'EURL', 'SA', 'EI']),
        'capital': f"{random.choice([10000, 20000, 50000, 100000])}",
        'creation_date': fake.date_between(start_date='-180d', end_date='today').strftime('%d/%m/%Y'),
        'manager_name': fake.name(),
        'address': fake.street_address(),
        'zip_code': fake.postcode(),
        'city': fake.city(),
        'business_activity': 'Services informatiques et conseil en technologie de l\'information',
        'date': kbis_date.strftime('%d/%m/%Y'),
        'validity_period': '3 mois',
    }
    
    # -- RIB --
    rib_context = {
        'company_name': company_name,
        'iban': fake.iban(),
        'bic': fake.swift(),
        'bank_name': random.choice(['BNP Paribas', 'Société Générale', 'Crédit Agricole', 'BPCE']),
        'agency_name': f"Agence {fake.city()}",
        'bank_address': fake.street_address(),
        'bank_city': fake.city(),
        'account_number': fake.numerify('##############'),
        'account_type': 'Compte courant',
        'currency': 'EUR',
        'opening_date': fake.date_between(start_date='-20y').strftime('%d/%m/%Y'),
        'date': datetime.now().strftime('%d/%m/%Y'),
    }
    
    # -- URSSAF --
    urssaf_expiration = datetime.now() + timedelta(days=random.randint(30, 365))
    base_amount = random.uniform(10000, 50000)
    urssaf_context = {
        'company_name': company_name,
        'siret': siret,
        'address': fake.street_address(),
        'zip_code': fake.postcode(),
        'city': fake.city(),
        'period': f"{datetime.now().month}/{datetime.now().year}",
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
        'due_date': urssaf_expiration.strftime('%d/%m/%Y'),
    }
    
     # -- FACTURE (Entreprise du groupe émet une facture À BuildCorp) --
    subtotal = random.uniform(1000, 3000)
    tax_amount = subtotal * 0.20
    total_ttc = subtotal + tax_amount
    
    facture_context = {
        'company_name': company_name,  # Émetteur = l'entreprise du groupe
        'siren': siren,
        'siret': siret,
        'invoice_number': f"FAC-{fake.numerify('######')}",
        'address': fake.street_address(),
        'zip_code': fake.postcode(),
        'city': fake.city(),
        'phone': fake.phone_number(),
        'client_name': "BuildCorp",  # Client = nous (BuildCorp)
        'client_address': "123 Rue de la Tech",
        'client_zip': "75001",
        'client_city': "Paris",
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
    
    return {
        'group_id': group_id,
        'siren': siren,
        'siret': siret,
        'company_name': company_name,
        'documents': {
            'kbis': {'context': kbis_context, 'template': 'kbis'},
            'rib': {'context': rib_context, 'template': 'rib'},
            'urssaf': {'context': urssaf_context, 'template': 'urssaf'},
            'facture': {'context': facture_context, 'template': 'facture'}
        },
        'validation': {
            'kbis_valid': True,
            'kbis_date': kbis_date.isoformat(),
            'kbis_is_recent': (datetime.now() - kbis_date).days < 90,
            'rib_matches_kbis': True,
            'urssaf_siret_valid': True,
            'urssaf_expiration_valid': urssaf_expiration > datetime.now(),
            'facture_three_way_match': abs(subtotal * 1.20 - total_ttc) < 0.01,
            'facture_siret_exists': True
        }
    }

def generate_pdfs_for_group(group_data):
    """Génère les PDFs pour un groupe"""
    group_id = group_data['group_id']
    file_paths = {}
    
    for doc_type, doc_data in group_data['documents'].items():
        try:
            context = doc_data['context']
            template_name = doc_data['template']
            
            # Render template
            html_content = render_template(template_name, context)
            if not html_content:
                print(f"   Erreur: Template non trouvé pour {template_name}")
                continue
            
            # Generate PDF
            filename = f"Group_{group_id:02d}_{doc_type.upper()}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            output_path = os.path.join(OUTPUT_DIR, filename)
            
            if html_to_pdf(html_content, output_path):
                file_paths[doc_type] = filename
                print(f"   {doc_type.upper()}: {filename}")
            else:
                print(f"   Erreur PDF pour {doc_type}")
        except Exception as e:
            print(f"   Erreur: {str(e)}")
    
    return file_paths

def main():
    print(" Chargement des entreprises réelles...")
    companies = load_real_companies(5)
    
    if companies is None or len(companies) == 0:
        print(" Impossible de charger les entreprises")
        return
    
    all_groups = []
    manifest = {
        'generated_at': datetime.now().isoformat(),
        'total_groups': len(companies),
        'groups': []
    }
    
    for idx, (_, company) in enumerate(companies.iterrows(), 1):
        print(f"\n Génération du Groupe {idx}...")
        
        group_data = generate_coherent_group(company, idx)
        file_paths = generate_pdfs_for_group(group_data)
        
        group_data['file_paths'] = file_paths
        all_groups.append(group_data)
        manifest['groups'].append({
            'group_id': idx,
            'siren': group_data['siren'],
            'siret': group_data['siret'],
            'company_name': group_data['company_name'],
            'files': file_paths,
            'validation': group_data['validation']
        })
    
    # Export manifest
    manifest_path = os.path.join(OUTPUT_DIR, 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    print(f"\n Dataset généré avec succès!")
    print(f" Manifest: {manifest_path}")
    print(f" Fichiers: {OUTPUT_DIR}/")

if __name__ == '__main__':
    main()