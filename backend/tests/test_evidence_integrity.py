import io
import uuid
import pytest
from PIL import Image
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db
from app.models.incident import IncidentReport
from app.models.farmer import Farmer
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from datetime import datetime, timezone

@pytest.mark.asyncio
async def test_evidence_upload_validations():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a real incident in DB to test against
        inc_id = f"test-inc-{uuid.uuid4().hex[:8]}"
        async with AsyncSessionLocal() as session:
            test_farmer = Farmer(
                id=f"farmer-{uuid.uuid4().hex[:8]}",
                full_name="சோதனை விவசாயி",
                phone_number=None,
                village="வால்பாறை",
                taluk="பொள்ளாச்சி",
                district="கோயம்புத்தூர்"
            )
            session.add(test_farmer)
            await session.flush()

            test_incident = IncidentReport(
                id=inc_id,
                farmer_id=test_farmer.id,
                incident_code=f"RPD-2026-VAL-{uuid.uuid4().hex[:4].upper()}",
                wildlife_species="ELEPHANT",
                crop_damaged="BANANA",
                damage_quantity=20.0,
                damage_unit="TREES",
                raw_voice_transcript="யானை வாழை மரங்களை சேதப்படுத்தியது",
                incident_timestamp=datetime.now(timezone.utc),
                status="DRAFT"
            )
            session.add(test_incident)
            await session.commit()

        # 1. Test invalid incident ID -> 404
        valid_img_buf = io.BytesIO()
        Image.new("RGB", (100, 100), color="blue").save(valid_img_buf, format="JPEG")
        valid_bytes = valid_img_buf.getvalue()

        r1 = await client.post(
            "/api/v1/evidence/upload",
            files={"photo_file": ("test.jpg", valid_bytes, "image/jpeg")},
            data={"incident_id": "nonexistent-incident-id-9999"}
        )
        assert r1.status_code == 404
        assert "not found" in r1.json()["detail"].lower()

        # 2. Test empty file (0 bytes) -> 400
        r2 = await client.post(
            "/api/v1/evidence/upload",
            files={"photo_file": ("empty.jpg", b"", "image/jpeg")},
            data={"incident_id": inc_id}
        )
        assert r2.status_code == 400
        assert "empty" in r2.json()["detail"].lower()

        # 3. Test corrupted / fake image bytes -> 400
        r3 = await client.post(
            "/api/v1/evidence/upload",
            files={"photo_file": ("fake.jpg", b"NOT_AN_IMAGE_CONTENT_AT_ALL", "image/jpeg")},
            data={"incident_id": inc_id}
        )
        assert r3.status_code == 400
        assert "corrupted" in r3.json()["detail"].lower() or "not a valid image" in r3.json()["detail"].lower()

        # 4. Test invalid photo_type -> 400
        r4 = await client.post(
            "/api/v1/evidence/upload",
            files={"photo_file": ("test.jpg", valid_bytes, "image/jpeg")},
            data={"incident_id": inc_id, "photo_type": "INVALID_TYPE_XYZ"}
        )
        assert r4.status_code == 400
        assert "invalid photo_type" in r4.json()["detail"].lower()

        # 5. Test oversized file (> 10MB) -> 400
        oversized_bytes = b"0" * (10 * 1024 * 1024 + 1024)
        r5 = await client.post(
            "/api/v1/evidence/upload",
            files={"photo_file": ("big.jpg", oversized_bytes, "image/jpeg")},
            data={"incident_id": inc_id}
        )
        assert r5.status_code == 400
        assert "exceeds maximum allowed limit" in r5.json()["detail"].lower()

        # 6. Test successful upload -> 200 with verified database record and provenance
        r6 = await client.post(
            "/api/v1/evidence/upload",
            files={"photo_file": ("valid.jpg", valid_bytes, "image/jpeg")},
            data={
                "incident_id": inc_id,
                "photo_type": "WIDE_ANGLE",
                "latitude": "10.3500",
                "longitude": "76.9200",
                "accuracy": "5.0"
            }
        )
        assert r6.status_code == 200
        data6 = r6.json()
        assert data6["success"] is True
        assert data6["database_recorded"] is True
        assert data6["location_metadata_source"] == "consent_device_gps"
        assert data6["latitude"] == 10.35
        assert data6["accuracy"] == 5.0

