from pydantic import BaseModel, Field
from typing import Optional

class VoiceTranscribeResponse(BaseModel):
    transcript: str = Field(..., description="Transcribed text from speech")
    confidence: float = Field(0.9, description="Confidence score 0.0 - 1.0")
    language: str = Field("ta-IN", description="Language code")
    status: str = Field("success", description="Status string")
    provider: Optional[str] = Field(None, description="ASR provider used (gnani_prisma_v3 or mock)")

class VoiceSynthesizeRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize")
    language_code: str = Field("ta-IN", description="Language code")
    speed: float = Field(0.95, description="Speaking rate multiplier")

