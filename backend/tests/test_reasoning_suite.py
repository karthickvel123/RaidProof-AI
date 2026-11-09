import pytest
from app.schemas.incident import (
    IncidentExtraction,
    WildlifeSpecies,
    CropCategory,
    DamageUnit
)
from app.services.ai.extractor import IncidentExtractor
from app.services.ai.contradiction import ContradictionAuditor
from app.services.voice.mock_service import MockVoiceService

@pytest.mark.asyncio
async def test_mock_voice_service():
    mock_service = MockVoiceService()
    # Test STT
    stt_res = await mock_service.transcribe_speech(b"RIFF....dummy_valid_audio_bytes_header_1234567890")
    assert stt_res["status"] == "success"
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
async def test_contradiction_biological_mismatch():
    # Wild Boar claims mature coconut palms
    bad_data = IncidentExtraction(
        wildlife_species=WildlifeSpecies.WILD_BOAR,
        crop_damaged=CropCategory.COCONUT,
        damage_quantity=15.0,
        damage_unit=DamageUnit.TREES
    )
    flags = ContradictionAuditor.audit(bad_data, parcel_acres=2.0)
    assert any(f.code == "BIO_PLAUSIBILITY_BOAR_COCONUT" for f in flags)
    assert any(f.severity == "CRITICAL" for f in flags)

@pytest.mark.asyncio
async def test_contradiction_density_exceeded():
    # 3500 banana plants on 1.0 acre (Max is 1200)
    bad_data = IncidentExtraction(
        wildlife_species=WildlifeSpecies.ELEPHANT,
        crop_damaged=CropCategory.BANANA,
        damage_quantity=3500.0,
        damage_unit=DamageUnit.TREES
    )
    flags = ContradictionAuditor.audit(bad_data, parcel_acres=1.0)
    assert any(f.code == "DENSITY_EXCEEDED_BANANA" for f in flags)
    assert any(f.severity == "WARNING" for f in flags)
