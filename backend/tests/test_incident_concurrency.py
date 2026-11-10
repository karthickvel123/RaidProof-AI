import asyncio
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db

@pytest.mark.asyncio
async def test_concurrent_incident_creation_and_unique_codes():
    """
    Spawns multiple concurrent incident creation requests.
    Verifies that all succeed, generate collision-free incident codes,
    and prevent database locking or unique constraint collisions.
    """
    await init_db()
    transport = ASGITransport(app=app)

    async def create_one(idx: int):
        unique_run = uuid.uuid4().hex[:6]
        payload = {
            "farmer_id": f"farmer-concurrent-{idx}-{unique_run}",
            "client_draft_id": f"draft-concurrent-{idx}-{unique_run}",
            "farmer_name": f"விவசாயி-{idx}",
            "wildlife_species": "ELEPHANT",
            "wildlife_species_tamil": "காட்டு யானை",
            "crop_damaged": "BANANA",
            "crop_damaged_tamil": "வாழை",
            "damage_quantity": float(10 + idx),
            "damage_unit": "TREES",
            "damage_unit_tamil": "மரங்கள்",
            "raw_voice_transcript": f"யானை வந்து மரங்களை முறித்தது (விவசாயி {idx} - {unique_run})"
        }
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/v1/incidents/create", json=payload)
            return resp

    # Run 5 concurrent submissions
    tasks = [create_one(i) for i in range(5)]
    responses = await asyncio.gather(*tasks)

    # Verify all succeeded
    codes = set()
    for resp in responses:
        assert resp.status_code == 200, f"Failed with {resp.text}"
        data = resp.json()
        assert data["success"] is True
        assert data["duplicate_prevented"] is False
        codes.add(data["incident_code"])

    # All generated incident codes must be distinct (collision-free)
    assert len(codes) == 5

@pytest.mark.asyncio
async def test_validation_rejects_non_positive_damage_and_acres():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Zero damage_quantity
        p1 = {
            "wildlife_species": "ELEPHANT",
            "crop_damaged": "BANANA",
            "damage_quantity": 0.0,
            "damage_unit": "TREES",
            "raw_voice_transcript": "பயிர்கள் சேதம்"
        }
        r1 = await client.post("/api/v1/incidents/create", json=p1)
        assert r1.status_code == 400
        assert "greater than zero" in r1.json()["detail"].lower()

        # 2. Negative area_acres
        p2 = {
            "wildlife_species": "ELEPHANT",
            "crop_damaged": "BANANA",
            "damage_quantity": 10.0,
            "damage_unit": "TREES",
            "area_acres": -2.0,
            "raw_voice_transcript": "பயிர்கள் சேதம்"
        }
        r2 = await client.post("/api/v1/incidents/create", json=p2)
        assert r2.status_code == 400
        assert "greater than zero" in r2.json()["detail"].lower()

