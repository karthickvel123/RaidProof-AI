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
    - No crop quantity threshold triggers an automatic review flag.
    - Clarification is provided ONLY when the farmer explicitly references multiple plots
      or key declaration details are ambiguous.
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

        # 2. Neutral Clarification: Zero or Missing Damage Quantity
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

        # 3. Neutral Clarification: Multiple or Unlisted Crop Damage
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

        # 4. Neutral Clarification: Farmer explicitly mentions multiple plots or ambiguous land holdings
        # (Zero hardcoded damage_quantity thresholds; strictly triggered by farmer declaration)
        narrative = " ".join([
            extracted.attack_pattern or "",
            extracted.crop_damaged_tamil or "",
            extracted.incident_time_approx or ""
        ]).lower()

        multi_plot_keywords = [
            "பல நில", "இரு நில", "இரண்டு நில", "வெவ்வேறு சர்வே", "அடுத்த நில",
            "அண்டை நில", "கூட்டு நில", "multiple plots", "different survey", "adjacent plot"
        ]

        if any(kw in narrative for kw in multi_plot_keywords):
            flags.append(
                ReviewFlag(
                    code="CLARIFICATION_MULTI_PLOT_DECLARATION",
                    severity="INFO",
                    message_en=(
                        "Informational note: Your statement referenced multiple plots or land holdings. "
                        "You may optionally list each survey or patta number in your self-declaration."
                    ),
                    prompt_ta=(
                        "ஒன்றிற்கும் மேற்பட்ட நிலங்களில் சேதம் ஏற்பட்டுள்ளதாகக் குறிப்பிடப்பட்டுள்ளதால், "
                        "அனைத்து சர்வே எண்களையும் விருப்பத்தின் பேரில் சுய அறிவிப்பில் சேர்க்கலாம்."
                    )
                )
            )

        return flags

# Backward compatibility alias
ContradictionAuditor = DomainReviewAuditor
