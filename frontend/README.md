# RaidProof AI — Frontend Client Application

The client interface for **RaidProof AI** is a responsive, mobile-first Web & PWA application crafted in **React 18**, **TypeScript**, **Tailwind CSS v4**, and **Vite**.

Designed specifically for Indian smallholder farmers operating in remote wildlife-corridor and forest-boundary zones, the application delivers a calm, high-contrast green & white visual design with bilingual support (**Tamil** and **English**).

---

## 📱 Application Flow & Screens

The application implements a 9-screen architecture organized into a clean sidebar navigation and a 4-step wizard:

```
[Dashboard] ──> [New Report Wizard (Steps 1 to 4)] ──> [PDF Dossier View]
     │
     ├──> [G.O. 42 Relief Norms & Calculator]
     ├──> [24x7 Forest Department Emergency Directory]
     ├──> [My Reports Table]
     └──> [Farmer Profile & Settings]
```

### 1. Landing Page (`landing`)
- Header with brand logo (*RaidProof-AI / வேலி காப்பான்*), language toggle, and system health status.
- Hero banner showcasing value proposition with direct CTA to initiate a damage report.
- Four feature pills highlighting Voice Reporting, Photo Evidence, GPS Location, and Evidence Dossier.

### 2. Farmer Dashboard (`dashboard`)
- **Live Wildlife Movement Alert Banner**: Real-time forest border warning for elephant herd movements (e.g., Valparai / Anamalai Tiger Reserve buffer).
- **Stat Cards**: Total reports submitted, count under review, and completed records.
- **Quick Access Cards**: Direct navigation to G.O. Ms. No. 42 Relief Schedule & Calculator, and Forest Emergency Helplines (1926).
- **Action Card**: High-visibility "+ Start New Incident Report" card.

### 3. Step 1: Voice Reporting (`wizardStep === 1`)
- Big push-to-talk microphone with animated ripple effects and live audio waveform visualizer.
- Tamil & English in-card language toggle.
- 1-Click realistic scenario testing for Elephant (Valparai), Wild Boar (Pollachi), and Gaur (Nilgiris).
- Real-time transcription display and neutral ambiguity clarification cards.

### 4. Step 2: Add Evidence (`wizardStep === 2`)
- **Capture Photo**: Direct HTML5 camera trigger with automatic hardware GPS coordinates.
- **Upload from Gallery**: File upload supporting field damage photography.
- **Photo Thumbnails**: Interactive preview with remove action and GPS tags.
- **Interactive OpenStreetMap (Leaflet)**: Tap to view or adjust pin location with accuracy bounds.

### 5. Step 3: Review & Confirm (`wizardStep === 3`)
- Bilingual review summary presenting Reported Animal, Damaged Crop, Date/Time, GPS Coordinates, and Description.
- Photo carousel and thumbnail gallery.
- Legally required cultivator affirmation checkbox before generating the dossier.

### 6. Step 4: Evidence Dossier Preview (`wizardStep === 4`)
- Embedded PDF document viewer showing the single-page bilingual A4 dossier with embedded photos.
- **Print Dossier** action (`Printer` icon) for direct printing.
- **Download PDF** button.
- **WhatsApp Share** (`wa.me`) button with prefilled incident code and verification link.

### 7. G.O. Ms. No. 42 Relief Schedule & Calculator (`compensation`)
- Interactive ex-gratia compensation estimator for Paddy, Maize, Banana, Coconut, and Sugarcane.
- Direct "Use in Incident Report" transfer button.
- Complete official government schedule table with caps and required documents.
- Official 4-step government sanction process roadmap.

### 8. Forest Emergency Directory (`contacts`)
- 24x7 Statewide Forest Helpline **`1926`** call button.
- Regional Range Offices (Anamalai Tiger Reserve, Valparai, Manambolly, Coimbatore Flying Squad, Nilgiris, Sathyamangalam).

### 9. My Reports (`my_reports`)
- Comprehensive table of historical incidents with status filters (*All*, *Under Review*, *Completed*).
- Instant preview link to view any generated PDF dossier.

---

## 🛠️ Tech Stack & Libraries
- **Framework**: React 18 with TypeScript
- **Bundler & Dev Server**: Vite v8
- **Styling**: Tailwind CSS v4 with custom emerald/slate palette
- **Icons**: Lucide React
- **Mapping**: Leaflet + React-Leaflet (OpenStreetMap)
- **Local Database**: Dexie.js (IndexedDB for offline drafts)
- **Audio Recording**: Custom `useAudioRecorder` hook (Web Audio API, 16kHz WAV encoding)
- **Camera & GPS**: Custom `useCameraGPS` hook (Geolocation API, accuracy filtering)

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start development server on all interfaces (enables mobile testing over Wi-Fi)
npm run dev -- --host 0.0.0.0 --port 5173

# Production build and type checking
npm run build
```

---

## 📱 Mobile Testing over Wi-Fi
To test the app directly on your smartphone:
1. Ensure your laptop and phone are connected to the same Wi-Fi network.
2. Note your laptop's local IPv4 address (e.g. `10.230.118.81`).
3. Open `http://<YOUR_IP>:5173` in your smartphone browser (Chrome / Safari).
4. Tap the microphone or camera button to test native device permissions.
