import io
import time
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response

from app.core.config import settings
from app.services.voice import get_voice_service
from app.services.ai.orchestrator import ConversationOrchestrator
from app.schemas.incident import IncidentListenResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Voice Engine"])

MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB
ALLOWED_AUDIO_TYPES = {
    "audio/wav", "audio/x-wav", "audio/wave",
    "audio/mpeg", "audio/mp3",
    "audio/webm", "audio/ogg",
    "audio/mp4", "audio/x-m4a", "audio/aac",
    "application/octet-stream"
}

def validate_audio_file(audio_bytes: bytes, content_type: Optional[str], filename: Optional[str]):
    """Validates audio file size and format, rejecting empty or oversized files."""
    if not audio_bytes or len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty (0 bytes)")
    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Audio file size exceeds maximum allowed limit of {MAX_AUDIO_SIZE_BYTES // (1024 * 1024)}MB"
        )
    if content_type and content_type.lower() not in ALLOWED_AUDIO_TYPES:
        # Also check file extension as fallback for browser recordings
        ext = (filename or "").split(".")[-1].lower()
        if ext not in ["wav", "mp3", "webm", "ogg", "m4a", "aac"]:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported audio format '{content_type}'. Supported: WAV, MP3, WebM, OGG, M4A"
            )

