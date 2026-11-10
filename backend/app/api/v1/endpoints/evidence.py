import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.models.evidence_photo import EvidencePhoto
from app.models.incident import IncidentReport
from app.services.evidence.exif_service import ExifService

router = APIRouter(prefix="/evidence", tags=["Evidence"])

@router.post("/upload")
async def upload_evidence_photo(
    photo_file: UploadFile = File(...),
    incident_id: str = Form(...),
    photo_type: str = Form("WIDE_ANGLE"),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    accuracy: Optional[float] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads farmer evidence photo, extracts consent-based EXIF / device GPS tags,
    overlays self-declared metadata banner, stores optimized image,
    and records the evidence photo associated with the incident in the database.
    Does NOT claim to certify or verify photograph authenticity.
    """
    try:
        raw_bytes = await photo_file.read()
        metadata = ExifService.extract_metadata(raw_bytes)

        # Use EXIF GPS if present, otherwise fallback to device GPS passed from client
        final_lat = metadata.get("latitude") if metadata.get("latitude") is not None else latitude
        final_lon = metadata.get("longitude") if metadata.get("longitude") is not None else longitude
        time_str = metadata.get("timestamp_device") or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        label = "முழுத்தோற்ற சேதம் (WIDE VIEW)" if photo_type == "WIDE_ANGLE" else "விலங்கு தடம் (ANIMAL SPOOR)"

        # Process and watermark photo
        processed_bytes = ExifService.process_and_watermark(
            image_bytes=raw_bytes,
            latitude=final_lat,
            longitude=final_lon,
            timestamp_str=time_str,
            label=label
        )

        photo_id = str(uuid.uuid4())
        filename = f"{incident_id}_{photo_type.lower()}_{photo_id[:8]}.jpg"
        save_path = Path(settings.UPLOAD_DIR) / filename

        with open(save_path, "wb") as f:
            f.write(processed_bytes)

        # Check if the incident exists in the DB so we can attach it
        has_gps = bool(final_lat is not None and final_lon is not None)
        inc_res = await db.execute(select(IncidentReport).where(IncidentReport.id == incident_id))
        incident = inc_res.scalar_one_or_none()

        if incident:
            photo_record = EvidencePhoto(
                id=photo_id,
                incident_id=incident.id,
                photo_type=photo_type,
                file_path=str(save_path),
                gps_latitude=final_lat,
                gps_longitude=final_lon,
                gps_accuracy=accuracy,
                photo_taken_at=datetime.now(timezone.utc),
                has_consent_location_metadata=has_gps
            )
            db.add(photo_record)

            # Update incident location if not already recorded
            if has_gps and (incident.consent_latitude is None or incident.consent_longitude is None):
                incident.consent_latitude = final_lat
                incident.consent_longitude = final_lon
                incident.consent_gps_accuracy = accuracy

            await db.commit()

        return {
            "success": True,
            "photo_id": photo_id,
            "incident_id": incident_id,
            "filename": filename,
            "photo_type": photo_type,
            "latitude": final_lat,
            "longitude": final_lon,
            "accuracy": accuracy,
            "photo_url": f"/static/uploads/{filename}",
            "has_gps": has_gps,
            "location_metadata_source": "consent_device_gps" if has_gps else "none",
            "is_verified": False,
            "database_recorded": bool(incident is not None)
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to process photo: {str(e)}")
