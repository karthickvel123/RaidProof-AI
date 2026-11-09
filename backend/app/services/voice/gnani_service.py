import logging
import httpx
from typing import Dict, Any, List
from app.core.config import settings
from app.services.voice.gateway import VoiceGateway
from app.services.voice.mock_service import MockVoiceService

logger = logging.getLogger(__name__)

# Agricultural and Wildlife custom domain vocabulary for Prisma v3.0
AGRI_VOCABULARY: List[str] = [
    "யானை", "காட்டுப்பன்றி", "காட்டெருமை", "மான்", "குரங்கு", "மயில்",
    "வாழை", "தென்னை", "நெல்", "கரும்பு", "மக்காச்சோளம்", "மரவள்ளிக்கிழங்கு",
    "நிலக்கடலை", "ஏக்கர்", "சென்ட்", "மரங்கள்", "கன்றுகள்", "பயிர்ச்சேதம்",
    "சேதம்", "பட்டா", "சிட்டா", "அடங்கல்", "சர்வே எண்", "வனச்சரகம்", "பஞ்சநாமா"
]

class GnaniVoiceService(VoiceGateway):
    """
    Production Voice Integration for Gnani Prisma v3.0 (STT) and Gnani Timbre v3.0 (TTS).
    Strictly separates Real Gnani mode from Mock mode:
    - If USE_MOCK_VOICE=True, uses MockVoiceService explicitly.
    - If USE_MOCK_VOICE=False, executes real API calls and raises explicit errors on failure.
      NEVER silently falls back to mock mode on real API failure.
    """

    def __init__(self):
        self.base_url = settings.GNANI_BASE_URL.rstrip("/")
        self.api_key = settings.GNANI_API_KEY
        self.mock_service = MockVoiceService()

    def is_mock_mode(self) -> bool:
        return bool(settings.USE_MOCK_VOICE)

    async def transcribe_speech(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        content_type: str = "audio/wav",
        language_code: str = "ta-IN"
    ) -> Dict[str, Any]:
        """
        Transcribes farmer speech using Gnani Prisma v3.0 via Vachana API.
        POST https://api.vachana.ai/stt/v3
        """
        if self.is_mock_mode():
            logger.info("Operating in explicit MOCK voice mode (USE_MOCK_VOICE=True).")
            res = await self.mock_service.transcribe_speech(audio_bytes, filename, content_type, language_code)
            res["mode"] = "MOCK"
            return res

        # Real Gnani API Mode
        if not self.api_key or not self.api_key.strip():
            raise RuntimeError(
                "Gnani Prisma STT Error: GNANI_API_KEY is not set or empty, "
                "while USE_MOCK_VOICE=False. Set GNANI_API_KEY or set USE_MOCK_VOICE=True."
            )

        headers = {
            "X-API-Key-ID": self.api_key
        }

        # Prepare multipart payload for Gnani Prisma v3.0
        files = {
            "audio_file": (filename, audio_bytes, content_type)
        }
        data = {
            "model": "prisma-v3.0",
            "language_code": language_code,
            "format": "transcribe"
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/stt/v3",
                    headers=headers,
                    files=files,
                    data=data
                )
                
                if response.status_code == 200:
                    resp_json = response.json()
                    transcript = resp_json.get("transcript", "")
                    confidence = float(resp_json.get("confidence", 0.90))
                    return {
                        "transcript": transcript,
                        "confidence": confidence,
                        "language": language_code,
                        "status": "success",
                        "provider": "gnani_prisma_v3",
                        "mode": "REAL"
                    }
                else:
                    err_msg = (
                        f"Gnani Prisma STT API returned error status {response.status_code}: "
                        f"{response.text[:200]}"
                    )
                    logger.error(err_msg)
                    # Never fall back to mock silently on real API failure!
                    raise RuntimeError(err_msg)

        except Exception as exc:
            if isinstance(exc, RuntimeError):
                raise exc
            err_msg = f"Gnani Prisma STT network/connection failure: {str(exc)}"
            logger.error(err_msg)
            # Never fall back to mock silently on real API failure!
            raise RuntimeError(err_msg) from exc

    async def synthesize_speech(
        self,
        text: str,
        language_code: str = "ta-IN",
        speed: float = 0.95
    ) -> bytes:
        """
        Synthesizes spoken audio using Gnani Timbre v3.0 via Vachana API.
        POST https://api.vachana.ai/api/v1/tts/inference
        """
        if self.is_mock_mode():
            logger.info("Operating in explicit MOCK voice mode (USE_MOCK_VOICE=True).")
            return await self.mock_service.synthesize_speech(text, language_code, speed)

        # Real Gnani API Mode
        if not self.api_key or not self.api_key.strip():
            raise RuntimeError(
                "Gnani Timbre TTS Error: GNANI_API_KEY is not set or empty, "
                "while USE_MOCK_VOICE=False. Set GNANI_API_KEY or set USE_MOCK_VOICE=True."
            )

        headers = {
            "X-API-Key-ID": self.api_key,
            "Content-Type": "application/json"
        }

        payload = {
            "text": text,
            "model": "timbre-v3.0",
            "voice": "Kavitha",
            "language": language_code,
            "speed": speed
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/v1/tts/inference",
                    headers=headers,
                    json=payload
                )

                if response.status_code == 200:
                    content_type = response.headers.get("content-type", "")
                    if "application/json" in content_type:
                        data = response.json()
                        import base64
                        raw_b64 = data.get("audio_data") or data.get("audio") or ""
                        if raw_b64:
                            return base64.b64decode(raw_b64)
                    return response.content
                else:
                    err_msg = (
                        f"Gnani Timbre TTS API returned error status {response.status_code}: "
                        f"{response.text[:200]}"
                    )
                    logger.error(err_msg)
                    # Never fall back to mock silently on real API failure!
                    raise RuntimeError(err_msg)

        except Exception as exc:
            if isinstance(exc, RuntimeError):
                raise exc
            err_msg = f"Gnani Timbre TTS network/connection failure: {str(exc)}"
            logger.error(err_msg)
            # Never fall back to mock silently on real API failure!
            raise RuntimeError(err_msg) from exc

