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
    Unmistakably watermarked as SAMPLE / DEMONSTRATION DATA.
    """
    sample_data = {
        "is_sample": True,
        "incident_code": "RPD-2026-DEMO-SAMPLE",
        "farmer": {
            "name": "மாதிரி விவசாயி (Demo Sample)",
            "phone": "98765XXXXX",
            "village": "வால்பாறை (மாதிரி)",
            "taluk": "பொள்ளாச்சி (மாதிரி)",
            "aadhaar_last4": "XXXX"
        },
        "parcel": {
            "patta_number": "1042 (மாதிரி)",
            "survey_number": "84/2A (மாதிரி)",
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
            "time_approx": "நேற்று இரவு 02:00 AM (மாதிரி நேரம்)",
            "voice_transcript": "மாதிரி குரல் வாக்குமூலம்: நேத்து ராத்திரி காட்டு யானை வந்து நாற்பது வாழை மரத்தை முறிச்சிருச்சுங்க",
            "attack_pattern": "மரங்களை முறித்து சேதம் (மாதிரி)"
        },
        "gps": {
            "lat": 10.3245,
            "lon": 76.9512,
            "accuracy": 8.0,
            "provenance": "மாதிரி ஜிபிஎஸ் (Sample Mock GPS)"
        },
        "photos_list": [],
        "checklist": {
            "patta": True,
            "adangal": False,
            "bank": True,
            "aadhaar": True,
            "witness": False
        }
    }
    pdf_path = DossierPDFGenerator.generate(sample_data, "sample_dossier.pdf", is_sample=True)
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename="RaidProof_Sample_Demo_Evidence_Dossier.pdf"
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
    Never uses demo/sample fallback data.
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
        "name": farmer.full_name if (farmer and farmer.full_name) else "விவசாயி (Cultivator)",
        "phone": farmer.phone_number if (farmer and farmer.phone_number) else "குறிப்பிடப்படவில்லை (Not Provided)",
        "village": farmer.village if (farmer and farmer.village) else "குறிப்பிடப்படவில்லை (Not Provided)",
        "taluk": farmer.taluk if (farmer and farmer.taluk) else "குறிப்பிடப்படவில்லை (Not Provided)",
        "aadhaar_last4": farmer.aadhaar_last4 if (farmer and farmer.aadhaar_last4) else "----"
    }

    # 2. Fetch real land parcel record (no invented 1.0 or 2.5 acre defaults)
    parcel = None
    if incident.parcel_id:
        p_res = await db.execute(select(LandParcel).where(LandParcel.id == incident.parcel_id))
        parcel = p_res.scalar_one_or_none()

    parcel_data = {
        "patta_number": parcel.patta_number if (parcel and parcel.patta_number) else "குறிப்பிடப்படவில்லை (Not Provided)",
        "survey_number": parcel.survey_number if (parcel and parcel.survey_number) else "குறிப்பிடப்படவில்லை (Not Provided)",
        "area_acres": parcel.total_area_acres if (parcel and parcel.total_area_acres is not None) else None,
        "crop": incident.crop_damaged_tamil or incident.crop_damaged
    }

    # 3. Fetch all real evidence photos attached to this incident (preserve all photos)
    photo_q = await db.execute(select(EvidencePhoto).where(EvidencePhoto.incident_id == incident.id))
    photos_list = photo_q.scalars().all()

    formatted_photos = []
    real_lat = None
    real_lon = None
    real_acc = None
    primary_provenance = "பதிவு செய்யப்படவில்லை (Not Recorded)"

    for p in photos_list:
        if os.path.exists(p.file_path):
            prov = "சாதன இருப்பிடம் (Device GPS)" if p.location_source == "consent_device_gps" else (
                "புகைப்பட மெட்டாடேட்டா (EXIF GPS)" if p.location_source == "exif_metadata" else "பதிவு செய்யப்படவில்லை"
            )
            formatted_photos.append({
                "photo_type": p.photo_type,
                "file_path": p.file_path,
                "latitude": p.gps_latitude,
                "longitude": p.gps_longitude,
                "accuracy": p.gps_accuracy,
                "provenance": prov,
                "taken_at": p.photo_taken_at.strftime("%d-%m-%Y %H:%M") if p.photo_taken_at else None
            })
            if real_lat is None and p.gps_latitude is not None and p.gps_longitude is not None:
                real_lat = p.gps_latitude
                real_lon = p.gps_longitude
                real_acc = p.gps_accuracy
                primary_provenance = prov

    # Fallback to incident consent coordinates if photos had no GPS
    if real_lat is None and incident.consent_latitude is not None and incident.consent_longitude is not None:
        real_lat = incident.consent_latitude
        real_lon = incident.consent_longitude
        real_acc = incident.consent_gps_accuracy
        primary_provenance = "சாதன இருப்பிடம் (Device GPS)"

    gps_dict = None
    if real_lat is not None and real_lon is not None:
        gps_dict = {
            "lat": real_lat,
            "lon": real_lon,
            "accuracy": real_acc,
            "provenance": primary_provenance
        }

    # 4. Fetch actual document checklist selections
    chk_res = await db.execute(select(DocumentChecklist).where(DocumentChecklist.incident_id == incident.id))
    chk = chk_res.scalar_one_or_none()

    # 5. Compile complete data dictionary for ReportLab generator
    dossier_data = {
        "is_sample": False,
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
        "photos_list": formatted_photos,
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
    pdf_path = DossierPDFGenerator.generate(dossier_data, pdf_filename, is_sample=False)

    incident.pdf_dossier_path = pdf_path
    incident.status = "DOSSIER_READY"
    await db.commit()

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"RaidProof_Dossier_{incident.incident_code}.pdf"
    )
