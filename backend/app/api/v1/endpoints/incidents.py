import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.models.incident import IncidentReport
from app.models.document_checklist import DocumentChecklist

router = APIRouter(prefix="/incidents", tags=["Incidents"])

class IncidentCreatePayload(BaseModel):
    farmer_id: str
    client_draft_id: Optional[str] = None
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
        existing_q = await db.execute(
            select(IncidentReport).where(
                IncidentReport.farmer_id == payload.farmer_id,
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

        count_res = await db.execute(select(IncidentReport))
        existing_count = len(count_res.scalars().all())
        incident_code = f"RPD-2026-VAL-{existing_count + 1:03d}"

        incident = IncidentReport(
            id=str(uuid.uuid4()),
            farmer_id=payload.farmer_id,
            incident_code=incident_code,
            wildlife_species=payload.wildlife_species,
            wildlife_species_tamil=payload.wildlife_species_tamil,
            crop_damaged=payload.crop_damaged,
            crop_damaged_tamil=payload.crop_damaged_tamil,
            damage_quantity=payload.damage_quantity,
            damage_unit=payload.damage_unit,
            damage_unit_tamil=payload.damage_unit_tamil,
            raw_voice_transcript=payload.raw_voice_transcript,
            incident_timestamp=payload.incident_timestamp or datetime.now(timezone.utc),
            status="DRAFT"
        )
        db.add(incident)

        # Initialize checklist
        checklist = DocumentChecklist(
            id=str(uuid.uuid4()),
            incident_id=incident.id,
            patta_chitta_ready=True,
            vao_adangal_ready=False,
            bank_passbook_ready=True,
            aadhaar_ready=True,
            witness_ready=False
        )
        db.add(checklist)

        await db.commit()
        await db.refresh(incident)

        return {
            "success": True,
            "incident_id": incident.id,
            "incident_code": incident.incident_code,
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

