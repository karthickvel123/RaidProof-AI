import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class IncidentReport(Base):
    __tablename__ = "incident_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farmer_id = Column(String(36), ForeignKey("farmers.id"), nullable=False, index=True)
    parcel_id = Column(String(36), ForeignKey("land_parcels.id"), nullable=True, index=True)
    incident_code = Column(String(30), unique=True, nullable=False, index=True)

    wildlife_species = Column(String(50), nullable=False)  # ELEPHANT, WILD_BOAR, GAUR, etc.
    wildlife_species_tamil = Column(String(50), nullable=True)
    crop_damaged = Column(String(50), nullable=False)      # BANANA, COCONUT, PADDY, etc.
    crop_damaged_tamil = Column(String(50), nullable=True)
    damage_quantity = Column(Float, nullable=False)
    damage_unit = Column(String(20), nullable=False)       # TREES, PLANTS, ACRES
    damage_unit_tamil = Column(String(20), nullable=True)

    incident_timestamp = Column(DateTime, nullable=False)
    raw_voice_transcript = Column(Text, nullable=False)
    status = Column(String(30), default="DRAFT")           # DRAFT, VALIDATED, DOSSIER_READY
    pdf_dossier_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    farmer = relationship("Farmer", back_populates="incidents")
    land_parcel = relationship("LandParcel", back_populates="incidents")
    photos = relationship("EvidencePhoto", back_populates="incident", cascade="all, delete-orphan")
    checklist = relationship("DocumentChecklist", back_populates="incident", uselist=False, cascade="all, delete-orphan")
