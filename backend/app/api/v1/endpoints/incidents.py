import uuid
import secrets
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.incident import IncidentReport
from app.models.farmer import Farmer
from app.models.land_parcel import LandParcel
from app.models.document_checklist import DocumentChecklist

logger = logging.getLogger(__name__)

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
    """
    Creates or de-duplicates an incident report.
    - Resolves farmer identity before checking for duplicates.
    - Uses client_draft_id and transcript hash for collision-safe de-duplication.
    - Validates acreage and damage quantities.
    - Never generates fake phone numbers or arbitrary default acreage.
    """
    try:
        # 1. Validation checks
        if payload.damage_quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="damage_quantity must be greater than zero"
            )
        if payload.area_acres is not None and payload.area_acres <= 0:
            raise HTTPException(
                status_code=400,
                detail="area_acres must be greater than zero when specified"
            )

        # 2. Resolve or Register Farmer Record FIRST
        farmer: Optional[Farmer] = None

        if payload.farmer_id:
            f_q = await db.execute(select(Farmer).where(Farmer.id == payload.farmer_id))
            farmer = f_q.scalar_one_or_none()

        if not farmer and payload.farmer_phone and payload.farmer_phone.strip():
            clean_phone = payload.farmer_phone.strip()
            f_q = await db.execute(select(Farmer).where(Farmer.phone_number == clean_phone))
            farmer = f_q.scalar_one_or_none()

        if not farmer:
            # Create a dedicated, distinct farmer profile (no shared default)
            # Do NOT generate fake phone numbers — leave None if not provided
            clean_phone = payload.farmer_phone.strip() if payload.farmer_phone else None
            farmer = Farmer(
                id=payload.farmer_id or str(uuid.uuid4()),
                full_name=payload.farmer_name.strip() if (payload.farmer_name and payload.farmer_name.strip()) else "சுய அறிவிப்பு விவசாயி (Cultivator)",
                phone_number=clean_phone,
                village=payload.village.strip() if (payload.village and payload.village.strip()) else None,
                taluk=payload.taluk.strip() if (payload.taluk and payload.taluk.strip()) else None,
                district=payload.district.strip() if (payload.district and payload.district.strip()) else "கோயம்புத்தூர்",
                preferred_language="ta-IN",
                aadhaar_last4=None
            )
            db.add(farmer)
            await db.flush()
        else:
            # Update profile with latest submitted details if provided
            if payload.farmer_name and payload.farmer_name.strip():
                farmer.full_name = payload.farmer_name.strip()
            if payload.village and payload.village.strip():
                farmer.village = payload.village.strip()
            if payload.taluk and payload.taluk.strip():
                farmer.taluk = payload.taluk.strip()
            if payload.farmer_phone and payload.farmer_phone.strip():
                farmer.phone_number = payload.farmer_phone.strip()
            await db.flush()

        # 3. Duplicate Prevention: Check client_draft_id OR (farmer_id + transcript)
        existing_incident: Optional[IncidentReport] = None

        if payload.client_draft_id and payload.client_draft_id.strip():
            draft_q = await db.execute(
                select(IncidentReport).where(
                    and_(
                        IncidentReport.farmer_id == farmer.id,
                        IncidentReport.client_draft_id == payload.client_draft_id.strip()
                    )
                )
            )
            existing_incident = draft_q.scalars().first()

        if not existing_incident and payload.raw_voice_transcript and payload.raw_voice_transcript.strip():
            transcript_q = await db.execute(
                select(IncidentReport).where(
                    and_(
                        IncidentReport.farmer_id == farmer.id,
                        IncidentReport.raw_voice_transcript == payload.raw_voice_transcript.strip()
                    )
                )
            )
            existing_incident = transcript_q.scalars().first()

        if existing_incident:
            return {
                "success": True,
                "incident_id": existing_incident.id,
                "incident_code": existing_incident.incident_code,
                "farmer_id": farmer.id,
                "status": existing_incident.status,
                "duplicate_prevented": True,
                "message": "Existing incident record matched. Duplicate submission prevented."
            }

        # 4. Manage Land Parcel Record (Update existing or create new; no arbitrary defaults)
        parcel: Optional[LandParcel] = None
        has_parcel_info = bool(payload.patta_number or payload.survey_number or payload.area_acres)

        if has_parcel_info:
            clean_patta = payload.patta_number.strip() if payload.patta_number else None
            clean_survey = payload.survey_number.strip() if payload.survey_number else None

            # Look for existing parcel by patta or survey for this farmer
            if clean_patta or clean_survey:
                conditions = [LandParcel.farmer_id == farmer.id]
                if clean_patta:
                    conditions.append(LandParcel.patta_number == clean_patta)
                elif clean_survey:
                    conditions.append(LandParcel.survey_number == clean_survey)

                p_q = await db.execute(select(LandParcel).where(and_(*conditions)))
                parcel = p_q.scalar_one_or_none()

            if parcel:
                # Update existing parcel
                if payload.area_acres is not None:
                    parcel.total_area_acres = payload.area_acres
                if clean_survey and not parcel.survey_number:
                    parcel.survey_number = clean_survey
                if clean_patta and not parcel.patta_number:
                    parcel.patta_number = clean_patta
                if payload.crop_damaged_tamil or payload.crop_damaged:
                    parcel.primary_crop = payload.crop_damaged_tamil or payload.crop_damaged
                await db.flush()
            else:
                # Create parcel with ONLY what farmer supplied (no fake 1.0 or 2.5 acre defaults)
                parcel = LandParcel(
                    id=str(uuid.uuid4()),
                    farmer_id=farmer.id,
                    survey_number=clean_survey,
                    patta_number=clean_patta,
                    total_area_acres=payload.area_acres,  # May be None if not provided
                    primary_crop=payload.crop_damaged_tamil or payload.crop_damaged
                )
                db.add(parcel)
                await db.flush()

        # 5. Collision-Safe Incident Code Generation
        # Cryptographically random token ensures concurrent safety without collisions
        incident_id = str(uuid.uuid4())
        max_attempts = 5
        incident_code = None

        for _ in range(max_attempts):
            code_candidate = f"RPD-2026-VAL-{secrets.token_hex(3).upper()}"
            code_check = await db.execute(select(IncidentReport).where(IncidentReport.incident_code == code_candidate))
            if not code_check.scalar_one_or_none():
                incident_code = code_candidate
                break

        if not incident_code:
            incident_code = f"RPD-2026-VAL-{uuid.uuid4().hex[:6].upper()}"

        incident = IncidentReport(
            id=incident_id,
            farmer_id=farmer.id,
            parcel_id=parcel.id if parcel else None,
            client_draft_id=payload.client_draft_id.strip() if payload.client_draft_id else None,
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

        # 6. Initialize Document Checklist matching actual farmer selections (no fake defaults)
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

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to create incident: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database transaction failed while creating incident report")

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
