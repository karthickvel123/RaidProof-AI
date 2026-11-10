import io
import re
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from PIL import Image

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.models.evidence_photo import EvidencePhoto
from app.models.incident import IncidentReport
from app.services.evidence.exif_service import ExifService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/evidence", tags=["Evidence"])

ALLOWED_PHOTO_TYPES = {"WIDE_ANGLE", "CLOSE_UP_SPOOR", "SCALE_REF", "OTHER"}
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

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
    Uploads farmer evidence photo, verifies incident exists, extracts EXIF or device GPS tags,
    overlays self-declared metadata banner, stores optimized image, and records exactly one
    EvidencePhoto entity in the database.
    Does NOT claim to certify or verify photograph authenticity.
    """
    # 1. Validate incident exists BEFORE writing any files
    clean_incident_id = re.sub(r"[^a-zA-Z0-9_-]", "", incident_id.strip())
    if not clean_incident_id:
        raise HTTPException(status_code=400, detail="Invalid incident_id format")

    inc_res = await db.execute(select(IncidentReport).where(IncidentReport.id == clean_incident_id))
    incident = inc_res.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident with ID '{clean_incident_id}' not found")

    # 2. Validate photo_type
    normalized_type = photo_type.strip().upper()
    if normalized_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid photo_type '{photo_type}'. Allowed types: {sorted(list(ALLOWED_PHOTO_TYPES))}"
        )

    # 3. Read and validate file size
    raw_bytes = await photo_file.read()
    if not raw_bytes or len(raw_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")
    if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB"
        )

    # 4. Validate image content and detect format
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            img.verify()
            detected_format = (img.format or "").upper()
            if detected_format not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported image format '{detected_format}'. Allowed: {sorted(list(ALLOWED_IMAGE_FORMATS))}"
                )
    except HTTPException:
        raise
    except Exception as img_err:
        logger.warning(f"Corrupted or invalid image upload rejected: {img_err}")
        raise HTTPException(status_code=400, detail="Uploaded file is corrupted or not a valid image")

    # 5. Extract metadata & resolve GPS provenance
    metadata = ExifService.extract_metadata(raw_bytes)
    exif_lat = metadata.get("latitude")
    exif_lon = metadata.get("longitude")

    if exif_lat is not None and exif_lon is not None:
        final_lat = float(exif_lat)
        final_lon = float(exif_lon)
        final_acc = accuracy  # Accuracy from device if available
        location_source = "exif_metadata"
        has_gps = True
    elif latitude is not None and longitude is not None:
        final_lat = float(latitude)
        final_lon = float(longitude)
        final_acc = float(accuracy) if accuracy is not None else None
        location_source = "consent_device_gps"
        has_gps = True
    else:
        final_lat = None
        final_lon = None
        final_acc = None
        location_source = "none"
        has_gps = False

    time_str = metadata.get("timestamp_device") or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    label_map = {
        "WIDE_ANGLE": "முழுத்தோற்ற சேதம் (WIDE VIEW)",
        "CLOSE_UP_SPOOR": "விலங்கு தடம் (ANIMAL SPOOR)",
        "SCALE_REF": "அளவீட்டு குறிப்பு (SCALE REF)",
        "OTHER": "கூடுதல் சான்று (OTHER)"
    }
    label = label_map.get(normalized_type, "கூடுதல் சான்று (OTHER)")

    # 6. Process image and overlay metadata banner
    processed_bytes = ExifService.process_and_watermark(
        image_bytes=raw_bytes,
        latitude=final_lat,
        longitude=final_lon,
        timestamp_str=time_str,
        label=label
    )

    # 7. Safe file path construction (prevent directory traversal)
    photo_id = str(uuid.uuid4())
    filename = f"{clean_incident_id}_{normalized_type.lower()}_{photo_id[:8]}.jpg"
    upload_dir = Path(settings.UPLOAD_DIR).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    save_path = (upload_dir / filename).resolve()

    if not save_path.is_relative_to(upload_dir):
        raise HTTPException(status_code=400, detail="Invalid path traversal detected")

    saved_file_path: Optional[Path] = None

    try:
        # Write processed file to disk
        with open(save_path, "wb") as f:
            f.write(processed_bytes)
        saved_file_path = save_path

        # 8. Create EvidencePhoto database record
        photo_record = EvidencePhoto(
            id=photo_id,
            incident_id=incident.id,
            photo_type=normalized_type,
            file_path=str(save_path),
            gps_latitude=final_lat,
            gps_longitude=final_lon,
            gps_accuracy=final_acc,
            location_source=location_source,
            photo_taken_at=datetime.now(timezone.utc),
            has_consent_location_metadata=has_gps
        )
        db.add(photo_record)

        # Update incident's primary consent location if not already recorded
        if has_gps and (incident.consent_latitude is None or incident.consent_longitude is None):
            incident.consent_latitude = final_lat
            incident.consent_longitude = final_lon
            incident.consent_gps_accuracy = final_acc

        await db.commit()

        return {
            "success": True,
            "photo_id": photo_id,
            "incident_id": incident.id,
            "filename": filename,
            "photo_type": normalized_type,
            "latitude": final_lat,
            "longitude": final_lon,
            "accuracy": final_acc,
            "photo_url": f"/static/uploads/{filename}",
            "has_gps": has_gps,
            "location_metadata_source": location_source,
            "is_verified": False,
            "database_recorded": True
        }

    except Exception as e:
        await db.rollback()
        # Clean up partially saved file if database commit fails
        if saved_file_path and saved_file_path.exists():
            try:
                saved_file_path.unlink()
            except Exception as rm_err:
                logger.error(f"Failed to cleanup aborted file {saved_file_path}: {rm_err}")

        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Failed to persist evidence photo: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred while persisting evidence photo")
