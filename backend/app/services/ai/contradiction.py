from typing import List
from app.schemas.incident import (
    IncidentExtraction,
    ReviewFlag,
    WildlifeSpecies,
    CropCategory,
    DamageUnit
)

class DomainReviewAuditor:
    """
    Neutral Agricultural Domain & Consistency Review Assistant.
    Provides non-judgmental clarification prompts to help farmers review details
    before filing their self-declared evidence dossier.
    
    IMPORTANT:
    This assistant does NOT verify wildlife identity, authenticate photographs,
    confirm GPS validity, or determine compensation approval.
    """

    # Agricultural planting density reference benchmarks (approximate agronomic ranges per acre)
    DENSITY_BENCHMARKS = {
        CropCategory.BANANA: 1200.0,   # Typical max plant population per acre
        CropCategory.COCONUT: 80.0,    # Standard bearing palm spacing per acre
        CropCategory.SUGARCANE: 1.0,   # Acre area reference
        CropCategory.PADDY: 1.0,       # Acre area reference
    }

    @classmethod
    def audit(
        cls,
        extracted: IncidentExtraction,
        parcel_acres: float = 2.5,
        hours_since_incident: float = 12.0
    ) -> List[ReviewFlag]:
        flags: List[ReviewFlag] = []

        # 1. Neutral Clarification: Wild Boar Feeding Pattern vs. Palms
        if (
            extracted.wildlife_species == WildlifeSpecies.WILD_BOAR
            and extracted.crop_damaged == CropCategory.COCONUT
            and extracted.damage_unit == DamageUnit.TREES
        ):
            flags.append(
                ReviewFlag(
                    code="REVIEW_DAMAGE_PATTERN_BOAR_PALM",
                    severity="REVIEW",
                    message_en=(
                        "Clarification note: Wild boar foraging typically impacts young saplings, "
                        "root zones, or fallen nuts. Please confirm whether the damage observed "
                        "was to young saplings or fallen produce."
                    ),
                    prompt_ta=(
                        "காட்டுப்பன்றி சேதம் பொதுவாக இளங்கன்றுகள், வேர்ப்பகுதி அல்லது கீழே விழுந்த தேங்காய்களில் காணப்படும். "
                        "சேதமடைந்தது இளங்கன்றுகளா அல்லது மரங்களா என்பதை தயவுசெய்து உறுதிப்படுத்தவும்."
                    )
                )
            )

        # 2. Neutral Clarification: Peafowl Feeding Pattern vs. Trees
        if (
            extracted.wildlife_species == WildlifeSpecies.PEAFOWL
            and extracted.crop_damaged in [CropCategory.COCONUT, CropCategory.BANANA]
            and extracted.damage_unit == DamageUnit.TREES
            and extracted.damage_quantity > 5
        ):
            flags.append(
                ReviewFlag(
                    code="REVIEW_DAMAGE_PATTERN_PEAFOWL",
                    severity="REVIEW",
                    message_en=(
                        "Clarification note: Peafowl feeding typically affects seeds, tender shoots, "
                        "or standing grains. Please describe the specific nature of crop damage observed."
                    ),
                    prompt_ta=(
                        "மயில்கள் பொதுவாக தானியங்கள் அல்லது இளந்தளிர்களை உண்ணும். "
                        "உங்கள் பயிரில் ஏற்பட்ட சேதத்தின் தன்மையை தயவுசெய்து மேலும் விவரிக்கவும்."
                    )
                )
            )

        # 3. Density Benchmark Reference: Banana
        if (
            extracted.crop_damaged == CropCategory.BANANA
            and extracted.damage_unit in [DamageUnit.TREES, DamageUnit.PLANTS]
        ):
            benchmark = parcel_acres * cls.DENSITY_BENCHMARKS[CropCategory.BANANA]
            if extracted.damage_quantity > benchmark:
                flags.append(
                    ReviewFlag(
                        code="REVIEW_DENSITY_BENCHMARK_BANANA",
                        severity="REVIEW",
                        message_en=(
                            f"Acreage benchmark note: Standard banana cultivation typically accommodates ~{int(benchmark)} "
                            f"plants for a {parcel_acres} acre parcel. Please review the reported quantity ({int(extracted.damage_quantity)}) "
                            f"or confirm if multiple plots were affected."
                        ),
                        prompt_ta=(
                            f"ஒரு ஏக்கருக்கு வழக்கமாக 1,000-1,200 வாழை மரங்கள் வரை இருக்கும். "
                            f"உங்கள் {parcel_acres} ஏக்கர் நிலத்திற்கு {int(extracted.damage_quantity)} மரங்கள் என்பது "
                            f"வழக்கமான அளவைவிட கூடுதலாக உள்ளதால், எண்ணிக்கையை மீண்டும் ஒருமுறை சரிபார்த்துக் கொள்ளவும்."
                        )
                    )
                )

        # 4. Density Benchmark Reference: Coconut
        if (
            extracted.crop_damaged == CropCategory.COCONUT
            and extracted.damage_unit == DamageUnit.TREES
        ):
            benchmark = parcel_acres * cls.DENSITY_BENCHMARKS[CropCategory.COCONUT]
            if extracted.damage_quantity > benchmark:
                flags.append(
                    ReviewFlag(
                        code="REVIEW_DENSITY_BENCHMARK_COCONUT",
                        severity="REVIEW",
                        message_en=(
                            f"Acreage benchmark note: Typical bearing coconut spacing accommodates ~{int(benchmark)} "
                            f"palms for a {parcel_acres} acre parcel. Please review if the reported count ({int(extracted.damage_quantity)}) "
                            f"includes saplings or multiple holdings."
                        ),
                        prompt_ta=(
                            f"உங்கள் {parcel_acres} ஏக்கர் நிலத்தில் வழக்கமாக சுமார் {int(benchmark)} தென்னை மரங்கள் வரை இருக்கலாம். "
                            f"குறிப்பிடப்பட்ட {int(extracted.damage_quantity)} மரங்கள் என்ற எண்ணிக்கையை மீண்டும் ஒருமுறை சரிபார்க்கவும்."
                        )
                    )
                )

        # 5. Reporting Timeline Advisory (>72 Hours)
        if hours_since_incident > 72.0:
            flags.append(
                ReviewFlag(
                    code="REVIEW_TIMELINE_ADVISORY",
                    severity="INFO",
                    message_en=(
                        "Timeline advisory: Prompt reporting is recommended for timely field inspections. "
                        "For incidents over 72 hours old, ground inspection officers may request explanation of the delay."
                    ),
                    prompt_ta=(
                        "சம்பவம் நடந்து 72 மணி நேரத்திற்கு மேலாகியுள்ளதால், அதிகாரிகளிடம் சமர்ப்பிக்கும் போது "
                        "தாமதத்திற்கான காரணத்தைக் குறிப்பிட நேரிடலாம்."
                    )
                )
            )

        return flags

# Backward compatibility alias
ContradictionAuditor = DomainReviewAuditor
