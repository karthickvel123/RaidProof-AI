from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db
from app.models.document_checklist import DocumentChecklist

router = APIRouter(prefix="/checklist", tags=["Checklist"])

class ChecklistUpdatePayload(BaseModel):
    patta_chitta_ready: bool
    vao_adangal_ready: bool
    bank_passbook_ready: bool
    aadhaar_ready: bool
    witness_ready: bool

@router.post("/{incident_id}/update")
async def update_checklist(
    incident_id: str,
    payload: ChecklistUpdatePayload,
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(DocumentChecklist).where(DocumentChecklist.incident_id == incident_id))
    chk = res.scalar_one_or_none()
    if not chk:
        raise HTTPException(status_code=404, detail="Checklist not found for this incident")

    chk.patta_chitta_ready = payload.patta_chitta_ready
    chk.vao_adangal_ready = payload.vao_adangal_ready
    chk.bank_passbook_ready = payload.bank_passbook_ready
    chk.aadhaar_ready = payload.aadhaar_ready
    chk.witness_ready = payload.witness_ready

    await db.commit()
    return {"success": True, "message": "Checklist updated"}

