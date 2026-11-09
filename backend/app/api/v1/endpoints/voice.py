from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from app.services.voice import get_voice_service
from app.services.ai.orchestrator import ConversationOrchestrator
from app.schemas.incident import IncidentListenResponse

router = APIRouter(prefix="/voice", tags=["Voice"])

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
    Audits for biological & density contradictions ->
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
