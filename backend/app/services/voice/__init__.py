from app.services.voice.gateway import VoiceGateway
from app.services.voice.mock_service import MockVoiceService
from app.services.voice.gnani_service import GnaniVoiceService
from app.core.config import settings

def get_voice_service() -> VoiceGateway:
    """
    Factory function returning the configured VoiceGateway.
    Returns GnaniVoiceService (which delegates to MockVoiceService if no key is configured).
    """
    return GnaniVoiceService()

__all__ = ["VoiceGateway", "MockVoiceService", "GnaniVoiceService", "get_voice_service"]
