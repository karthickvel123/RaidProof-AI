import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class LandParcel(Base):
    __tablename__ = "land_parcels"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    farmer_id = Column(String(36), ForeignKey("farmers.id"), nullable=False, index=True)
    survey_number = Column(String(50), nullable=False)
    sub_division = Column(String(20), nullable=True)
    patta_number = Column(String(50), nullable=False)
    total_area_acres = Column(Float, nullable=False)
    primary_crop = Column(String(50), nullable=True)
    tenure_type = Column(String(20), default="OWNER")  # OWNER / TENANT
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    farmer = relationship("Farmer", back_populates="land_parcels")
    incidents = relationship("IncidentReport", back_populates="land_parcel")

