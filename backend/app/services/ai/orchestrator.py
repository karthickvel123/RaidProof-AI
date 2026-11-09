import logging
from typing import Dict, Any, Optional
from app.services.voice import get_voice_service
from app.services.ai.extractor import IncidentExtractor
from app.services.ai.contradiction import ContradictionAuditor
from app.schemas.incident import IncidentListenResponse

logger = logging.getLogger(__name__)

class ConversationOrchestrator:
    """
    Coordinates Voice Input -> STT -> Extraction -> Contradiction Audit -> Conversational TTS Response.
    """

    @classmethod
    async def process_voice_turn(
        cls,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        content_type: str = "audio/wav",
        language_code: str = "ta-IN",
        parcel_acres: float = 2.5,
        farmer_name: str = "செல்வம்"
    ) -> IncidentListenResponse:
        voice_service = get_voice_service()

        # 1. Speech to Text via Gnani Prisma v3.0 (or mock)
        stt_result = await voice_service.transcribe_speech(
            audio_bytes=audio_bytes,
            filename=filename,
            content_type=content_type,
            language_code=language_code
        )
        transcript = stt_result.get("transcript", "")

        # 2. Extract structured entities via LLM / Tamil parser
        extracted = await IncidentExtractor.extract(transcript)

        # 3. Audit for contradictions & domain plausibility
        contradictions = ContradictionAuditor.audit(
            extracted=extracted,
            parcel_acres=parcel_acres
        )

        # 4. Formulate spoken response & next step
        review_flags = [f for f in contradictions if f.severity in ["REVIEW", "CRITICAL", "WARNING"]]
        if review_flags:
            spoken_text = f"வணக்கம் {farmer_name} ஐயா. {review_flags[0].prompt_ta}"
            next_step = "REVIEW_DETAILS"
        else:
            # All clear
            crop_name = extracted.crop_damaged_tamil or extracted.crop_damaged.value
            animal_name = extracted.wildlife_species_tamil or extracted.wildlife_species.value
            unit_name = extracted.damage_unit_tamil or extracted.damage_unit.value
            qty_int = int(extracted.damage_quantity) if extracted.damage_quantity.is_integer() else extracted.damage_quantity

            spoken_text = (
                f"வணக்கம் {farmer_name} ஐயா. உங்கள் {qty_int} {unit_name} {crop_name} "
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

        # Save synthesized audio to static cache for web playback
        import hashlib
        from pathlib import Path
        from app.core.config import settings

        audio_hash = hashlib.md5(spoken_text.encode("utf-8")).hexdigest()[:12]
        audio_filename = f"tts_{audio_hash}.wav"
        audio_path = Path(settings.STATIC_DIR) / audio_filename
        with open(audio_path, "wb") as f:
            f.write(tts_audio)

        audio_url = f"/static/{audio_filename}"

        return IncidentListenResponse(
            transcript=transcript,
            extracted=extracted,
            contradictions=contradictions,
            review_flags=contradictions,
            spoken_response_text=spoken_text,
            spoken_response_audio_url=audio_url,
            next_step=next_step
        )

