from abc import ABC, abstractmethod
from typing import Dict, Any

class VoiceGateway(ABC):
    """
    Abstract Base Class for Speech-to-Text and Text-to-Speech integrations.
    Supports both Gnani Vachana production APIs and deterministic local mocks.
    """

    @abstractmethod
    async def transcribe_speech(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        content_type: str = "audio/wav",
        language_code: str = "ta-IN"
    ) -> Dict[str, Any]:
        """
        Transcribes farmer spoken audio into text.
        Returns:
            {
                "transcript": str,
                "confidence": float,
                "language": str,
                "status": "success"
            }
        """
        pass

    @abstractmethod
    async def synthesize_speech(
        self,
        text: str,
        language_code: str = "ta-IN",
        speed: float = 0.95
    ) -> bytes:
        """
        Synthesizes Tamil or English text into natural spoken audio bytes (WAV/MP3).
        """
        pass
