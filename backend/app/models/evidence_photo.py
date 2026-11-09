import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class EvidencePhoto(Base):
    __tablename__ = "evidence_photos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    incident_id = Column(String(36), ForeignKey("incident_reports.id"), nullable=False, index=True)
    photo_type = Column(String(30), nullable=False)  # WIDE_ANGLE, CLOSE_UP_SPOOR, SCALE_REF
    file_path = Column(String(255), nullable=False)
    gps_latitude = Column(Float, nullable=False)
    gps_longitude = Column(Float, nullable=False)
    photo_taken_at = Column(DateTime, nullable=False)
    has_consent_location_metadata = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    incident = relationship("IncidentReport", back_populates="photos")

