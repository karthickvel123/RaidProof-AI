import time
import asyncio
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response

from app.core.config import settings
from app.services.voice import get_voice_service
from app.services.ai.orchestrator import ConversationOrchestrator
from app.schemas.incident import IncidentListenResponse

router = APIRouter(prefix="/voice", tags=["Voice"])

@router.get("/diagnostics")
async def voice_diagnostics():
    """
    Performs an active connectivity test to the configured Voice Gateway
    (Gnani Prisma STT and Timbre TTS) and returns operational diagnostics and latency.
    """
    start_time = time.time()
    is_mock = settings.USE_MOCK_VOICE

    if is_mock:
        return {
            "status": "connected",
            "voice_mode": "MOCK",
            "provider": "mock_voice_fallback",
            "stt": {
                "status": "operational",
                "model": "prisma-v3.0 (mock emulation)",
                "endpoint": "local"
            },
            "tts": {
                "status": "operational",
                "model": "timbre-v3.0 (mock tone synthesis)",
                "voice": "Local Chime",
                "endpoint": "local"
            },
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "api_key_configured": bool(settings.GNANI_API_KEY),
            "message": "Operating in offline Mock Mode. Configure GNANI_API_KEY to activate cloud models.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    # Real Mode: live ping to Gnani Vachana endpoints in parallel
    stt_ok = False
    tts_ok = False
    headers = {
        "X-API-Key-ID": settings.GNANI_API_KEY,
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            async def check_tts():
                tts_payload = {
                    "text": "வணக்கம்",
                    "model": "timbre-v3.0",
                    "voice": "Lakshmi",
                    "language": "ta-IN",
                    "speed": 0.95
                }
                r = await client.post(
                    f"{settings.GNANI_BASE_URL.rstrip('/')}/api/v1/tts/inference",
                    headers=headers,
                    json=tts_payload
                )
                return r.status_code == 200

            async def check_stt():
                stt_dummy = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00@\x1f\x00\x00\x80>\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
                stt_files = {"audio_file": ("test.wav", stt_dummy, "audio/wav")}
                stt_data = {
                    "model": "prisma-v3.0",
                    "language_code": "ta-IN",
                    "format": "transcribe"
                }
                stt_headers = {"X-API-Key-ID": settings.GNANI_API_KEY}
                r = await client.post(
                    f"{settings.GNANI_BASE_URL.rstrip('/')}/stt/v3",
                    headers=stt_headers,
                    files=stt_files,
                    data=stt_data
                )
                return r.status_code == 200

            tts_ok, stt_ok = await asyncio.gather(check_tts(), check_stt(), return_exceptions=True)
            tts_ok = bool(tts_ok is True)
            stt_ok = bool(stt_ok is True)

        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "connected" if (stt_ok and tts_ok) else "degraded",
            "voice_mode": "REAL",
            "provider": "gnani_prisma_timbre",
            "base_url": settings.GNANI_BASE_URL,
            "stt": {
                "status": "connected" if stt_ok else "failed",
                "model": "prisma-v3.0",
                "endpoint": "/stt/v3"
            },
            "tts": {
                "status": "connected" if tts_ok else "failed",
                "model": "timbre-v3.0",
                "voice": "Lakshmi",
                "endpoint": "/api/v1/tts/inference"
            },
            "latency_ms": latency_ms,
            "api_key_configured": True,
            "message": "Gnani Vachana Cloud AI fully connected and operational." if (stt_ok and tts_ok) else "Connection issue with Gnani endpoints.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "voice_mode": "REAL",
            "provider": "gnani_prisma_timbre",
            "error": str(e),
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

@router.post("/listen", response_model=IncidentListenResponse)
async def voice_listen(
    audio_file: UploadFile = File(...),
    farmer_id: str = Form("demo-farmer-01"),
    farmer_name: str = Form("செல்வம்"),
    language: str = Form("ta-IN"),
    parcel_acres: float = Form(2.5)
):
    """
    Unified Voice Dialogue Endpoint:
    Accepts farmer's spoken audio -> Transcribes via Gnani Prisma v3.0 ->
    Extracts structured agricultural incident entities ->
    Reviews for agricultural consistency benchmarks ->
    Synthesizes natural spoken response via Gnani Timbre v3.0.
    """
    try:
        audio_bytes = await audio_file.read()
        response = await ConversationOrchestrator.process_voice_turn(
            audio_bytes=audio_bytes,
            filename=audio_file.filename or "audio.wav",
            content_type=audio_file.content_type or "audio/wav",
            language_code=language,
            parcel_acres=parcel_acres,
            farmer_name=farmer_name
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice processing error: {str(e)}")

@router.post("/transcribe")
async def voice_transcribe(
    audio_file: UploadFile = File(...),
    language: str = Form("ta-IN")
):
    """
    Direct ASR Endpoint via Gnani Prisma v3.0
    """
    voice_service = get_voice_service()
    audio_bytes = await audio_file.read()
    result = await voice_service.transcribe_speech(
        audio_bytes=audio_bytes,
        filename=audio_file.filename or "audio.wav",
        content_type=audio_file.content_type or "audio/wav",
        language_code=language
    )
    return result

@router.post("/synthesize")
async def voice_synthesize(
    text: str = Form(...),
    language: str = Form("ta-IN"),
    speed: float = Form(0.95)
):
    """
    Direct TTS Endpoint via Gnani Timbre v3.0
    """
    voice_service = get_voice_service()
    audio_bytes = await voice_service.synthesize_speech(
        text=text,
        language_code=language,
        speed=speed
    )
    return Response(content=audio_bytes, media_type="audio/wav")
