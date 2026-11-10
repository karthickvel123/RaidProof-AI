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
            "name": "மாதிரி விவசாயி (Sample Cultivator)",
            "phone": "98765XXXXX",
            "village": "வால்பாறை",
            "taluk": "பொள்ளாச்சி",
            "aadhaar_last4": "XXXX"
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
            "attack_pattern": "மரங்களை முறித்து சேதம்"
        },
        "gps": {
            "lat": 10.3245,
            "lon": 76.9512,
            "accuracy": 8.0
        },
        "checklist": {
            "patta": True,
            "adangal": False,
            "bank": True,
            "aadhaar": True,
            "witness": False
        }
    }
    pdf_path = DossierPDFGenerator.generate(sample_data, "sample_dossier.pdf")
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename="RaidProof_Sample_Evidence_Dossier.pdf"
    )

@router.get("/{incident_id}/pdf")
async def generate_incident_dossier(
    incident_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches real incident records, real farmer profile, actual evidence photos,
    and genuine consent-based GPS coordinates from DB, compiles the dossier,
    and returns the binary PDF stream.
    """
    res = await db.execute(select(IncidentReport).where(IncidentReport.id == incident_id))
    incident = res.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident report not found")

    # 1. Fetch real farmer record
    farmer = None
    if incident.farmer_id:
        f_res = await db.execute(select(Farmer).where(Farmer.id == incident.farmer_id))
        farmer = f_res.scalar_one_or_none()

    farmer_data = {
        "name": farmer.full_name if farmer else "விவசாயி (Cultivator)",
        "phone": farmer.phone_number if farmer else "-",
        "village": farmer.village if farmer else "குறிப்பிடப்படவில்லை",
        "taluk": farmer.taluk if farmer else "குறிப்பிடப்படவில்லை",
        "aadhaar_last4": farmer.aadhaar_last4 if farmer else "----"
    }

    # 2. Fetch real land parcel record
    parcel = None
    if incident.parcel_id:
        p_res = await db.execute(select(LandParcel).where(LandParcel.id == incident.parcel_id))
        parcel = p_res.scalar_one_or_none()

    parcel_data = {
        "patta_number": parcel.patta_number if parcel else "சுய பதிவு இல்லை",
        "survey_number": parcel.survey_number if parcel else "சுய பதிவு இல்லை",
        "area_acres": parcel.total_area_acres if parcel else 1.0,
        "crop": incident.crop_damaged_tamil or incident.crop_damaged
    }

    # 3. Fetch real evidence photos attached to this incident
    photo_q = await db.execute(select(EvidencePhoto).where(EvidencePhoto.incident_id == incident.id))
    photos_list = photo_q.scalars().all()

    wide_photo = next((p for p in photos_list if p.photo_type == "WIDE_ANGLE"), None)
    spoor_photo = next((p for p in photos_list if p.photo_type == "CLOSE_UP_SPOOR"), None)
    if not wide_photo and photos_list:
        wide_photo = photos_list[0]
    if not spoor_photo and len(photos_list) > 1:
        spoor_photo = photos_list[1]

    # 4. Determine actual consent-based GPS coordinates (No hardcoding)
    real_lat = None
    real_lon = None
    real_acc = None

    if wide_photo and wide_photo.gps_latitude is not None and wide_photo.gps_longitude is not None:
        real_lat = wide_photo.gps_latitude
        real_lon = wide_photo.gps_longitude
        real_acc = wide_photo.gps_accuracy
    elif spoor_photo and spoor_photo.gps_latitude is not None and spoor_photo.gps_longitude is not None:
        real_lat = spoor_photo.gps_latitude
        real_lon = spoor_photo.gps_longitude
        real_acc = spoor_photo.gps_accuracy
    elif incident.consent_latitude is not None and incident.consent_longitude is not None:
        real_lat = incident.consent_latitude
        real_lon = incident.consent_longitude
        real_acc = incident.consent_gps_accuracy

    gps_dict = None
    if real_lat is not None and real_lon is not None:
        gps_dict = {
            "lat": real_lat,
            "lon": real_lon,
            "accuracy": real_acc or 10.0
        }

    # 5. Fetch actual document checklist selections
    chk_res = await db.execute(select(DocumentChecklist).where(DocumentChecklist.incident_id == incident.id))
    chk = chk_res.scalar_one_or_none()

    # 6. Compile data dictionary for ReportLab generator
    dossier_data = {
        "incident_code": incident.incident_code,
        "farmer": farmer_data,
        "parcel": parcel_data,
        "incident": {
            "wildlife_tamil": incident.wildlife_species_tamil or "காட்டு விலங்கு",
            "wildlife_en": incident.wildlife_species,
            "crop_tamil": incident.crop_damaged_tamil or "பயிர்",
            "crop_en": incident.crop_damaged,
            "quantity": incident.damage_quantity,
            "unit_tamil": incident.damage_unit_tamil or "அளவீடு",
            "time_approx": incident.incident_timestamp.strftime("%d-%m-%Y %I:%M %p"),
            "voice_transcript": incident.raw_voice_transcript,
            "attack_pattern": "பயிர்ச்சேதம்"
        },
        "photos": {
            "wide_path": wide_photo.file_path if (wide_photo and os.path.exists(wide_photo.file_path)) else None,
            "spoor_path": spoor_photo.file_path if (spoor_photo and os.path.exists(spoor_photo.file_path)) else None
        },
        "gps": gps_dict,
        "checklist": {
            "patta": chk.patta_chitta_ready if chk else False,
            "adangal": chk.vao_adangal_ready if chk else False,
            "bank": chk.bank_passbook_ready if chk else False,
            "aadhaar": chk.aadhaar_ready if chk else False,
            "witness": chk.witness_ready if chk else False
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