@router.get("/diagnostics")
async def voice_diagnostics():
    """
    Real-time API Connection & Model Diagnostics.
    Tests Gnani Prisma STT and Timbre TTS independently, validates response payloads,
    measures round-trip latency, and never leaks API credentials or secrets.
    """
    start_time = time.time()
    voice_service = get_voice_service()

    if voice_service.is_mock_mode():
        return {
            "status": "connected",
            "voice_mode": "MOCK",
            "provider": "local_mock_engine",
            "stt": {
                "status": "connected",
                "model": "prisma-v3.0 (mock emulation)",
                "endpoint": "local",
                "valid_payload": True
            },
            "tts": {
                "status": "connected",
                "model": "timbre-v3.0 (mock tone synthesis)",
                "voice": "Local Chime",
                "endpoint": "local",
                "valid_payload": True
            },
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "api_key_configured": bool(settings.GNANI_API_KEY),
            "message": "Operating in explicit Mock Voice Mode (USE_MOCK_VOICE=True).",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    # REAL MODE: Validate live connectivity to Gnani Vachana Cloud AI
    if not settings.GNANI_API_KEY or not settings.GNANI_API_KEY.strip():
        return {
            "status": "disconnected",
            "voice_mode": "REAL",
            "provider": "gnani_prisma_timbre",
            "stt": {"status": "failed", "model": "prisma-v3.0", "endpoint": "/stt/v3", "valid_payload": False},
            "tts": {"status": "failed", "model": "timbre-v3.0", "endpoint": "/api/v1/tts/inference", "valid_payload": False},
            "latency_ms": 0,
            "api_key_configured": False,
            "message": "GNANI_API_KEY is not configured while in REAL mode.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    stt_status = {"status": "failed", "model": "prisma-v3.0", "endpoint": "/stt/v3", "valid_payload": False}
    tts_status = {"status": "failed", "model": "timbre-v3.0", "voice": "Lakshmi", "endpoint": "/api/v1/tts/inference", "valid_payload": False}

    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            base_url = settings.GNANI_BASE_URL.rstrip('/')

            # Test TTS independently
            async def run_tts_check() -> Dict[str, Any]:
                try:
                    headers = {
                        "X-API-Key-ID": settings.GNANI_API_KEY,
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "text": "வணக்கம்",
                        "model": "timbre-v3.0",
                        "voice": "Lakshmi",
                        "language": "ta-IN",
                        "speed": 0.95
                    }
                    resp = await client.post(f"{base_url}/api/v1/tts/inference", headers=headers, json=payload)
                    if resp.status_code == 200:
                        content_type = resp.headers.get("content-type", "")
                        has_valid_content = False
                        if "application/json" in content_type:
                            data = resp.json()
                            has_valid_content = bool(data.get("audio_data") or data.get("audio") or data.get("success") is True)
                        else:
                            has_valid_content = len(resp.content) > 100

                        return {"connected": has_valid_content, "valid_payload": has_valid_content}
                    else:
                        logger.warning(f"TTS diagnostic returned HTTP {resp.status_code}")
                        return {"connected": False, "valid_payload": False}
                except Exception as ex:
                    logger.warning(f"TTS diagnostic probe failed: {ex}")
                    return {"connected": False, "valid_payload": False}

            # Test STT independently
            async def run_stt_check() -> Dict[str, Any]:
                try:
                    dummy_wav = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00@\x1f\x00\x00\x80>\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
                    files = {"audio_file": ("test.wav", dummy_wav, "audio/wav")}
                    data = {"model": "prisma-v3.0", "language_code": "ta-IN", "format": "transcribe"}
                    headers = {"X-API-Key-ID": settings.GNANI_API_KEY}
                    resp = await client.post(f"{base_url}/stt/v3", headers=headers, files=files, data=data)
                    if resp.status_code == 200:
                        resp_json = resp.json()
                        valid = bool(resp_json.get("success") is True or "request_id" in resp_json or "transcript" in resp_json)
                        return {"connected": valid, "valid_payload": valid}
                    else:
                        logger.warning(f"STT diagnostic returned HTTP {resp.status_code}")
                        return {"connected": False, "valid_payload": False}
                except Exception as ex:
                    logger.warning(f"STT diagnostic probe failed: {ex}")
                    return {"connected": False, "valid_payload": False}

            # Execute probes concurrently and inspect outcomes safely
            tts_res, stt_res = await asyncio.gather(run_tts_check(), run_stt_check(), return_exceptions=True)

            if isinstance(tts_res, dict) and tts_res.get("connected"):
                tts_status["status"] = "connected"
                tts_status["valid_payload"] = True

            if isinstance(stt_res, dict) and stt_res.get("connected"):
                stt_status["status"] = "connected"
                stt_status["valid_payload"] = True

        stt_ok = stt_status["status"] == "connected"
        tts_ok = tts_status["status"] == "connected"

        overall_status = "connected" if (stt_ok and tts_ok) else ("degraded" if (stt_ok or tts_ok) else "disconnected")
        latency_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "status": overall_status,
            "voice_mode": "REAL",
            "provider": "gnani_prisma_timbre",
            "base_url": settings.GNANI_BASE_URL,
            "stt": stt_status,
            "tts": tts_status,
            "latency_ms": latency_ms,
            "api_key_configured": True,
            "message": "Gnani Vachana Cloud AI fully connected and operational." if overall_status == "connected" else "Partial or complete connectivity issue with Gnani cloud endpoints.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Voice diagnostics check error: {e}", exc_info=True)
        return {
            "status": "error",
            "voice_mode": "REAL",
            "provider": "gnani_prisma_timbre",
            "stt": stt_status,
            "tts": tts_status,
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "api_key_configured": True,
            "message": "Diagnostic execution encountered an error.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

@router.post("/listen", response_model=IncidentListenResponse)
async def voice_listen(
    audio_file: UploadFile = File(...),
    farmer_id: Optional[str] = Form(None),
    farmer_name: Optional[str] = Form(None),
    language: str = Form("ta-IN"),
    parcel_acres: Optional[float] = Form(None)
):
    """
    Unified Voice Dialogue Endpoint:
    Accepts farmer's spoken audio -> Transcribes via Gnani Prisma v3.0 ->
    Extracts structured agricultural incident entities ->
    Reviews for neutral clarification prompts ->
    Synthesizes natural spoken response via Gnani Timbre v3.0.
    Does NOT use hardcoded demo farmer identity.
    """
    try:
        audio_bytes = await audio_file.read()
        validate_audio_file(audio_bytes, audio_file.content_type, audio_file.filename)

        response = await ConversationOrchestrator.process_voice_turn(
            audio_bytes=audio_bytes,
            filename=audio_file.filename or "audio.wav",
            content_type=audio_file.content_type or "audio/wav",
            language_code=language,
            parcel_acres=parcel_acres,
            farmer_name=farmer_name
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice processing failure in /listen: {e}", exc_info=True)
        # Avoid leaking internal stack traces or credentials
        raise HTTPException(
            status_code=500,
            detail="Voice processing encountered an internal error. Please try speaking again."
        )

@router.post("/transcribe")
async def voice_transcribe(
    audio_file: UploadFile = File(...),
    language: str = Form("ta-IN")
):
    """
    Direct ASR Endpoint via Gnani Prisma v3.0
    """
    try:
        voice_service = get_voice_service()
        audio_bytes = await audio_file.read()
        validate_audio_file(audio_bytes, audio_file.content_type, audio_file.filename)

        result = await voice_service.transcribe_speech(
            audio_bytes=audio_bytes,
            filename=audio_file.filename or "audio.wav",
            content_type=audio_file.content_type or "audio/wav",
            language_code=language
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ASR transcription failure: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Speech-to-text service encountered an error. Please try again."
        )

@router.post("/synthesize")
async def voice_synthesize(
    text: str = Form(...),
    language: str = Form("ta-IN"),
    speed: float = Form(0.95)
):
    """
    Direct TTS Endpoint via Gnani Timbre v3.0
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text field cannot be empty")

    try:
        voice_service = get_voice_service()
        audio_bytes = await voice_service.synthesize_speech(
            text=text.strip(),
            language_code=language,
            speed=speed
        )
        return Response(content=audio_bytes, media_type="audio/wav")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS synthesis failure: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Text-to-speech service encountered an error. Please try again."
        )
