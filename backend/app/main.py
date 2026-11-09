import os
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.core.config import settings
from app.core.database import init_db, AsyncSessionLocal
from app.api.v1.router import api_router
from app.models.farmer import Farmer
from app.models.land_parcel import LandParcel

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables
    await init_db()

    # Seed default demonstration farmer and land parcel if DB is fresh
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Farmer))
        existing_farmer = res.scalar_one_or_none()
        if not existing_farmer:
            demo_farmer = Farmer(
                id="demo-farmer-01",
                full_name="செல்வம்",
                phone_number="9876543210",
                village="வால்பாறை",
                taluk="பொள்ளாச்சி",
                district="கோயம்புத்தூர்",
                preferred_language="ta-IN",
                aadhaar_last4="4589",
                bank_account_masked="XXXXXX4512",
                bank_ifsc="SBIN0001234"
            )
            session.add(demo_farmer)

            demo_parcel = LandParcel(
                id="demo-parcel-01",
                farmer_id="demo-farmer-01",
                survey_number="84/2A",
                sub_division="2",
                patta_number="1042",
                total_area_acres=2.5,
                primary_crop="வாழை (Banana)",
                tenure_type="OWNER"
            )
            session.add(demo_parcel)
            await session.commit()

    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered wildlife crop damage evidence assistant for Indian farmers",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware for local PWA & mobile development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for synthesized audio & evidence photos
app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")

# Include master API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "voice_provider": "gnani_prisma_timbre" if not settings.USE_MOCK_VOICE else "mock_voice_fallback",
        "database": "sqlite_ready"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
