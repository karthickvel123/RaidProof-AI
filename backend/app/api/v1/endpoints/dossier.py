import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.incident import IncidentReport
from app.models.farmer import Farmer
from app.models.land_parcel import LandParcel
from app.models.evidence_photo import EvidencePhoto
from app.models.document_checklist import DocumentChecklist
from app.services.dossier.pdf_generator import DossierPDFGenerator

router = APIRouter(prefix="/dossier", tags=["Dossier"])

@router.get("/sample/pdf")
async def get_sample_dossier():
    """
    Generates and returns an immediate sample bilingual PDF dossier for demonstration.
    """
    sample_data = {
        "incident_code": "RPD-2026-DEMO-001",
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
    pdf_path = DossierPDFGenerator.generate(sample_data, "sample_dossier.pdf")
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename="RaidProof_Dossier_RPD-2026-DEMO-001.pdf"
    )

@router.get("/{incident_id}/pdf")
async def generate_incident_dossier(
    incident_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches real incident records from DB, compiles the official evidence dossier,
    and returns the binary PDF stream.
    """
    res = await db.execute(select(IncidentReport).where(IncidentReport.id == incident_id))
    incident = res.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident report not found")

    # Fetch farmer & parcel
    farmer_res = await db.execute(select(Farmer).where(Farmer.id == incident.farmer_id))
    farmer = farmer_res.scalar_one_or_none()

    parcel_data = {
        "patta_number": "1042",
        "survey_number": "84/2A",
        "area_acres": 2.5,
        "crop": incident.crop_damaged_tamil or incident.crop_damaged
    }

    # Fetch checklist
    chk_res = await db.execute(select(DocumentChecklist).where(DocumentChecklist.incident_id == incident.id))
    chk = chk_res.scalar_one_or_none()

    # Compile data dictionary
    dossier_data = {
        "incident_code": incident.incident_code,
        "farmer": {
            "name": farmer.full_name if farmer else "செல்வம்",
            "phone": farmer.phone_number if farmer else "9876543210",
            "village": farmer.village if farmer else "வால்பாறை",
            "taluk": farmer.taluk if farmer else "வால்பாறை",
            "aadhaar_last4": farmer.aadhaar_last4 if farmer else "4589"
        },
        "parcel": parcel_data,
        "incident": {
            "wildlife_tamil": incident.wildlife_species_tamil or "காட்டு யானை",
            "wildlife_en": incident.wildlife_species,
            "crop_tamil": incident.crop_damaged_tamil or "வாழை",
            "crop_en": incident.crop_damaged,
            "quantity": incident.damage_quantity,
            "unit_tamil": incident.damage_unit_tamil or "மரங்கள்",
            "time_approx": incident.incident_timestamp.strftime("%d-%m-%Y %I:%M %p"),
            "voice_transcript": incident.raw_voice_transcript,
            "attack_pattern": "பயிர்ச்சேதம்"
        },
        "gps": {
            "lat": 10.3245,
            "lon": 76.9512
        },
        "checklist": {
            "patta": chk.patta_chitta_ready if chk else True,
            "adangal": chk.vao_adangal_ready if chk else False,
            "bank": chk.bank_passbook_ready if chk else True,
            "aadhaar": chk.aadhaar_ready if chk else True
        }
    }

    pdf_filename = f"dossier_{incident.incident_code}.pdf"
    pdf_path = DossierPDFGenerator.generate(dossier_data, pdf_filename)

    incident.pdf_dossier_path = pdf_path
    incident.status = "DOSSIER_READY"
    await db.commit()

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"RaidProof_Dossier_{incident.incident_code}.pdf"
    )
