from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime

class WildlifeSpecies(str, Enum):
    ELEPHANT = "ELEPHANT"          # யானை
    WILD_BOAR = "WILD_BOAR"        # காட்டுப்பன்றி
    GAUR = "GAUR"                  # காட்டெருமை
    DEER = "DEER"                  # மான்
    MONKEY = "MONKEY"              # குரங்கு
    PEAFOWL = "PEAFOWL"            # மயில்
    OTHER = "OTHER"

class CropCategory(str, Enum):
    BANANA = "BANANA"              # வாழை
    COCONUT = "COCONUT"            # தென்னை
    PADDY = "PADDY"                # நெல்
    SUGARCANE = "SUGARCANE"        # கரும்பு
    GROUNDNUT = "GROUNDNUT"        # நிலக்கடலை
    TAPIOCA = "TAPIOCA"            # மரவள்ளிக்கிழங்கு
    MAIZE = "MAIZE"                # மக்காச்சோளம்
    VEGETABLES = "VEGETABLES"      # காய்கறிகள்
    OTHER = "OTHER"

class DamageUnit(str, Enum):
    TREES = "TREES"                # மரங்கள்
    PLANTS = "PLANTS"              # கன்றுகள் / செடிகள்
    ACRES = "ACRES"                # ஏக்கர்
    CENTS = "CENTS"                # சென்ட்

class IncidentExtraction(BaseModel):
    wildlife_species: WildlifeSpecies = Field(
        default=WildlifeSpecies.OTHER,
        description="Identified wildlife species"
    )
    wildlife_species_tamil: Optional[str] = Field(
        None,
        description="Tamil name of the wild animal"
    )
    crop_damaged: CropCategory = Field(
        default=CropCategory.OTHER,
        description="Damaged agricultural crop"
    )
    crop_damaged_tamil: Optional[str] = Field(
        None,
        description="Tamil name of the crop"
    )
    damage_quantity: float = Field(
        ...,
        ge=0.0,
        description="Quantity of damaged trees, plants, or area"
    )
    damage_unit: DamageUnit = Field(
        default=DamageUnit.TREES,
        description="Unit of damage"
    )
    damage_unit_tamil: Optional[str] = Field(
        None,
        description="Tamil unit name"
    )
    incident_time_approx: Optional[str] = Field(
        None,
        description="Approximate time of day (e.g., Midnight, Dawn, Yesterday 9 PM)"
    )
    attack_pattern: Optional[str] = Field(
        None,
        description="Specific nature of damage (trampling, uprooting, eating, root digging)"
    )

class ContradictionFlag(BaseModel):
    code: str
    severity: str  # CRITICAL or WARNING
    message_en: str
    prompt_ta: str

class IncidentListenResponse(BaseModel):
    transcript: str
    draft_id: Optional[str] = None
    extracted: IncidentExtraction
    contradictions: List[ContradictionFlag] = []
    spoken_response_text: str
    spoken_response_audio_url: Optional[str] = None
    next_step: str  # CAPTURE_PHOTOS, RESOLVE_CONTRADICTION, or REVIEW
