from unittest.mock import patch
import httpx
import io
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db
from app.core.config import settings

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
    # Ensure deterministic mock audio response for automated unit test
    orig_mock = settings.USE_MOCK_VOICE
    settings.USE_MOCK_VOICE = True
    try:
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
    finally:
        settings.USE_MOCK_VOICE = orig_mock

@pytest.mark.asyncio
async def test_sample_dossier_pdf_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/dossier/sample/pdf")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert len(response.content) > 1000

@pytest.mark.asyncio
async def test_voice_diagnostics_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/voice/diagnostics")
        assert response.status_code == 200
        data = response.json()
        assert "voice_mode" in data
        assert "status" in data
        assert "stt" in data
        assert "tts" in data

@pytest.mark.asyncio
async def test_voice_diagnostics_stt_ok_tts_fail_is_degraded():
    orig_mock = settings.USE_MOCK_VOICE
    orig_key = settings.GNANI_API_KEY
    settings.USE_MOCK_VOICE = False
    settings.GNANI_API_KEY = "test_key_stt_ok"

    async def mock_post(self, url, *args, **kwargs):
        url_str = str(url)
        if "/stt/v3" in url_str:
            return httpx.Response(200, json={"success": True, "transcript": "", "request_id": "test-req-123"})
        else:
            return httpx.Response(500, json={"error": "TTS offline"})

    try:
        with patch.object(httpx.AsyncClient, "post", mock_post):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.get("/api/v1/voice/diagnostics")
                assert res.status_code == 200
                data = res.json()
                assert data["status"] == "degraded"
                assert data["stt"]["status"] == "connected"
                assert data["stt"]["valid_payload"] is True
                assert data["tts"]["status"] == "failed"
                assert data["tts"]["valid_payload"] is False
    finally:
        settings.USE_MOCK_VOICE = orig_mock
        settings.GNANI_API_KEY = orig_key

@pytest.mark.asyncio
async def test_voice_diagnostics_tts_ok_stt_fail_is_degraded():
    orig_mock = settings.USE_MOCK_VOICE
    orig_key = settings.GNANI_API_KEY
    settings.USE_MOCK_VOICE = False
    settings.GNANI_API_KEY = "test_key_tts_ok"

    async def mock_post(self, url, *args, **kwargs):
        url_str = str(url)
        if "/stt/v3" in url_str:
            return httpx.Response(500, json={"error": "STT offline"})
        else:
            return httpx.Response(200, content=b"RIFF" + b"\x00" * 200, headers={"content-type": "audio/wav"})

    try:
        with patch.object(httpx.AsyncClient, "post", mock_post):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.get("/api/v1/voice/diagnostics")
                assert res.status_code == 200
                data = res.json()
                assert data["status"] == "degraded"
                assert data["stt"]["status"] == "failed"
                assert data["stt"]["valid_payload"] is False
                assert data["tts"]["status"] == "connected"
                assert data["tts"]["valid_payload"] is True
    finally:
        settings.USE_MOCK_VOICE = orig_mock
        settings.GNANI_API_KEY = orig_key



