import io
import math
import struct
import wave
from typing import Dict, Any
from app.services.voice.gateway import VoiceGateway

class MockVoiceService(VoiceGateway):
    """
    Deterministic Local Mock Voice Service.
    Enables full offline development, automated testing, and CI without Gnani API keys.
    """

    def __init__(self):
        self.default_transcript = (
            "நேத்து ராத்திரி காட்டு யானை வந்து என்னோட நாப்பது வாழை மரத்தை முறிச்சிருச்சுங்க."
        )

    async def transcribe_speech(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        content_type: str = "audio/wav",
        language_code: str = "ta-IN"
    ) -> Dict[str, Any]:
        """
        Returns simulated high-accuracy transcription of colloquial Tamil speech.
        """
        # If audio is empty, return empty result
        if not audio_bytes or len(audio_bytes) < 44:
            return {
                "transcript": "",
                "confidence": 0.0,
                "language": language_code,
                "status": "empty_audio",
                "provider": "mock_voice_service",
                "mode": "MOCK"
            }

        return {
            "transcript": self.default_transcript,
            "confidence": 0.94,
            "language": language_code,
            "status": "success",
            "provider": "mock_voice_service",
            "mode": "MOCK"
        }

    async def synthesize_speech(
        self,
        text: str,
        language_code: str = "ta-IN",
        speed: float = 0.95
    ) -> bytes:
        """
        Generates a valid 16kHz mono WAV audio file with a soft prompt tone.
        Guarantees that browser audio tags and mobile players can play it.
        """
        sample_rate = 16000
        duration_sec = 1.0  # 1 second valid WAV
        num_samples = int(sample_rate * duration_sec)
        
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)      # Mono
            wav_file.setsampwidth(2)      # 16-bit
            wav_file.setframerate(sample_rate)
            
            # Generate a pleasant 520Hz prompt chime with decay
            frames = bytearray()
            for i in range(num_samples):
                t = i / sample_rate
                envelope = math.exp(-3.0 * t)  # exponential decay
                sample = int(16000 * envelope * math.sin(2.0 * math.pi * 520.0 * t))
                frames.extend(struct.pack("<h", max(-32768, min(32767, sample))))
            
            wav_file.writeframes(frames)
            
        return buffer.getvalue()

