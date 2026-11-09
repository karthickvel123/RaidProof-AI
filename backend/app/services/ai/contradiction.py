from typing import List
from app.schemas.incident import (
    IncidentExtraction,
    ContradictionFlag,
    WildlifeSpecies,
    CropCategory,
    DamageUnit
)

class ContradictionAuditor:
    """
    Deterministic Biological, Agricultural Density and Statutory Rule Auditor.
    Pre-emptively prevents forest department claim rejections and disputes.
    """

    # Maximum realistic densities per acre in Tamil Nadu agriculture
    DENSITY_LIMITS = {
        CropCategory.BANANA: 1200.0,   # Max banana plants per acre
        CropCategory.COCONUT: 80.0,    # Max yielding coconut trees per acre
        CropCategory.SUGARCANE: 1.0,   # Acre limit
        CropCategory.PADDY: 1.0,       # Acre limit
    }

    @classmethod
    def audit(
        cls,
        extracted: IncidentExtraction,
        parcel_acres: float = 2.5,
        hours_since_incident: float = 12.0
    ) -> List[ContradictionFlag]:
        flags: List[ContradictionFlag] = []

        # 1. Biological Impossibility: Wild Boar vs. Mature Coconut Palms
        if (
            extracted.wildlife_species == WildlifeSpecies.WILD_BOAR
            and extracted.crop_damaged == CropCategory.COCONUT
            and extracted.damage_unit == DamageUnit.TREES
        ):
            flags.append(
                ContradictionFlag(
                    code="BIO_PLAUSIBILITY_BOAR_COCONUT",
                    severity="CRITICAL",
                    message_en="Wild boars cannot uproot mature yielding coconut trees. They only damage saplings (<1 year) or fallen coconuts.",
                    prompt_ta="காட்டுப்பன்றிகள் பெரிய தென்னை மரங்களை சாய்க்க வாய்ப்பில்லை. சேதமடைந்தது இளங்கன்றுகளா அல்லது கீழே விழுந்த தேங்காய்களா என்று உறுதிப்படுத்தவும்."
                )
            )

        # 2. Biological Impossibility: Peafowl vs. Mature Wood/Tree Felling
        if (
            extracted.wildlife_species == WildlifeSpecies.PEAFOWL
            and extracted.crop_damaged in [CropCategory.COCONUT, CropCategory.BANANA]
            and extracted.damage_unit == DamageUnit.TREES
            and extracted.damage_quantity > 5
        ):
            flags.append(
                ContradictionFlag(
                    code="BIO_PLAUSIBILITY_PEAFOWL_TREES",
                    severity="CRITICAL",
                    message_en="Peafowls eat seeds, tender shoots, and small fruits. They cannot fell mature trees.",
                    prompt_ta="மயில்கள் தானியங்கள் மற்றும் இளந்தளிர்களை மட்டுமே சேதப்படுத்தும். மரங்களை சாய்க்காது. சேத விவரத்தை தெளிவுபடுத்தவும்."
                )
            )

        # 3. Density Limit Check: Banana
        if (
            extracted.crop_damaged == CropCategory.BANANA
            and extracted.damage_unit in [DamageUnit.TREES, DamageUnit.PLANTS]
        ):
            max_allowed = parcel_acres * cls.DENSITY_LIMITS[CropCategory.BANANA]
            if extracted.damage_quantity > max_allowed:
                flags.append(
                    ContradictionFlag(
                        code="DENSITY_EXCEEDED_BANANA",
                        severity="WARNING",
                        message_en=f"Claimed {int(extracted.damage_quantity)} banana plants exceeds maximum possible density ({int(max_allowed)}) for {parcel_acres} acres on your Patta record.",
                        prompt_ta=f"உங்கள் பட்டா நில அளவு {parcel_acres} ஏக்கர். அதில் அதிகபட்சம் {int(max_allowed)} வாழைகளே இருக்கும். சேதமடைந்த மரங்களின் எண்ணிக்கையை மீண்டும் சரிபார்க்கவும்."
                    )
                )

        # 4. Density Limit Check: Coconut
        if (
            extracted.crop_damaged == CropCategory.COCONUT
            and extracted.damage_unit == DamageUnit.TREES
        ):
            max_allowed = parcel_acres * cls.DENSITY_LIMITS[CropCategory.COCONUT]
            if extracted.damage_quantity > max_allowed:
                flags.append(
                    ContradictionFlag(
                        code="DENSITY_EXCEEDED_COCONUT",
                        severity="WARNING",
                        message_en=f"Claimed {int(extracted.damage_quantity)} coconut trees exceeds realistic limit ({int(max_allowed)}) for {parcel_acres} acres.",
                        prompt_ta=f"உங்கள் {parcel_acres} ஏக்கர் நிலத்தில் பொதுவாக {int(max_allowed)} தென்னை மரங்களே இருக்கும். சேதமடைந்த மரங்களை சரிசெய்யவும்."
                    )
                )

        # 5. Statutory Time Window Notice (>72 Hours)
        if hours_since_incident > 72.0:
            flags.append(
                ContradictionFlag(
                    code="STATUTORY_WINDOW_EXPIRED",
                    severity="WARNING",
                    message_en="Incident occurred more than 72 hours ago. Forest department inspection circulars require immediate reporting.",
                    prompt_ta="சம்பவம் நடந்து 72 மணி நேரத்திற்கு மேலாகிவிட்டது. வனத்துறையின் நேரடி ஆய்வுக்கு தாமதத்திற்கான காரணம் தேவைப்படலாம்."
                )
            )

        return flags
