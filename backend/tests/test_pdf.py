import os
import pytest
from pathlib import Path
from app.services.dossier.pdf_generator import DossierPDFGenerator

def test_generate_pdf_dossier():
    sample_data = {
        "incident_code": "RPD-TEST-VAL-001",
        "farmer": {
            "name": "செல்வம்",
            "phone": "9876543210",
            "village": "வால்பாறை",
            "taluk": "பொள்ளாச்சி",
            "aadhaar_last4": "4589"
        },
        "parcel": {
            "patta_number": "1042",
            "survey_number": "84/2A",
            "area_acres": 2.5,
            "crop": "வாழை (Banana)"
        },
        "incident": {
            "wildlife_tamil": "காட்டு யானை",
            "wildlife_en": "ELEPHANT",
            "crop_tamil": "வாழை",
            "crop_en": "BANANA",
            "quantity": 40,
            "unit_tamil": "மரங்கள்",
            "time_approx": "நேற்று இரவு 02:00 AM",
            "voice_transcript": "நேத்து ராத்திரி காட்டு யானை வந்து நாற்பது வாழை மரத்தை முறிச்சிருச்சுங்க",
            "attack_pattern": "மரங்களை முறித்து தின்றது"
        },
        "gps": {
            "lat": 10.3245,
            "lon": 76.9512
        },
        "checklist": {
            "patta": True,
            "adangal": False,
            "bank": True,
            "aadhaar": True
        }
    }

    pdf_path = DossierPDFGenerator.generate(sample_data, "test_dossier.pdf")
    assert os.path.exists(pdf_path)
    assert os.path.getsize(pdf_path) > 1000  # Non-trivial PDF generated
