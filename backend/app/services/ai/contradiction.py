from typing import List, Optional
from app.schemas.incident import (
    IncidentExtraction,
    ReviewFlag,
    WildlifeSpecies,
    CropCategory,
    DamageUnit
)

class DomainReviewAuditor:
    """
    Neutral Agricultural Domain & Self-Declaration Clarification Assistant.
    Formulates neutral, optional clarification prompts to help farmers review details
    before filing their self-declared evidence dossier.
    
    IMPORTANT ARCHITECTURAL CONSTRAINTS:
    - This assistant does NOT verify wildlife identity or authenticate photographs.
    - It does NOT enforce rigid agricultural density limits or biological impossibility rules.
    - It NEVER implies that a farmer's crop-damage statement is invalid or disqualified.
    - All prompts are strictly neutral, supportive, and optional.
    """

    @classmethod
    def audit(
        cls,
        extracted: IncidentExtraction,
        parcel_acres: Optional[float] = None,
        hours_since_incident: Optional[float] = None
    ) -> List[ReviewFlag]:
        flags: List[ReviewFlag] = []

        # 1. Neutral Clarification: Unspecified or Broad Wildlife Identification
        if extracted.wildlife_species in [WildlifeSpecies.OTHER, None]:
            flags.append(
                ReviewFlag(
                    code="CLARIFICATION_WILDLIFE_SPECIES",
                    severity="INFO",
                    message_en=(
                        "Helpful note: The wildlife species was noted broadly. "
                        "If you noticed specific footprints, tracks, or sounds, you may optionally describe them."
                    ),
                    prompt_ta=(
                        "தாக்கிய வனவிலங்கின் வகை பொதுவானதாகப் பதிவாகியுள்ளது. "
                        "விலங்கின் கால் தடம் அல்லது ஒலி ஏதேனும் கவனித்திருந்தால், அதை விருப்பத்தின் பேரில் கூடுதல் தகவலாகக் குறிப்பிடலாம்."
                    )
                )
            )

        # 2. Neutral Clarification: Zero or Unspecified Damage Quantity
        if extracted.damage_quantity is None or extracted.damage_quantity <= 0:
            flags.append(
                ReviewFlag(
                    code="CLARIFICATION_DAMAGE_QUANTITY",
                    severity="INFO",
                    message_en=(
                        "Helpful note: Damage quantity was not captured. "
                        "Please review and declare the estimated count of affected plants, trees, or acreage."
                    ),
                    prompt_ta=(
                        "சேதமடைந்த பயிரின் எண்ணிக்கை அல்லது பரப்பளவை தெளிவாகக் குறிப்பிட்டால் "
                        "ஆவணத்தில் சரியாகப் பதிவு செய்ய ஏதுவாக இருக்கும்."
                    )
                )
            )

        # 3. Neutral Clarification: Multiple or Mixed Crop Damage
        if extracted.crop_damaged == CropCategory.OTHER:
            flags.append(
                ReviewFlag(
                    code="CLARIFICATION_CROP_TYPE",
                    severity="INFO",
                    message_en=(
                        "Helpful note: If multiple crops or an unlisted crop was damaged, "
                        "you may optionally state the local Tamil crop name."
                    ),
                    prompt_ta=(
                        "சேதமடைந்த பயிர் வகை குறித்து உள்ளூர் பயிர் பெயரைக் குறிப்பிட்டால் "
                        "சான்றாவணத்தில் தெளிவாக சேர்க்கப்படும்."
                    )
                )
            )

        # 4. Neutral Clarification: Multi-plot or Contiguous Land Clarification
        if parcel_acres is not None and parcel_acres > 0 and extracted.damage_quantity > 0:
            # Only as an informational reminder if large numbers are mentioned, without asserting impossibility
            if extracted.damage_quantity > 2000 and extracted.damage_unit in [DamageUnit.TREES, DamageUnit.PLANTS]:
                flags.append(
                    ReviewFlag(
                        code="CLARIFICATION_MULTI_PLOT_DECLARATION",
                        severity="INFO",
                        message_en=(
                            f"Informational note: For large counts ({int(extracted.damage_quantity)} {extracted.damage_unit.value}), "
                            f"you may clarify if multiple survey plots or neighboring holdings were affected."
                        ),
                        prompt_ta=(
                            f"குறிப்பிடப்பட்ட {int(extracted.damage_quantity)} மரங்கள்/செடிகள் சேதம் "
                            f"ஒன்றிற்கும் மேற்பட்ட நில சர்வே எண்களைக் கொண்டதா என்பதை தேவைப்பட்டால் தெளிவுபடுத்தலாம்."
                        )
                    )
                )

        return flags

# Backward compatibility alias
ContradictionAuditor = DomainReviewAuditor
