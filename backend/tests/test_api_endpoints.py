import io
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db

@pytest.mark.asyncio
async def test_health_endpoint():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "voice_provider" in data

@pytest.mark.asyncio
async def test_voice_listen_api():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create dummy WAV bytes
        dummy_wav = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00@\x1f\x00\x00\x80>\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
        files = {"audio_file": ("test.wav", dummy_wav, "audio/wav")}
        data = {
            "farmer_id": "demo-farmer-01",
            "farmer_name": "செல்வம்",
            "language": "ta-IN",
            "parcel_acres": "2.5"
        }
        response = await client.post("/api/v1/voice/listen", files=files, data=data)
        assert response.status_code == 200
        res = response.json()
        assert "transcript" in res
        assert "extracted" in res
        assert "spoken_response_text" in res
        assert res["extracted"]["damage_quantity"] > 0

@pytest.mark.asyncio
async def test_sample_dossier_pdf_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/dossier/sample/pdf")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert len(response.content) > 1000

