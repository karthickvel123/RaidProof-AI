import os
from pathlib import Path
from typing import Any
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "RaidProof AI"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR}/raidproof.db"

    # Gnani AI Platform
    GNANI_BASE_URL: str = "https://api.vachana.ai"
    GNANI_API_KEY: str = ""
    USE_MOCK_VOICE: bool = True  # Defaults to True for safe local development

    # Gemini LLM
    GEMINI_API_KEY: str = ""

    # Paths
    STATIC_DIR: str = str(BASE_DIR / "static")
    UPLOAD_DIR: str = str(BASE_DIR / "static" / "uploads")
    DOSSIER_DIR: str = str(BASE_DIR / "static" / "dossiers")
    FONTS_DIR: str = str(BASE_DIR / "static" / "fonts")

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes", "debug", "dev", "development")
        return bool(v)

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure critical directories exist
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.DOSSIER_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.FONTS_DIR).mkdir(parents=True, exist_ok=True)
