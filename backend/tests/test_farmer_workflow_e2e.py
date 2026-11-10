import os
import io
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from PIL import Image

from app.main import app
from app.core.database import init_db
from app.core.config import settings

@pytest.mark.asyncio
async def test_full_farmer_workflow_and_deduplication():
    await init_db()
    orig_mock = settings.USE_MOCK_VOICE
    settings.USE_MOCK_VOICE = True
    try:
        test_run_id = str(uuid.uuid4())[:8]
        test_farmer_id = f"test-farmer-{test_run_id}"
        unique_transcript = f"நேத்து ராத்திரி காட்டு யானை வந்து நாற்பது வாழை மரத்தை முறிச்சிருச்சுங்க (Run: {test_run_id})"

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Step 1: Health check
            health_resp = await client.get("/api/v1/health")
            assert health_resp.status_code == 200

            # Step 2: Voice recording submission (Tamil spoken turn)
            dummy_wav = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00@\x1f\x00\x00\x80>\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
            voice_files = {"audio_file": ("farmer_speech.wav", dummy_wav, "audio/wav")}
            voice_data = {
                "farmer_id": test_farmer_id,
                "farmer_name": "செல்வம்",
                "language": "ta-IN",
                "parcel_acres": "2.5"
            }
            listen_resp = await client.post("/api/v1/voice/listen", files=voice_files, data=voice_data)
            assert listen_resp.status_code == 200
            turn = listen_resp.json()
            assert "transcript" in turn
            assert turn["extracted"]["wildlife_species"] in ["ELEPHANT", "WILD_BOAR", "OTHER"]
            assert turn["extracted"]["damage_quantity"] > 0
            assert "spoken_response_text" in turn
            assert "spoken_response_audio_url" in turn

            # Step 3: Verify rejection of photo upload for nonexistent incident (HTTP 404)
            img_buffer = io.BytesIO()
            test_img = Image.new("RGB", (300, 200), color=(34, 139, 34))
            test_img.save(img_buffer, format="JPEG")
            photo_bytes = img_buffer.getvalue()

            photo_files = {"photo_file": ("damage_field.jpg", photo_bytes, "image/jpeg")}
            invalid_photo_form = {
                "incident_id": f"nonexistent-inc-{test_run_id}",
                "photo_type": "WIDE_ANGLE",
                "latitude": "10.3245",
                "longitude": "76.9512"
            }
            invalid_photo_resp = await client.post("/api/v1/evidence/upload", files=photo_files, data=invalid_photo_form)
            assert invalid_photo_resp.status_code == 404
            assert "not found" in invalid_photo_resp.json()["detail"].lower()

            # Step 4: Create incident (Initial creation)
            create_payload = {
                "farmer_id": test_farmer_id,
                "client_draft_id": f"draft_{test_run_id}",
                "farmer_name": "செல்வம்",
                "wildlife_species": turn["extracted"]["wildlife_species"],
                "wildlife_species_tamil": turn["extracted"]["wildlife_species_tamil"],
                "crop_damaged": turn["extracted"]["crop_damaged"],
                "crop_damaged_tamil": turn["extracted"]["crop_damaged_tamil"],
                "damage_quantity": turn["extracted"]["damage_quantity"],
                "damage_unit": turn["extracted"]["damage_unit"],
                "damage_unit_tamil": turn["extracted"]["damage_unit_tamil"],
                "raw_voice_transcript": unique_transcript
            }
            create_resp = await client.post("/api/v1/incidents/create", json=create_payload)
            assert create_resp.status_code == 200
            inc_res = create_resp.json()
            assert inc_res["success"] is True
            assert "RPD-2026-VAL" in inc_res["incident_code"]
            assert inc_res["duplicate_prevented"] is False
            first_incident_id = inc_res["incident_id"]
            first_incident_code = inc_res["incident_code"]

            # Step 5: Upload valid evidence photo linked to the created incident
            valid_photo_files = {"photo_file": ("damage_field.jpg", photo_bytes, "image/jpeg")}
            valid_photo_form = {
                "incident_id": first_incident_id,
                "photo_type": "WIDE_ANGLE",
                "latitude": "10.3245",
                "longitude": "76.9512",
                "accuracy": "6.5"
            }
            photo_resp = await client.post("/api/v1/evidence/upload", files=valid_photo_files, data=valid_photo_form)
            assert photo_resp.status_code == 200
            photo_data = photo_resp.json()
            assert photo_data["has_gps"] is True
            assert photo_data["latitude"] == 10.3245
            assert photo_data["longitude"] == 76.9512
            assert photo_data["is_verified"] is False
            assert photo_data["location_metadata_source"] == "consent_device_gps"
            assert photo_data["database_recorded"] is True

            # Step 5: Duplicate prevention test (submit exact same payload again)
            dup_resp = await client.post("/api/v1/incidents/create", json=create_payload)
            assert dup_resp.status_code == 200
            dup_res = dup_resp.json()
            assert dup_res["success"] is True
            assert dup_res["duplicate_prevented"] is True
            assert dup_res["incident_id"] == first_incident_id
            assert dup_res["incident_code"] == first_incident_code

            # Step 6: Generate Dossier PDF
            pdf_resp = await client.get(f"/api/v1/dossier/{first_incident_id}/pdf")
            assert pdf_resp.status_code == 200
            assert pdf_resp.headers["content-type"] == "application/pdf"
            pdf_content = pdf_resp.content
            assert len(pdf_content) > 1000

            # Step 7: Parse PDF and inspect strict safety requirements
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(pdf_content))
            assert len(reader.pages) == 1  # Fits cleanly on single A4 sheet
            text = reader.pages[0].extract_text()
            
            # Verify required safety titles & disclaimers
            assert "Self-Declared Wildlife Crop Damage Evidence Dossier — Not an Official Government Form" in text
            assert "சுய சான்று அறிவிப்பு" in text
            assert "அரசு ஆவணம் அல்ல" in text
            assert "Forest Officer" not in text
            assert "வனச்சரக அலுவலர்" not in text
            assert "ஒப்புதல்" in text or "இருப்பிட தகவல்" in text
    finally:
        settings.USE_MOCK_VOICE = orig_mock
