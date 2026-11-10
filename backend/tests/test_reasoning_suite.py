import pytest
from app.schemas.incident import (
    IncidentExtraction,
    WildlifeSpecies,
    CropCategory,
    DamageUnit
)
from app.services.ai.extractor import IncidentExtractor
from app.services.ai.contradiction import DomainReviewAuditor
from app.services.voice.mock_service import MockVoiceService
from app.services.voice.gnani_service import GnaniVoiceService
from app.core.config import settings

@pytest.mark.asyncio
async def test_mock_voice_service():
    mock_service = MockVoiceService()
    # Test STT
    stt_res = await mock_service.transcribe_speech(b"RIFF....dummy_valid_audio_bytes_header_1234567890")
    assert stt_res["status"] == "success"
    assert stt_res["mode"] == "MOCK"
    assert "யானை" in stt_res["transcript"] or "வாழை" in stt_res["transcript"]

    # Test TTS
    audio = await mock_service.synthesize_speech("வணக்கம்")
    assert len(audio) > 44
    assert audio[:4] == b"RIFF"  # Valid WAV header

@pytest.mark.asyncio
async def test_incident_extractor_tamil():
    sample_text = "நேத்து ராத்திரி காட்டு யானை வந்து நாற்பது வாழை மரத்தை முறிச்சிருச்சுங்க"
    extracted = await IncidentExtractor.extract(sample_text)

    assert extracted.wildlife_species == WildlifeSpecies.ELEPHANT
    assert extracted.crop_damaged == CropCategory.BANANA
    assert extracted.damage_quantity == 40.0
    assert extracted.damage_unit == DamageUnit.TREES

@pytest.mark.asyncio
async def test_neutral_clarification_unspecified_wildlife():
    # When species is OTHER, auditor provides supportive clarification without rejecting
    data = IncidentExtraction(
        wildlife_species=WildlifeSpecies.OTHER,
        crop_damaged=CropCategory.COCONUT,
        damage_quantity=15.0,
        damage_unit=DamageUnit.TREES
    )
    flags = DomainReviewAuditor.audit(data, parcel_acres=2.0)
    assert any(f.code == "CLARIFICATION_WILDLIFE_SPECIES" for f in flags)
    assert all(f.severity == "INFO" for f in flags)

@pytest.mark.asyncio
async def test_no_fixed_crop_quantity_threshold_triggers_review():
    # Verify that no fixed crop quantity threshold (2000, 3500, 10000 trees) triggers an automatic review
    for qty in [500.0, 2000.0, 2500.0, 5000.0, 10000.0]:
        data = IncidentExtraction(
            wildlife_species=WildlifeSpecies.ELEPHANT,
            crop_damaged=CropCategory.BANANA,
            damage_quantity=qty,
            damage_unit=DamageUnit.TREES
        )
        flags = DomainReviewAuditor.audit(data, parcel_acres=1.0)
        assert len(flags) == 0, f"Expected no automatic review flags for quantity {qty}, but got: {flags}"

@pytest.mark.asyncio
async def test_explicit_multi_plot_narrative_clarification():
    # Only triggers clarification when the farmer explicitly references multiple plots
    data = IncidentExtraction(
        wildlife_species=WildlifeSpecies.ELEPHANT,
        crop_damaged=CropCategory.BANANA,
        damage_quantity=150.0,
        damage_unit=DamageUnit.TREES,
        attack_pattern="இரண்டு வெவ்வேறு சர்வே நிலங்களில் யானை சேதம் செய்தது"
    )
    flags = DomainReviewAuditor.audit(data, parcel_acres=2.0)
    assert any(f.code == "CLARIFICATION_MULTI_PLOT_DECLARATION" for f in flags)
    assert all(f.severity == "INFO" for f in flags)
    assert not any("IMPOSSIBLE" in f.code for f in flags)

@pytest.mark.asyncio
async def test_real_vs_mock_separation_never_silent_fallback():
    service = GnaniVoiceService()
    
    # In mock mode, returns MOCK
    settings.USE_MOCK_VOICE = True
    res = await service.transcribe_speech(b"RIFF" + b"0" * 50)
    assert res["mode"] == "MOCK"

    # In REAL mode with no key or invalid key, it MUST raise RuntimeError, never silently fall back
    settings.USE_MOCK_VOICE = False
    service.api_key = ""
    with pytest.raises(RuntimeError) as exc_info:
        await service.transcribe_speech(b"RIFF" + b"0" * 50)
    assert "USE_MOCK_VOICE=False" in str(exc_info.value)

    # Restore settings
    settings.USE_MOCK_VOICE = True
