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

        def migrate_sqlite_tables(sync_conn):
            # 1. Migrate farmers table if phone_number has NOT NULL constraint
            f_rows = {row[1]: row[3] for row in sync_conn.execute(text("PRAGMA table_info(farmers)")).fetchall()}
            if f_rows.get("phone_number") == 1:
                sync_conn.execute(text("PRAGMA foreign_keys=OFF;"))
                sync_conn.execute(text("""
                    CREATE TABLE farmers_new (
                        id VARCHAR(36) PRIMARY KEY,
                        full_name VARCHAR(150) NOT NULL,
                        phone_number VARCHAR(20),
                        village VARCHAR(100),
                        taluk VARCHAR(100),
                        district VARCHAR(100),
                        preferred_language VARCHAR(10) DEFAULT 'ta-IN',
                        aadhaar_last4 VARCHAR(4),
                        bank_account_masked VARCHAR(30),
                        bank_ifsc VARCHAR(15),
                        created_at DATETIME
                    );
                """))
                sync_conn.execute(text("INSERT INTO farmers_new SELECT id, full_name, phone_number, village, taluk, district, preferred_language, aadhaar_last4, bank_account_masked, bank_ifsc, created_at FROM farmers;"))
                sync_conn.execute(text("DROP TABLE farmers;"))
                sync_conn.execute(text("ALTER TABLE farmers_new RENAME TO farmers;"))
                sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_farmers_phone_number ON farmers (phone_number);"))
                sync_conn.execute(text("PRAGMA foreign_keys=ON;"))

            # 2. Migrate land_parcels table if total_area_acres has NOT NULL constraint
            lp_rows = {row[1]: row[3] for row in sync_conn.execute(text("PRAGMA table_info(land_parcels)")).fetchall()}
            if lp_rows.get("total_area_acres") == 1:
                sync_conn.execute(text("PRAGMA foreign_keys=OFF;"))
                sync_conn.execute(text("""
                    CREATE TABLE land_parcels_new (
                        id VARCHAR(36) PRIMARY KEY,
                        farmer_id VARCHAR(36) NOT NULL,
                        survey_number VARCHAR(50),
                        sub_division VARCHAR(20),
                        patta_number VARCHAR(50),
                        total_area_acres FLOAT,
                        primary_crop VARCHAR(50),
                        tenure_type VARCHAR(20) DEFAULT 'OWNER',
                        created_at DATETIME,
                        FOREIGN KEY(farmer_id) REFERENCES farmers (id)
                    );
                """))
                sync_conn.execute(text("INSERT INTO land_parcels_new SELECT id, farmer_id, survey_number, sub_division, patta_number, total_area_acres, primary_crop, tenure_type, created_at FROM land_parcels;"))
                sync_conn.execute(text("DROP TABLE land_parcels;"))
                sync_conn.execute(text("ALTER TABLE land_parcels_new RENAME TO land_parcels;"))
                sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_land_parcels_farmer_id ON land_parcels (farmer_id);"))
                sync_conn.execute(text("PRAGMA foreign_keys=ON;"))

            # 3. Check incident_reports
            result = sync_conn.execute(text("PRAGMA table_info(incident_reports)"))
            cols = {row[1] for row in result.fetchall()}
            if cols and "consent_latitude" not in cols:
                sync_conn.execute(text("ALTER TABLE incident_reports ADD COLUMN consent_latitude FLOAT"))
            if cols and "consent_longitude" not in cols:
                sync_conn.execute(text("ALTER TABLE incident_reports ADD COLUMN consent_longitude FLOAT"))
            if cols and "consent_gps_accuracy" not in cols:
                sync_conn.execute(text("ALTER TABLE incident_reports ADD COLUMN consent_gps_accuracy FLOAT"))
            if cols and "client_draft_id" not in cols:
                sync_conn.execute(text("ALTER TABLE incident_reports ADD COLUMN client_draft_id VARCHAR(100)"))

            # 4. Check evidence_photos
            p_result = sync_conn.execute(text("PRAGMA table_info(evidence_photos)"))
            p_cols = {row[1] for row in p_result.fetchall()}
            if p_cols and "gps_accuracy" not in p_cols:
                sync_conn.execute(text("ALTER TABLE evidence_photos ADD COLUMN gps_accuracy FLOAT"))
            if p_cols and "has_consent_location_metadata" not in p_cols:
                sync_conn.execute(text("ALTER TABLE evidence_photos ADD COLUMN has_consent_location_metadata BOOLEAN DEFAULT 0"))
            if p_cols and "location_source" not in p_cols:
                sync_conn.execute(text("ALTER TABLE evidence_photos ADD COLUMN location_source VARCHAR(50) DEFAULT 'none'"))

        await conn.run_sync(migrate_sqlite_tables)
