import re
import json
import logging
from typing import Optional
from app.core.config import settings
from app.schemas.incident import (
    IncidentExtraction,
    WildlifeSpecies,
    CropCategory,
    DamageUnit
)
from app.services.ai.prompts import INCIDENT_EXTRACTION_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

class IncidentExtractor:
    """
    Extracts structured agricultural incident parameters from farmer speech transcripts.
    Uses Gemini 2.5 Flash when available, with an offline rule-based Tamil NLP fallback.
    """

    TAMIL_NUMBER_MAP = {
        "ஒன்று": 1, "ஒரு": 1, "ரெண்டு": 2, "இரண்டு": 2, "மூன்று": 3, "மூணு": 3,
        "நான்கு": 4, "நாலு": 4, "ஐந்து": 5, "அஞ்சு": 5, "ஆறு": 6, "ஏழு": 7,
        "எட்டு": 8, "ஒன்பது": 9, "பத்து": 10, "பதினைந்து": 15, "இருபது": 20,
        "இருபத்தைந்து": 25, "முப்பது": 30, "முப்பத்தைந்து": 35,
        "நாற்பது": 40, "நாப்பது": 40, "நாற்பத்தைந்து": 45, "நாப்பத்தஞ்சு": 45,
        "ஐம்பது": 50, "அம்பது": 50, "அறுபது": 60, "எழுபது": 70, "எண்பது": 80,
        "தொண்ணூறு": 90, "நூறு": 100, "நூற்றி": 100, "இருநூறு": 200, "முந்நூறு": 300,
        "ஐந்நூறு": 500, "ஆயிரம்": 1000
    }

    @classmethod
    async def extract(cls, transcript: str) -> IncidentExtraction:
        if not transcript or not transcript.strip():
            return IncidentExtraction(
                wildlife_species=WildlifeSpecies.OTHER,
                crop_damaged=CropCategory.OTHER,
                damage_quantity=0.0,
                damage_unit=DamageUnit.TREES
            )

        # 1. Try Gemini LLM if API Key is configured
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
            try:
                extracted = await cls._extract_with_gemini(transcript)
                if extracted:
                    return extracted
            except Exception as e:
                logger.warning(f"Gemini extraction failed: {e}. Using deterministic Tamil rule-based parser.")

        # 2. Deterministic Rule-Based Tamil/English Parser Fallback
        return cls._extract_rule_based(transcript)

    @classmethod
    async def _extract_with_gemini(cls, transcript: str) -> Optional[IncidentExtraction]:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=transcript,
            config=types.GenerateContentConfig(
                system_instruction=INCIDENT_EXTRACTION_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=IncidentExtraction,
                temperature=0.1
            )
        )
        if response.text:
            data = json.loads(response.text)
            return IncidentExtraction(**data)
        return None

    @classmethod
    def _extract_rule_based(cls, transcript: str) -> IncidentExtraction:
        text = transcript.lower()

        # Species matching
        species = WildlifeSpecies.OTHER
        species_ta = "வனவிலங்கு"
        if re.search(r"யானை|elephant", text):
            species = WildlifeSpecies.ELEPHANT
            species_ta = "காட்டு யானை"
        elif re.search(r"காட்டுப்பன்றி|பன்றி|boar|pig", text):
            species = WildlifeSpecies.WILD_BOAR
            species_ta = "காட்டுப்பன்றி"
        elif re.search(r"காட்டெருமை|பைசன்|bison|gaur", text):
            species = WildlifeSpecies.GAUR
            species_ta = "காட்டெருமை"
        elif re.search(r"மான்|deer", text):
            species = WildlifeSpecies.DEER
            species_ta = "மான்"
        elif re.search(r"குரங்கு|monkey", text):
            species = WildlifeSpecies.MONKEY
            species_ta = "குரங்கு"
        elif re.search(r"மயில்|peacock|peafowl", text):
            species = WildlifeSpecies.PEAFOWL
            species_ta = "மயில்"

        # Crop matching
        crop = CropCategory.OTHER
        crop_ta = "பயிர்"
        unit = DamageUnit.TREES
        unit_ta = "மரங்கள்"

        if re.search(r"வாழை|banana", text):
            crop = CropCategory.BANANA
            crop_ta = "வாழை"
            unit = DamageUnit.TREES
            unit_ta = "மரங்கள்"
        elif re.search(r"தென்னை|தேங்காய்|coconut", text):
            crop = CropCategory.COCONUT
            crop_ta = "தென்னை"
            unit = DamageUnit.TREES
            unit_ta = "மரங்கள்"
        elif re.search(r"நெல்|பயிர்|அரிசி|paddy|rice", text):
            crop = CropCategory.PADDY
            crop_ta = "நெல்"
            unit = DamageUnit.ACRES
            unit_ta = "ஏக்கர்"
        elif re.search(r"கரும்பு|sugarcane", text):
            crop = CropCategory.SUGARCANE
            crop_ta = "கரும்பு"
            unit = DamageUnit.ACRES
            unit_ta = "ஏக்கர்"
        elif re.search(r"நிலக்கடலை|வேர்க்கடலை|groundnut|peanut", text):
            crop = CropCategory.GROUNDNUT
            crop_ta = "நிலக்கடலை"
            unit = DamageUnit.ACRES
            unit_ta = "ஏக்கர்"
        elif re.search(r"மரவள்ளிக்கிழங்கு|கிழங்கு|tapioca|cassava", text):
            crop = CropCategory.TAPIOCA
            crop_ta = "மரவள்ளிக்கிழங்கு"
            unit = DamageUnit.PLANTS
            unit_ta = "செடிகள்"
        elif re.search(r"மக்காச்சோளம்|சோளம்|maize|corn", text):
            crop = CropCategory.MAIZE
            crop_ta = "மக்காச்சோளம்"
            unit = DamageUnit.ACRES
            unit_ta = "ஏக்கர்"

        # Quantity extraction
        quantity = 10.0  # Safe default if not detected
        # Check digit numbers first (e.g. 40, 50, 100, 2.5)
        digit_match = re.search(r"\b(\d+(?:\.\d+)?)\b", text)
        if digit_match:
            quantity = float(digit_match.group(1))
        else:
            # Check Tamil number words
            for word, val in cls.TAMIL_NUMBER_MAP.items():
                if word in text:
                    quantity = float(val)
                    break

        # Check explicit unit mentions in speech
        if re.search(r"ஏக்கர்|acre", text):
            unit = DamageUnit.ACRES
            unit_ta = "ஏக்கர்"
        elif re.search(r"மரம்|மரங்கள்|மரத்தை|tree", text):
            unit = DamageUnit.TREES
            unit_ta = "மரங்கள்"
        elif re.search(r"கன்று|கன்றுகள்|செடி|செடிகள்|plant", text):
            unit = DamageUnit.PLANTS
            unit_ta = "கன்றுகள்"

        # Approximate time
        time_approx = "நேற்று இரவு"
        if re.search(r"காலை|விடியற்காலை|morning|dawn", text):
            time_approx = "விடியற்காலை"
        elif re.search(r"மாலை|evening|dusk", text):
            time_approx = "மாலை வேளை"
        elif re.search(r"நடுராத்திரி|நள்ளிரவு|இரவு|ராத்திரி|night|midnight", text):
            time_approx = "இரவு 12:00 - 3:00 மணி"

        return IncidentExtraction(
            wildlife_species=species,
            wildlife_species_tamil=species_ta,
            crop_damaged=crop,
            crop_damaged_tamil=crop_ta,
            damage_quantity=quantity,
            damage_unit=unit,
            damage_unit_tamil=unit_ta,
            incident_time_approx=time_approx,
            attack_pattern="பயிர் மிதித்து மற்றும் முறித்து சேதம் செய்யப்பட்டது"
        )
