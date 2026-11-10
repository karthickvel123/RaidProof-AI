import logging
import hashlib
from pathlib import Path
from typing import Dict, Any, Optional
from app.services.voice import get_voice_service
from app.services.ai.extractor import IncidentExtractor
from app.services.ai.contradiction import DomainReviewAuditor
from app.schemas.incident import IncidentListenResponse

logger = logging.getLogger(__name__)

class ConversationOrchestrator:
    """
    Coordinates Voice Input -> STT -> Extraction -> Review Audit -> Conversational TTS Response.
    Designed for real rural farmer workflows without fictional profile generation.
    """

    @classmethod
    async def process_voice_turn(
        cls,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        content_type: str = "audio/wav",
        language_code: str = "ta-IN",
        parcel_acres: Optional[float] = None,
        farmer_name: Optional[str] = None,
        transcript_override: Optional[str] = None
    ) -> IncidentListenResponse:
        voice_service = get_voice_service()

        # 1. Speech to Text via Gnani Prisma v3.0 (or direct transcript override if provided)
        if transcript_override and transcript_override.strip():
            transcript = transcript_override.strip()
            confidence = 1.0
        else:
            stt_result = await voice_service.transcribe_speech(
                audio_bytes=audio_bytes,
                filename=filename,
                content_type=content_type,
                language_code=language_code
            )
            transcript = stt_result.get("transcript", "")
            confidence = stt_result.get("confidence", 0.90)

        # 2. Extract structured entities via LLM / Tamil parser
        extracted = await IncidentExtractor.extract(transcript)

        # 3. Audit for neutral clarification prompts (no biological/density policing)
        clarification_flags = DomainReviewAuditor.audit(
            extracted=extracted,
            parcel_acres=parcel_acres
        )

        # 4. Formulate polite spoken response
        salutation = (
            f"வணக்கம் {farmer_name.strip()} ஐயா."
            if (farmer_name and farmer_name.strip() and "விவசாயி" not in farmer_name)
            else "வணக்கம் விவசாயி அவர்களே."
        )

        if not transcript or not transcript.strip():
            spoken_text = (
                f"{salutation} உங்கள் குரல் தெளிவாக கேட்கவில்லை. "
                f"மைக்கை அழுத்திப் பிடித்து எந்த விலங்கு எந்தப் பயிரை சேதப்படுத்தியது என்று மீண்டும் பேசவும்."
            )
            next_step = "RECORD_VOICE_AGAIN"
        else:
            review_prompts = [f for f in clarification_flags if f.severity in ["REVIEW", "WARNING", "CRITICAL"]]
            if review_prompts:
                spoken_text = f"{salutation} {review_prompts[0].prompt_ta}"
                next_step = "REVIEW_DETAILS"
            else:
                crop_name = extracted.crop_damaged_tamil or extracted.crop_damaged.value
                animal_name = extracted.wildlife_species_tamil or extracted.wildlife_species.value
                unit_name = extracted.damage_unit_tamil or extracted.damage_unit.value
                qty_val = extracted.damage_quantity
                qty_display = int(qty_val) if qty_val.is_integer() else qty_val

                spoken_text = (
                    f"{salutation} உங்கள் {qty_display} {unit_name} {crop_name} "
                    f"{animal_name}யால் சேதமடைந்தது பதிவாகியுள்ளது. "
                    f"இப்போது உங்கள் தோட்டத்தில் சேதமடைந்த இடத்தை ஒரு புகைப்படம் எடுக்கவும்."
                )
                next_step = "CAPTURE_WIDE_PHOTO"

        # 5. Synthesize spoken response via Gnani Timbre v3.0 (or mock)
        tts_audio = await voice_service.synthesize_speech(
            text=spoken_text,
            language_code=language_code,
            speed=0.95
        )

        # 6. Save synthesized audio to static cache for web playback
        audio_hash = hashlib.md5(spoken_text.encode("utf-8")).hexdigest()[:12]
        cache_filename = f"spoken_reply_{audio_hash}.wav"
        from app.core.config import settings
        cache_dir = Path(settings.STATIC_DIR) / "audio"
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_path = cache_dir / cache_filename

        try:
            with open(cache_path, "wb") as f:
                f.write(tts_audio)
            audio_url = f"/static/audio/{cache_filename}"
        except Exception as cache_err:
            logger.warning(f"Could not cache synthesized speech to disk: {cache_err}")
            audio_url = "/static/audio/fallback_prompt.wav"

        return IncidentListenResponse(
            transcript=transcript,
            confidence=confidence,
            extracted=extracted,
            contradictions=clarification_flags,
            review_flags=clarification_flags,
            spoken_response_text=spoken_text,
            spoken_response_audio_url=audio_url,
            next_step=next_step,
            disclaimer="சுய அறிவிப்பு பதிவு: வனவிலங்கு இனம், புகைப்படம் மற்றும் ஜிபிஎஸ் துல்லியம் கள ஆய்வுக்கு உட்பட்டது."
        )
