# RaidProof AI (வேலி காப்பான்)
## AI-Powered Wildlife Crop Damage Evidence Assistant for Indian Farmers

RaidProof AI is an evidence preparation assistant designed for smallholder Indian farmers affected by wildlife crop raids (elephants, wild boars, gaurs). It enables voice-first reporting in natural Tamil and English using **Gnani Prisma v3.0** (ASR) and **Gnani Timbre v3.0** (TTS), audits claims with an agricultural contradiction engine, and compiles tamper-evident, geotagged official **Evidence Dossiers** matching State Forest Department standards.

---

## Key Capabilities
- 🎙️ **Voice-First in Tamil & English:** Push-to-talk reporting powered by Gnani Prisma v3.0 Speech-to-Text and Timbre v3.0 Text-to-Speech.
- 🌾 **Agricultural Reasoning Layer:** Automatically extracts damaged crops, estimated tree counts/acreage, and raid timeframes.
- ⚖️ **Biological Contradiction Engine:** Audits claims against known agricultural densities (e.g. max banana/coconut density) and biological plausibility (e.g. wild boars vs yielding coconut palms).
- 📍 **Geotagged Photographic Proof:** Enforces GPS EXIF coordinate validation on field damage and animal spoor photos.
- 📄 **Official Bilingual PDF Dossier:** Generates printable A4 Tamil/English dossiers compliant with the Tamil Nadu Forest Department *Panchnama* intimation format.
- 📶 **Offline-First PWA:** Full voice and photo capture in remote forest boundary areas with automatic background synchronization when online.

---

## Project Structure
```
├── backend/            # FastAPI async server, Gnani voice proxy, reasoning & PDF engine
│   ├── app/            # Application modules (api, core, models, schemas, services)
│   ├── static/         # Noto Sans Tamil fonts and uploaded media
│   └── tests/          # Pytest automated test suites
├── frontend/           # React 18, Vite, Tailwind CSS, Dexie.js PWA
└── docs/               # Architecture blueprint and engineering implementation plan
```

---

## Documentation
- [Product Requirements Blueprint](docs/IMPLEMENTATION_PLAN.md)
