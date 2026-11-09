import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class DocumentChecklist(Base):
    __tablename__ = "document_checklists"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    incident_id = Column(String(36), ForeignKey("incident_reports.id"), nullable=False, unique=True, index=True)

    patta_chitta_ready = Column(Boolean, default=False)
    vao_adangal_ready = Column(Boolean, default=False)
    bank_passbook_ready = Column(Boolean, default=False)
    aadhaar_ready = Column(Boolean, default=False)
    witness_ready = Column(Boolean, default=False)

    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    incident = relationship("IncidentReport", back_populates="checklist")

