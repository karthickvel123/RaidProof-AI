import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(150), nullable=False)
    phone_number = Column(String(15), unique=True, nullable=False, index=True)
    village = Column(String(100), nullable=False)
    taluk = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False)
    preferred_language = Column(String(10), default="ta-IN")
    aadhaar_last4 = Column(String(4), nullable=True)
    bank_account_masked = Column(String(30), nullable=True)
    bank_ifsc = Column(String(15), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    land_parcels = relationship("LandParcel", back_populates="farmer", cascade="all, delete-orphan")
    incidents = relationship("IncidentReport", back_populates="farmer", cascade="all, delete-orphan")
