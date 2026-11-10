from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def migrate_sqlite_columns(sync_conn):
            # Check incident_reports
            result = sync_conn.execute(text("PRAGMA table_info(incident_reports)"))
            cols = {row[1] for row in result.fetchall()}
            if cols and "consent_latitude" not in cols:
                sync_conn.execute(text("ALTER TABLE incident_reports ADD COLUMN consent_latitude FLOAT"))
            if cols and "consent_longitude" not in cols:
                sync_conn.execute(text("ALTER TABLE incident_reports ADD COLUMN consent_longitude FLOAT"))
            if cols and "consent_gps_accuracy" not in cols:
                sync_conn.execute(text("ALTER TABLE incident_reports ADD COLUMN consent_gps_accuracy FLOAT"))

            # Check evidence_photos
            p_result = sync_conn.execute(text("PRAGMA table_info(evidence_photos)"))
            p_cols = {row[1] for row in p_result.fetchall()}
            if p_cols and "gps_accuracy" not in p_cols:
                sync_conn.execute(text("ALTER TABLE evidence_photos ADD COLUMN gps_accuracy FLOAT"))
            if p_cols and "has_consent_location_metadata" not in p_cols:
                sync_conn.execute(text("ALTER TABLE evidence_photos ADD COLUMN has_consent_location_metadata BOOLEAN DEFAULT 0"))

        await conn.run_sync(migrate_sqlite_columns)


