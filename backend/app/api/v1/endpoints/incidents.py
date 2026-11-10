import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.models.incident import IncidentReport
from app.models.farmer import Farmer
from app.models.land_parcel import LandParcel
from app.models.document_checklist import DocumentChecklist

router = APIRouter(prefix="/incidents", tags=["Incidents"])

class IncidentCreatePayload(BaseModel):
    farmer_id: Optional[str] = None
    client_draft_id: Optional[str] = None
    farmer_name: Optional[str] = None
    farmer_phone: Optional[str] = None
    village: Optional[str] = None
    taluk: Optional[str] = None
    district: Optional[str] = "கோயம்புத்தூர்"
    patta_number: Optional[str] = None
    survey_number: Optional[str] = None
    area_acres: Optional[float] = None
    consent_latitude: Optional[float] = None
    consent_longitude: Optional[float] = None
    consent_gps_accuracy: Optional[float] = None
    checklist: Optional[Dict[str, bool]] = None
    wildlife_species: str
    wildlife_species_tamil: Optional[str] = None
    crop_damaged: str
    crop_damaged_tamil: Optional[str] = None
    damage_quantity: float
    damage_unit: str
    damage_unit_tamil: Optional[str] = None
    raw_voice_transcript: str
    incident_timestamp: Optional[datetime] = None

@router.post("/create")
async def create_incident(
    payload: IncidentCreatePayload,
    db: AsyncSession = Depends(get_db)
):
    try:
        # Duplicate Prevention: Check if exact same transcript for same farmer was recently submitted
        effective_farmer_id = payload.farmer_id or "farmer-default"
        existing_q = await db.execute(
            select(IncidentReport).where(
                IncidentReport.farmer_id == effective_farmer_id,
                IncidentReport.raw_voice_transcript == payload.raw_voice_transcript
            )
        )
        existing = existing_q.scalars().first()
        if existing:
            return {
                "success": True,
                "incident_id": existing.id,
                "incident_code": existing.incident_code,
                "status": existing.status,
                "duplicate_prevented": True,
                "message": "Existing incident record matched. Duplicate submission prevented."
            }

        # 1. Manage Farmer Record (No hardcoded demo farmer)
        farmer = None
        if payload.farmer_id:
            f_q = await db.execute(select(Farmer).where(Farmer.id == payload.farmer_id))
            farmer = f_q.scalar_one_or_none()

        if not farmer and payload.farmer_phone:
            f_q = await db.execute(select(Farmer).where(Farmer.phone_number == payload.farmer_phone))
            farmer = f_q.scalar_one_or_none()

        if not farmer:
            placeholder_phone = f"9{uuid.uuid4().int % 1000000000:09d}"
            farmer = Farmer(
                id=payload.farmer_id or f"farmer_{uuid.uuid4().hex[:8]}",
                full_name=payload.farmer_name or "விவசாயி (Cultivator)",
                phone_number=payload.farmer_phone or placeholder_phone,
                village=payload.village or "கிராமம் குறிப்பிடப்படவில்லை",
                taluk=payload.taluk or "வட்டம் குறிப்பிடப்படவில்லை",
                district=payload.district or "மாவட்டம்",
                preferred_language="ta-IN",
                aadhaar_last4="----"
            )
            db.add(farmer)
            await db.flush()
        else:
            # Update with actual submitted profile if provided
            if payload.farmer_name:
                farmer.full_name = payload.farmer_name
            if payload.village:
                farmer.village = payload.village
            if payload.taluk:
                farmer.taluk = payload.taluk
            if payload.farmer_phone:
                farmer.phone_number = payload.farmer_phone

        # 2. Manage Land Parcel Record
        parcel = None
        if payload.patta_number or payload.survey_number:
            p_q = await db.execute(
                select(LandParcel).where(
                    LandParcel.farmer_id == farmer.id,
                    LandParcel.patta_number == (payload.patta_number or "0")
                )
            )
            parcel = p_q.scalar_one_or_none()

            if not parcel:
                parcel = LandParcel(
                    id=f"parcel_{uuid.uuid4().hex[:8]}",
                    farmer_id=farmer.id,
                    survey_number=payload.survey_number or "சர்வே எண் இல்லை",
                    patta_number=payload.patta_number or "பட்டா எண் இல்லை",
                    total_area_acres=payload.area_acres or 1.0,
                    primary_crop=payload.crop_damaged_tamil or payload.crop_damaged
                )
                db.add(parcel)
                await db.flush()

        # 3. Create Incident Report
        count_res = await db.execute(select(IncidentReport))
        existing_count = len(count_res.scalars().all())
        incident_code = f"RPD-2026-VAL-{existing_count + 1:03d}"

        incident = IncidentReport(
            id=str(uuid.uuid4()),
            farmer_id=farmer.id,
            parcel_id=parcel.id if parcel else None,
            incident_code=incident_code,
            wildlife_species=payload.wildlife_species,
            wildlife_species_tamil=payload.wildlife_species_tamil,
            crop_damaged=payload.crop_damaged,
            crop_damaged_tamil=payload.crop_damaged_tamil,
            damage_quantity=payload.damage_quantity,
            damage_unit=payload.damage_unit,
            damage_unit_tamil=payload.damage_unit_tamil,
            raw_voice_transcript=payload.raw_voice_transcript,
            consent_latitude=payload.consent_latitude,
            consent_longitude=payload.consent_longitude,
            consent_gps_accuracy=payload.consent_gps_accuracy,
            incident_timestamp=payload.incident_timestamp or datetime.now(timezone.utc),
            status="DRAFT"
        )
        db.add(incident)

        # 4. Initialize Document Checklist matching actual farmer selections (no fake defaults)
        chk_input = payload.checklist or {}
        checklist = DocumentChecklist(
            id=str(uuid.uuid4()),
            incident_id=incident.id,
            patta_chitta_ready=bool(chk_input.get("patta", False)),
            vao_adangal_ready=bool(chk_input.get("adangal", False)),
            bank_passbook_ready=bool(chk_input.get("bank", False)),
            aadhaar_ready=bool(chk_input.get("aadhaar", False)),
            witness_ready=bool(chk_input.get("witness", False))
        )
        db.add(checklist)

        await db.commit()
        await db.refresh(incident)

        return {
            "success": True,
            "incident_id": incident.id,
            "incident_code": incident.incident_code,
            "farmer_id": farmer.id,
            "status": incident.status,
            "duplicate_prevented": False
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/list")
async def list_incidents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IncidentReport).order_by(IncidentReport.created_at.desc()))
    incidents = result.scalars().all()
    return [
        {
            "id": inc.id,
            "incident_code": inc.incident_code,
            "wildlife_species": inc.wildlife_species,
            "wildlife_species_tamil": inc.wildlife_species_tamil,
            "crop_damaged": inc.crop_damaged,
            "crop_damaged_tamil": inc.crop_damaged_tamil,
            "damage_quantity": inc.damage_quantity,
            "damage_unit": inc.damage_unit,
            "status": inc.status,
            "created_at": inc.created_at.strftime("%d-%m-%Y %H:%M")
        }
        for inc in incidents
    ]
