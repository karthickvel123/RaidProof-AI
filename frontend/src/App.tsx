import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Mic,
  FileText,
  Settings,
  HelpCircle,
  Smartphone,
  ChevronDown,
  ChevronRight,
  Camera,
  Upload,
  RefreshCw,
  Check,
  CheckCircle2,
  AlertTriangle,
  Download,
  Share2,
  Clock,
  MapPin,
  XCircle,
  Save,
  Volume2,
  Activity,
  User,
  ShieldCheck,
  Eye,
  FileCheck
} from 'lucide-react';

import elephantImg from './assets/elephant.jpg';
import boarImg from './assets/boar.jpg';
import gaurImg from './assets/gaur.jpg';
import fieldImg from './assets/field.jpg';

import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useCameraGPS } from './hooks/useCameraGPS';
import { AudioWaveform } from './components/AudioWaveform';
import { SpokenAudioPlayer } from './components/SpokenAudioPlayer';
import { LocationMapPicker } from './components/LocationMapPicker';
import { offlineDb } from './services/db/offlineDb';

type Language = 'en' | 'ta';
type NavTab = 'home' | 'new_incident' | 'records' | 'settings' | 'help';
type Step = 1 | 2 | 3 | 4 | 5;

interface FarmerProfile {
  name: string;
  phone: string;
  village: string;
  taluk: string;
  district: string;
  pattaNumber: string;
  surveyNumber: string;
  acres: number;
}

const DEFAULT_PROFILE: FarmerProfile = {
  name: "M. Ramesh",
  phone: "9876543210",
  village: "Valparai",
  taluk: "Pollachi",
  district: "Coimbatore",
  pattaNumber: "1042",
  surveyNumber: "84/2A",
  acres: 2.5
};

export function App() {
  const [language, setLanguage] = useState<Language>('ta');
  const [activeNav, setActiveNav] = useState<NavTab>('home');
  const [activeStep, setActiveStep] = useState<Step>(2); // Default to Step 2: Voice Assistant as in mockup

  // System & Connection State
  const [systemHealth, setSystemHealth] = useState<{ status: string; voice_provider: string } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPdfViewerModal, setShowPdfViewerModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [diagData, setDiagData] = useState<any>(null);
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);

  // Farmer Profile
  const [profile, setProfile] = useState<FarmerProfile>(() => {
    const saved = localStorage.getItem('raidproof_farmer_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_PROFILE;
  });
  const [tempProfile, setTempProfile] = useState<FarmerProfile>(profile);

  // Voice & Speech
  const { isRecording, volume, startRecording, stopRecording } = useAudioRecorder();
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [contradictions, setContradictions] = useState<any[]>([]);
  const [spokenAudioUrl, setSpokenAudioUrl] = useState<string>("");

  // Location & Map
  const [mapCoords, setMapCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    source: 'consent_device_gps' | 'farmer_map_pin';
  }>({
    latitude: 10.3275,
    longitude: 76.9554,
    accuracy: 4.2,
    source: 'consent_device_gps'
  });

  // Evidence Photos
  const camera = useCameraGPS();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activePhotoSlot, setActivePhotoSlot] = useState<'WIDE' | 'SPOOR'>('WIDE');
  const [widePhotoUrl, setWidePhotoUrl] = useState<string | null>(fieldImg);
  const [widePhotoBlob, setWidePhotoBlob] = useState<Blob | null>(null);
  const [spoorPhotoUrl, setSpoorPhotoUrl] = useState<string | null>(null);
  const [spoorPhotoBlob, setSpoorPhotoBlob] = useState<Blob | null>(null);

  // Checklist
  const [checklist, setChecklist] = useState({
    patta: true,
    adangal: true,
    bank: true,
    aadhaar: true,
    witness: false
  });

  // Incident & Dossier records
  const [claimsList, setClaimsList] = useState<any[]>([
    {
      id: "sample-valparai",
      incident_code: "RPD-2026-VAL-A03284",
      farmer_name: "M. Ramesh",
      created_at: new Date().toISOString(),
      crop_damaged: "BANANA",
      crop_damaged_tamil: "வாழை",
      wildlife_species: "ELEPHANT",
      wildlife_species_tamil: "காட்டு யானை",
      status: "DOSSIER_READY"
    }
  ]);
  const [createdIncidentCode, setCreatedIncidentCode] = useState<string>("RPD-2026-VAL-A03284");
  const [dossierPdfUrl, setDossierPdfUrl] = useState<string>("/api/v1/dossier/sample/pdf");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Fetch initial system health and claims list
  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => res.json())
      .then((data) => setSystemHealth(data))
      .catch(() => {});

    fetch('/api/v1/incidents/list')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setClaimsList(data);
          if (data[0].id) {
            setDossierPdfUrl(`/api/v1/dossier/${data[0].id}/pdf`);
            setCreatedIncidentCode(data[0].incident_code || 'RPD-2026-VAL-A03284');
          }
        }
      })
      .catch(() => {});
  }, []);

  const isRealGnaniMode = systemHealth?.voice_provider === 'gnani_prisma_timbre';
  const isTa = language === 'ta';

  // Run live diagnostics
  const handleRunDiagnostics = async () => {
    setIsLoadingDiag(true);
    try {
      const res = await fetch('/api/v1/voice/diagnostics');
      const data = await res.json();
      setDiagData(data);
    } catch (err: any) {
      setDiagData({ status: 'error', error: err.message });
    } finally {
      setIsLoadingDiag(false);
    }
  };

  // Submit audio speech turn to voice/listen API
  const submitAudioTurn = async (audioBlob: Blob, transcriptOverride?: string) => {
    setIsProcessingVoice(true);
    setVoiceError(null);

    try {
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'farmer_speech.wav');
      formData.append('farmer_id', profile.phone || '9876543210');
      formData.append('farmer_name', profile.name);
      formData.append('language', language === 'ta' ? 'ta-IN' : 'en-IN');
      formData.append('parcel_acres', String(profile.acres));
      if (transcriptOverride) {
        formData.append('transcript_text', transcriptOverride);
      }

      const res = await fetch('/api/v1/voice/listen', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(errJson.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setTranscript(data.transcript);
      setExtractedData(data.extracted);
      setContradictions(data.contradictions || []);
      setSpokenAudioUrl(data.spoken_response_audio_url);
      setVoiceError(null);
    } catch (err: any) {
      console.error('Voice processing failure:', err);
      setVoiceError(
        isTa
          ? `குரல் செயலாக்கத்தில் பிழை (${err.message || 'இணைப்பு பிழை'}). உங்கள் பதிவு பாதுகாக்கப்பட்டுள்ளது.`
          : `Voice processing error (${err.message || 'Connection error'}). Please retry.`
      );
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Scenario 1-click test
  const handleScenarioClick = async (scenarioText: string) => {
    setTranscript(scenarioText);
    const dummyHeader = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
      0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x40, 0x1f, 0x00, 0x00, 0x80, 0x3e, 0x00, 0x00,
      0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61,
      0x00, 0x00, 0x00, 0x00
    ]);
    const blob = new Blob([dummyHeader], { type: 'audio/wav' });
    await submitAudioTurn(blob, scenarioText);
  };

  // Handle Push To Talk toggle
  const handleMicToggle = async () => {
    if (isRecording) {
      const audioBlob = await stopRecording();
      if (audioBlob) {
        await submitAudioTurn(audioBlob);
      }
    } else {
      await startRecording();
    }
  };

  // Local gallery file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (activePhotoSlot === 'WIDE') {
          setWidePhotoUrl(dataUrl);
          setWidePhotoBlob(file);
        } else {
          setSpoorPhotoUrl(dataUrl);
          setSpoorPhotoBlob(file);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Capture from live camera or canvas simulator
  const handleCapturePhoto = async (slot: 'WIDE' | 'SPOOR') => {
    const photo = await camera.capturePhoto();
    if (photo) {
      if (slot === 'WIDE') {
        setWidePhotoUrl(photo.dataUrl);
        setWidePhotoBlob(photo.blob);
      } else {
        setSpoorPhotoUrl(photo.dataUrl);
        setSpoorPhotoBlob(photo.blob);
      }
    }
  };

  // Submit complete incident and generate official PDF dossier
  const handleGenerateDossier = async () => {
    setIsSubmittingReport(true);
    const clientDraftId = 'draft_' + Date.now();

    const payload = {
      farmer_id: profile.phone || '9876543210',
      client_draft_id: clientDraftId,
      farmer_name: profile.name,
      farmer_phone: profile.phone,
      village: profile.village,
      taluk: profile.taluk,
      district: profile.district,
      patta_number: profile.pattaNumber,
      survey_number: profile.surveyNumber,
      area_acres: profile.acres,
      consent_latitude: mapCoords.latitude,
      consent_longitude: mapCoords.longitude,
      consent_gps_accuracy: mapCoords.accuracy,
      checklist: checklist,
      wildlife_species: extractedData?.wildlife_species || 'ELEPHANT',
      wildlife_species_tamil: extractedData?.wildlife_species_tamil || 'காட்டு யானை',
      crop_damaged: extractedData?.crop_damaged || 'BANANA',
      crop_damaged_tamil: extractedData?.crop_damaged_tamil || 'வாழை',
      damage_quantity: extractedData?.damage_quantity || 15,
      damage_unit: extractedData?.damage_unit || 'TREES',
      damage_unit_tamil: extractedData?.damage_unit_tamil || 'மரங்கள்',
      raw_voice_transcript: transcript || 'நேத்து ராத்திரி வால்பாறை தோட்டத்தில் ஒரு காட்டு யானை உள்ளே நுழைந்து 15 வாழை மரங்களை வேரோடு சாய்த்து தின்றுவிட்டது.'
    };

    // Save local draft to offlineDb IndexedDB
    try {
      await offlineDb.drafts.put({
        localId: clientDraftId,
        farmerId: profile.phone || '9876543210',
        farmerName: profile.name,
        transcript: payload.raw_voice_transcript,
        wildlifeSpecies: payload.wildlife_species,
        cropDamaged: payload.crop_damaged,
        damageQuantity: payload.damage_quantity,
        status: 'SYNCING',
        createdAt: Date.now()
      });
    } catch {
      // IndexedDB fallback
    }

    try {
      const res = await fetch('/api/v1/incidents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        const incidentId = result.incident_id;
        setCreatedIncidentCode(result.incident_code);
        setActiveStep(5);

        // Upload evidence photo
        if (widePhotoBlob) {
          const form = new FormData();
          form.append('photo_file', widePhotoBlob, 'wide_photo.jpg');
          form.append('incident_id', incidentId);
          form.append('photo_type', 'WIDE_ANGLE');
          form.append('latitude', String(mapCoords.latitude));
          form.append('longitude', String(mapCoords.longitude));
          form.append('accuracy', String(mapCoords.accuracy));
          await fetch('/api/v1/evidence/upload', { method: 'POST', body: form }).catch(console.warn);
        }

        // Upload spoor photo if present
        if (spoorPhotoBlob) {
          const formSpoor = new FormData();
          formSpoor.append('photo_file', spoorPhotoBlob, 'spoor_photo.jpg');
          formSpoor.append('incident_id', incidentId);
          formSpoor.append('photo_type', 'CLOSE_UP_SPOOR');
          formSpoor.append('latitude', String(mapCoords.latitude));
          formSpoor.append('longitude', String(mapCoords.longitude));
          formSpoor.append('accuracy', String(mapCoords.accuracy));
          await fetch('/api/v1/evidence/upload', { method: 'POST', body: formSpoor }).catch(console.warn);
        }

        setDossierPdfUrl(`/api/v1/dossier/${incidentId}/pdf`);
        setShowPdfViewerModal(true);

        // Add to claimsList
        setClaimsList(prev => [
          {
            id: incidentId,
            incident_code: result.incident_code,
            farmer_name: profile.name,
            created_at: new Date().toISOString(),
            crop_damaged: payload.crop_damaged,
            crop_damaged_tamil: payload.crop_damaged_tamil,
            wildlife_species: payload.wildlife_species,
            wildlife_species_tamil: payload.wildlife_species_tamil,
            status: "DOSSIER_READY"
          },
          ...prev
        ]);
      } else {
        setDossierPdfUrl('/api/v1/dossier/sample/pdf');
        setShowPdfViewerModal(true);
      }
    } catch (err) {
      console.warn('Network issue during dossier generation:', err);
      setDossierPdfUrl('/api/v1/dossier/sample/pdf');
      setShowPdfViewerModal(true);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F9] text-slate-900 font-sans flex flex-col">
      {/* ============================================================== */}
      {/* 1. TOP HEADER BAR (Exact match to reference mockup) */}
      {/* ============================================================== */}
      <header className="w-full bg-[#0066CC] text-white px-4 md:px-6 py-2.5 shadow-sm flex items-center justify-between sticky top-0 z-30">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-tight leading-tight">
              RaidProof-AI
            </h1>
            <p className="text-[11px] text-blue-100 font-medium">
              {isTa ? 'விவசாயிகள் பயிர்ச்சேத பாதுகாப்பு தளம்' : 'AI-Powered Crop Protection'}
            </p>
          </div>
        </div>

        {/* Center Live System Status */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{isRealGnaniMode ? (isTa ? 'ஞானி AI இணைப்பு தயார்' : 'Prisma & Timbre Connected') : (isTa ? 'கணினி சீராக இயங்குகிறது' : 'All Systems Online')}</span>
        </div>

        {/* Right Actions: Language Switcher, Mobile Link, Profile */}
        <div className="flex items-center gap-2.5">
          {/* Prominent Language Switcher */}
          <div className="flex items-center bg-blue-900/60 p-0.5 rounded-xl border border-white/20 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                language === 'en'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ta')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                language === 'ta'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              தமிழ்
            </button>
          </div>

          {/* Mobile Access Link */}
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition"
            title={isTa ? "மொபைல் இணைப்பு" : "Open on Mobile"}
          >
            <Smartphone className="w-4 h-4" />
          </button>

          {/* Farmer Profile Pill */}
          <button
            type="button"
            onClick={() => {
              setTempProfile(profile);
              setShowProfileModal(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="text-left hidden sm:block">
              <span className="block text-[11px] font-bold leading-none">{profile.name}</span>
              <span className="text-[9px] text-blue-100">{createdIncidentCode}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-blue-100" />
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. MAIN LAYOUT (Left Sidebar + Content Workspace) */}
      {/* ============================================================== */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-3 md:p-4 gap-4">
        {/* Left Navigation Sidebar */}
        <aside className="w-20 md:w-28 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center py-4 px-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveNav('home')}
            className={`w-full py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition ${
              activeNav === 'home'
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px]">{isTa ? 'முகப்பு' : 'Home'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveNav('new_incident');
              setActiveStep(2);
            }}
            className={`w-full py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition ${
              activeNav === 'new_incident'
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <Mic className="w-5 h-5" />
            <span className="text-[11px] text-center leading-tight">{isTa ? 'புதிய பதிவு' : 'New Incident'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveNav('records');
              setShowRecordsModal(true);
            }}
            className={`w-full py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition ${
              activeNav === 'records'
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[11px] text-center leading-tight">{isTa ? 'பதிவுகள்' : 'My Records'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveNav('settings');
              setShowDiagnostics(true);
              handleRunDiagnostics();
            }}
            className={`w-full py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition ${
              activeNav === 'settings'
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[11px]">{isTa ? 'அமைப்புகள்' : 'Settings'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveNav('help');
              setShowHelpModal(true);
            }}
            className={`w-full py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition ${
              activeNav === 'help'
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-[11px]">{isTa ? 'உதவி' : 'Help'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMapModal(true)}
            className="w-full py-3 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium transition mt-auto"
          >
            <MapPin className="w-5 h-5" />
            <span className="text-[11px]">{isTa ? 'வரைபடம்' : 'Map'}</span>
          </button>
        </aside>

        {/* Center Main Workspace */}
        <main className="flex-1 flex flex-col gap-3 min-w-0">
          {/* ============================================================== */}
          {/* A. 5-STEP PROCESS STEPPER BAR (Exact match to reference) */}
          {/* ============================================================== */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex items-center justify-between overflow-x-auto">
            <div className="flex items-center justify-between w-full min-w-[540px] px-2">
              {/* Step 1 */}
              <div
                onClick={() => {
                  setActiveStep(1);
                  setShowProfileModal(true);
                }}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-xs ${
                  activeStep === 1 ? 'bg-[#0066CC] text-white ring-4 ring-blue-100' : 'bg-emerald-600 text-white'
                }`}>
                  {activeStep === 1 ? '1' : <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <div className="text-left">
                  <span className={`block text-xs font-bold ${activeStep === 1 ? 'text-[#0066CC]' : 'text-slate-800'} group-hover:text-blue-600 transition`}>
                    {isTa ? 'விவசாயி விவரம்' : 'Farmer Details'}
                  </span>
                </div>
              </div>

              <div className={`flex-1 h-0.5 mx-3 ${activeStep >= 2 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

              {/* Step 2 (Active in reference) */}
              <div
                onClick={() => setActiveStep(2)}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-xs ${
                  activeStep === 2
                    ? 'bg-[#0066CC] text-white ring-4 ring-blue-100'
                    : activeStep > 2
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {activeStep > 2 ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
                </div>
                <div className="text-left">
                  <span className={`block text-xs font-bold ${activeStep === 2 ? 'text-[#0066CC]' : 'text-slate-800'}`}>
                    {isTa ? 'குரல் உதவியாளர்' : 'Voice Assistant'}
                  </span>
                </div>
              </div>

              <div className={`flex-1 h-0.5 mx-3 ${activeStep >= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

              {/* Step 3 */}
              <div
                onClick={() => setActiveStep(3)}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  activeStep === 3
                    ? 'bg-[#0066CC] text-white ring-4 ring-blue-100'
                    : activeStep > 3
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {activeStep > 3 ? <Check className="w-4 h-4 stroke-[3]" /> : '3'}
                </div>
                <div className="text-left">
                  <span className={`block text-xs ${activeStep === 3 ? 'font-bold text-[#0066CC]' : 'font-medium text-slate-500'} group-hover:text-slate-900 transition`}>
                    {isTa ? 'சான்றுகள்' : 'Evidence'}
                  </span>
                </div>
              </div>

              <div className={`flex-1 h-0.5 mx-3 ${activeStep >= 4 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

              {/* Step 4 */}
              <div
                onClick={() => setActiveStep(4)}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  activeStep === 4
                    ? 'bg-[#0066CC] text-white ring-4 ring-blue-100'
                    : activeStep > 4
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {activeStep > 4 ? <Check className="w-4 h-4 stroke-[3]" /> : '4'}
                </div>
                <div className="text-left">
                  <span className={`block text-xs ${activeStep === 4 ? 'font-bold text-[#0066CC]' : 'font-medium text-slate-500'} group-hover:text-slate-900 transition`}>
                    {isTa ? 'சரிபார்ப்பு' : 'Review'}
                  </span>
                </div>
              </div>

              <div className={`flex-1 h-0.5 mx-3 ${activeStep >= 5 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

              {/* Step 5 */}
              <div
                onClick={() => {
                  setActiveStep(5);
                  setShowPdfViewerModal(true);
                }}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  activeStep === 5
                    ? 'bg-[#0066CC] text-white ring-4 ring-blue-100'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  5
                </div>
                <div className="text-left">
                  <span className={`block text-xs ${activeStep === 5 ? 'font-bold text-[#0066CC]' : 'font-medium text-slate-500'} group-hover:text-slate-900 transition`}>
                    {isTa ? 'சமர்ப்பி' : 'Submit'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* B. UPPER CARD: VOICE ASSISTANT & 3 SCENARIO TILES */}
          {/* ============================================================== */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0066CC] flex items-center justify-center">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isTa ? 'குரல் உதவியாளர்' : 'Voice Assistant'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isTa
                      ? 'தமிழில் பேசவும் அல்லது மாதிரி சூழலைத் தேர்ந்தெடுக்கவும்:'
                      : 'Speak in Tamil or choose a realistic scenario:'}
                  </p>
                </div>
              </div>

              <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[3]" />
                <span>{isRealGnaniMode ? (isTa ? 'ஞானி STT தயார்' : 'Prisma STT Connected') : (isTa ? 'ஞானி STT தயார்' : 'Prisma STT Ready')}</span>
              </div>
            </div>

            {/* Split Grid: 3 Scenario Cards on Left, Tap to Speak on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* 3 Scenario Cards (Left 9 cols on desktop) */}
              <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Scenario 1: Elephant / Valparai */}
                <div
                  onClick={() =>
                    handleScenarioClick(
                      'நேத்து ராத்திரி வால்பாறை தோட்டத்தில் ஒரு காட்டு யானை உள்ளே நுழைந்து 15 வாழை மரங்களை வேரோடு சாய்த்து தின்றுவிட்டது.'
                    )
                  }
                  className="rounded-2xl border border-blue-200/80 bg-blue-50/20 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col group"
                >
                  <div className="h-28 w-full overflow-hidden bg-slate-100 relative">
                    <img
                      src={elephantImg}
                      alt="Elephant in Valparai"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3 text-center flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        {isTa ? 'வால்பாறை' : 'வால்பாறை (Valparai)'}
                      </h4>
                      <p className="font-semibold text-xs text-slate-800 mt-0.5">
                        {isTa ? 'காட்டு யானை' : 'காட்டு யானை'}
                      </p>
                      <p className="text-xs text-slate-700 font-medium">
                        {isTa ? '15 வாழை மரங்கள் சேதம்' : '15 வாழை மரங்கள் சேதம்'}
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] text-slate-400 block border-t pt-1.5 border-slate-100">
                      Text-based AI demo – bypasses Prisma STT
                    </span>
                  </div>
                </div>

                {/* Scenario 2: Wild Boar / Pollachi */}
                <div
                  onClick={() =>
                    handleScenarioClick(
                      'பொள்ளாச்சி தோட்டத்தில் முந்தாநாள் இரவு 6 காட்டுப்பன்றிகள் வந்து அரை ஏக்கர் நிலக்கடலை பயிரை கிளறி நாசம் செய்துவிட்டது.'
                    )
                  }
                  className="rounded-2xl border border-blue-200/80 bg-blue-50/20 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col group"
                >
                  <div className="h-28 w-full overflow-hidden bg-slate-100 relative">
                    <img
                      src={boarImg}
                      alt="Wild Boar in Pollachi"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3 text-center flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        {isTa ? 'பொள்ளாச்சி' : 'பொள்ளாச்சி (Pollachi)'}
                      </h4>
                      <p className="font-semibold text-xs text-slate-800 mt-0.5">
                        {isTa ? '6 காட்டுப்பன்றிகள்' : '6 காட்டுப்பன்றிகள்'}
                      </p>
                      <p className="text-xs text-slate-700 font-medium">
                        {isTa ? 'நிலக்கடலை சேதம்' : 'நிலக்கடலை சேதம்'}
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] text-slate-400 block border-t pt-1.5 border-slate-100">
                      Text-based AI demo – bypasses Prisma STT
                    </span>
                  </div>
                </div>

                {/* Scenario 3: Gaur / Nilgiris */}
                <div
                  onClick={() =>
                    handleScenarioClick(
                      'நீலகிரி மலையடிவாரத்தில் காட்டெருமை கூட்டம் வந்து 25 தேயிலை செடிகளையும் வேலியையும் முட்டி உடைத்துவிட்டது.'
                    )
                  }
                  className="rounded-2xl border border-blue-200/80 bg-blue-50/20 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col group"
                >
                  <div className="h-28 w-full overflow-hidden bg-slate-100 relative">
                    <img
                      src={gaurImg}
                      alt="Gaur in Nilgiris"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3 text-center flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        {isTa ? 'நீலகிரி' : 'நீலகிரி (Nilgiris)'}
                      </h4>
                      <p className="font-semibold text-xs text-slate-800 mt-0.5">
                        {isTa ? 'காட்டெருமை கூட்டம்' : 'காட்டெருமை கூட்டம்'}
                      </p>
                      <p className="text-xs text-slate-700 font-medium">
                        {isTa ? '25 தேயிலை செடிகள் சேதம்' : '25 தேயிலை செடிகள் சேதம்'}
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] text-slate-400 block border-t pt-1.5 border-slate-100">
                      Text-based AI demo – bypasses Prisma STT
                    </span>
                  </div>
                </div>
              </div>

              {/* Tap to Speak (Right 3 cols on desktop) */}
              <div className="lg:col-span-3 flex flex-col items-center justify-center p-2">
                <div className="relative flex items-center justify-center">
                  {/* Concentric rings */}
                  <div className="w-28 h-28 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-blue-100/70 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={handleMicToggle}
                        disabled={isProcessingVoice}
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all cursor-pointer ${
                          isRecording ? 'bg-amber-600 animate-pulse ring-4 ring-amber-300' : 'bg-[#0066CC] hover:bg-blue-700'
                        }`}
                        aria-label="Tap to speak"
                      >
                        <Mic className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-center mt-2.5">
                  <p className="font-bold text-xs text-slate-900">
                    {isRecording ? (isTa ? 'பேசவும்...' : 'Listening...') : (isTa ? 'பேச தட்டவும்' : 'Tap to Speak')}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {isTa ? '(அல்லது அழுத்திப் பிடிக்கவும்)' : '(or hold to talk)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message if Voice Processing Failed */}
            {voiceError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{voiceError}</span>
              </div>
            )}

            {/* Neutral Clarification Prompt if Ambiguity Exists */}
            {contradictions.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">
                    {isTa ? 'விளக்கக் குறிப்பு (விருப்பத் தேர்வு):' : 'Clarification Note (Optional):'}
                  </span>
                  {contradictions.map((c, i) => (
                    <p key={i} className="text-amber-800 leading-relaxed">{c.clarification_question || c.message}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Live Audio Waveform Animation if recording */}
            {isRecording && (
              <div className="mt-3 pt-2 border-t border-slate-100">
                <AudioWaveform volume={volume} isRecording={isRecording} />
              </div>
            )}

            {/* Transcript & Spoken Reply Display */}
            {transcript && (
              <div className="mt-3 p-3 bg-blue-50/40 rounded-xl border border-blue-100 text-xs flex items-start gap-2.5">
                <Volume2 className="w-4 h-4 text-[#0066CC] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block mb-0.5">
                    {isTa ? 'பதிவான குரல் வாக்குமூலம்:' : 'Voice Transcript:'}
                  </span>
                  <p className="italic text-slate-900 font-medium leading-relaxed">"{transcript}"</p>
                </div>
              </div>
            )}

            {spokenAudioUrl && (
              <div className="mt-2">
                <SpokenAudioPlayer
                  audioUrl={spokenAudioUrl}
                  autoPlay={true}
                  label={isTa ? 'கணினியின் குரல் பதில் (டிம்ப்ரே லட்சுமி குரல்)' : 'Gnani Timbre Voice Response'}
                />
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* C. LOWER TWO CARDS: CAPTURE EVIDENCE & PDF DOSSIER PREVIEW */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Left Card: Capture Evidence */}
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-slate-700" />
                    <h3 className="font-bold text-sm text-slate-900">
                      {isTa ? 'சான்று புகைப்படங்கள்' : 'Capture Evidence'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActivePhotoSlot(activePhotoSlot === 'WIDE' ? 'SPOOR' : 'WIDE')}
                      className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
                    >
                      {activePhotoSlot === 'WIDE'
                        ? (isTa ? 'முழுத்தோற்றம்' : 'Wide Angle')
                        : (isTa ? 'விலங்கு தடம்' : 'Spoor / Mark')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMapModal(true)}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{isTa ? 'வரைபடம்' : 'Location Map'}</span>
                    </button>
                  </div>
                </div>

                {/* 3 Upload Action Buttons */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => handleCapturePhoto(activePhotoSlot)}
                    className="py-2.5 px-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-center flex flex-col items-center justify-center gap-1 transition"
                  >
                    <Camera className="w-4 h-4 text-[#0066CC]" />
                    <span className="text-[10px] font-bold leading-tight">
                      {isTa ? 'நேரடி கேமரா (GPS)' : 'Live Camera (with GPS)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-center flex flex-col items-center justify-center gap-1 transition"
                  >
                    <Upload className="w-4 h-4 text-emerald-700" />
                    <span className="text-[10px] font-bold leading-tight">
                      {isTa ? 'கேலரி படம் (Gallery Upload)' : 'Gallery Upload'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWidePhotoUrl(fieldImg);
                      setMapCoords(prev => ({ ...prev, latitude: 10.3275, longitude: 76.9554 }));
                    }}
                    className="py-2.5 px-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-center flex flex-col items-center justify-center gap-1 transition"
                  >
                    <FileCheck className="w-4 h-4 text-purple-700" />
                    <span className="text-[10px] font-bold leading-tight">
                      {isTa ? 'மாதிரி படம் (Field Photo Simulation)' : 'Field Photo Simulation'}
                    </span>
                  </button>
                </div>

                {/* Evidence Image Preview with Watermark */}
                <div className="relative rounded-2xl overflow-hidden aspect-[16/9] bg-slate-900 border border-slate-200 shadow-inner">
                  <img
                    src={(activePhotoSlot === 'WIDE' ? widePhotoUrl : spoorPhotoUrl) || fieldImg}
                    alt="Captured Evidence Field"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div className="absolute bottom-2.5 left-2.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg text-white font-mono text-[10px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>GPS: {mapCoords.latitude.toFixed(4)}°N, {mapCoords.longitude.toFixed(4)}°E</span>
                  </div>
                </div>
              </div>

              {/* Bottom Change Photo & Submit Action */}
              <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isTa ? 'படம் மாற்ற' : 'Change Photo'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateDossier}
                  disabled={isSubmittingReport}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{isSubmittingReport ? (isTa ? 'தயாராகிறது...' : 'Generating...') : (isTa ? 'சான்றாவணம் உருவாக்க' : 'Generate Dossier')}</span>
                </button>
              </div>
            </div>

            {/* Right Card: PDF Dossier Preview */}
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-700" />
                    <h3 className="font-bold text-sm text-slate-900">
                      {isTa ? 'சான்றாவண முன்னோட்டம்' : 'PDF Dossier Preview'}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPdfViewerModal(true)}
                    className="px-3 py-1 bg-[#0066CC] hover:bg-blue-700 text-white rounded-full text-xs font-bold transition flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isTa ? 'நேரடியாக பார்' : 'View Dossier In-App'}</span>
                  </button>
                </div>

                {/* Simulated Document Sheet / Viewer Frame matching reference */}
                <div className="rounded-xl overflow-hidden border border-slate-300 shadow-sm bg-slate-800">
                  {/* Top Viewer Toolbar */}
                  <div className="bg-[#323639] text-slate-300 px-3 py-1.5 flex items-center justify-between text-[11px] font-mono border-b border-slate-700 select-none">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-slate-500 rounded-sm"></span>
                      <span>1 / 1</span>
                    </span>
                    <span className="text-slate-400">100%</span>
                    <span className="flex items-center gap-2">
                      <a href={dossierPdfUrl} target="_blank" rel="noreferrer" title="Download">
                        <Download className="w-3.5 h-3.5 hover:text-white" />
                      </a>
                    </span>
                  </div>

                  {/* Inside Paper View */}
                  <div className="bg-white p-3.5 text-xs text-slate-800 flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-xs">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>RaidProof-AI Incident Dossier</span>
                      </div>
                      <div className="space-y-0.5 text-[11px] pt-1">
                        <p><span className="text-slate-500 font-medium">Incident ID:</span> <span className="font-mono font-bold">{createdIncidentCode}</span></p>
                        <p><span className="text-slate-500 font-medium">Farmer:</span> <span className="font-semibold">{profile.name}</span></p>
                        <p><span className="text-slate-500 font-medium">Location:</span> <span>{profile.village}, {profile.taluk}</span></p>
                      </div>
                    </div>

                    <div className="w-28 h-20 rounded-lg overflow-hidden bg-slate-100 border shrink-0">
                      <img src={elephantImg} alt="Dossier evidence" className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100">
                <a
                  href={dossierPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isTa ? 'PDF பதிவிறக்கம்' : 'Download PDF'}</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    const text = encodeURIComponent(
                      `வணக்கம். எனது பயிர்ச்சேத சான்றாவணம் (Dossier ID: ${createdIncidentCode}) தயாராகியுள்ளது.`
                    );
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* D. BOTTOM ACTION STRIP (Exact match to reference mockup) */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-1">
            {/* Left Pill: Share for Mobile */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0066CC] flex items-center justify-center shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">
                    {isTa ? 'மொபைலில் திறக்க' : 'Share for Mobile'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isTa ? 'உங்கள் தொலைபேசியில் இணைப்பைப் பெறுக' : 'Get the app link on your phone'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText('http://10.230.118.81:5173');
                  alert(isTa ? 'இணைப்பு நகலெடுக்கப்பட்டது!' : 'Link copied to clipboard!');
                }}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition"
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>{isTa ? 'நகலெடு' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Right Pill: Recent Records */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">
                    {isTa ? 'முந்தைய பதிவுகள்' : 'Recent Records'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isTa ? 'உங்கள் முந்தைய சான்றாவணங்கள்' : 'View your previous incidents'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRecordsModal(true)}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold text-purple-800 flex items-center gap-1 transition"
              >
                <span>{isTa ? 'அனைத்தும் பார்க்க' : 'View All'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Legal Regulatory Notice */}
          <div className="text-center py-2 px-4 text-[11px] text-slate-500">
            ⚠️ <b>{isTa ? 'சுய அறிவிப்பு சான்றாவணம்:' : 'Self-Declaration Evidence Dossier:'}</b>{' '}
            {isTa
              ? 'இது அதிகாரப்பூர்வ அரசு படிவம் அல்லது இழப்பீட்டு உத்தரவாதம் அல்ல. வனத்துறையின் கள ஆய்வுக்கு சமர்ப்பிக்க விவசாயி சான்றுகளைத் தொகுக்கும் செயலி மட்டுமே.'
              : 'This is not an official government compensation approval. All wildlife claims are subject to official Forest Department field inspection.'}
          </div>
        </main>
      </div>

      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* ============================================================== */}
      {/* MODAL 1: IN-APP PDF DOSSIER PREVIEW */}
      {/* ============================================================== */}
      {showPdfViewerModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            <div className="p-3.5 border-b flex items-center justify-between bg-[#0066CC] text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-200" />
                <h3 className="text-sm font-bold">
                  {isTa ? 'சுய சான்றாவண நேரடி முன்னோட்டம் (Dossier PDF)' : 'Official Self-Declaration Dossier PDF'}
                </h3>
              </div>
              <button
                onClick={() => setShowPdfViewerModal(false)}
                className="p-1 hover:bg-white/20 rounded-full transition"
              >
                <XCircle className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="flex-1 p-2 bg-slate-100 overflow-hidden">
              <iframe
                src={dossierPdfUrl}
                title="Dossier PDF Preview"
                className="w-full h-[68vh] rounded-xl border border-slate-300 bg-white shadow-inner"
              />
            </div>

            <div className="p-3 border-t bg-white flex items-center justify-between gap-2 text-xs">
              <a
                href={dossierPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-[#0066CC] hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isTa ? 'புதிய பக்கத்தில் திற / பதிவிறக்கு' : 'Open in New Tab / Download'}</span>
              </a>

              <button
                onClick={() => setShowPdfViewerModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
              >
                {isTa ? 'மூடு' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: INTERACTIVE LOCATION MAP */}
      {/* ============================================================== */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            <div className="p-3.5 border-b flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">
                  {isTa ? 'தோட்ட இருப்பிட வரைபடம் (Location Pin)' : 'Farm Location Map (OpenStreetMap)'}
                </h3>
              </div>
              <button
                onClick={() => setShowMapModal(false)}
                className="p-1 hover:bg-white/20 rounded-full transition"
              >
                <XCircle className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-4 flex-1">
              <LocationMapPicker
                latitude={mapCoords.latitude}
                longitude={mapCoords.longitude}
                accuracy={mapCoords.accuracy}
                source={mapCoords.source}
                language={language}
                onChange={(lat, lng, acc, src) => {
                  setMapCoords({ latitude: lat, longitude: lng, accuracy: acc, source: src });
                }}
                onRequestDeviceGps={() => {
                  if (camera.gps.isLocked) {
                    setMapCoords({
                      latitude: camera.gps.latitude,
                      longitude: camera.gps.longitude,
                      accuracy: camera.gps.accuracy,
                      source: 'consent_device_gps'
                    });
                  } else {
                    navigator.geolocation?.getCurrentPosition(
                      (pos) => {
                        setMapCoords({
                          latitude: pos.coords.latitude,
                          longitude: pos.coords.longitude,
                          accuracy: pos.coords.accuracy,
                          source: 'consent_device_gps'
                        });
                      },
                      (err) => alert('GPS Error: ' + err.message),
                      { enableHighAccuracy: true, timeout: 10000 }
                    );
                  }
                }}
              />
            </div>

            <div className="p-3 border-t bg-white flex justify-end">
              <button
                onClick={() => setShowMapModal(false)}
                className="px-5 py-2 bg-[#0066CC] hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition"
              >
                {isTa ? 'சரி, உறுதி செய்' : 'Confirm Location'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: MOBILE ACCESS */}
      {/* ============================================================== */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#0066CC]" />
                <span>{isTa ? 'மொபைலில் அணுக' : 'Open on Mobile'}</span>
              </h3>
              <button onClick={() => setShowShareModal(false)}>
                <XCircle className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <p className="text-[11px] text-slate-600">
              {isTa
                ? 'உங்கள் மொபைல் போனை இதே வைஃபை நெட்வொர்க்கில் இணைத்து கீழேயுள்ள முகவரியை திறக்கவும்:'
                : 'Connect your smartphone to the same Wi-Fi network and open:'}
            </p>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between">
              <span className="font-mono font-bold text-blue-950 text-xs select-all">
                http://10.230.118.81:5173
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('http://10.230.118.81:5173');
                  alert(isTa ? 'இணைப்பு நகலெடுக்கப்பட்டது!' : 'Link copied!');
                }}
                className="px-2.5 py-1 bg-[#0066CC] hover:bg-blue-700 text-white font-bold rounded-lg text-[10px]"
              >
                Copy
              </button>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
            >
              {isTa ? 'சரி' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: EDIT FARMER PROFILE */}
      {/* ============================================================== */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl text-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#0066CC]" />
              <span>{isTa ? 'விவசாயி சுயவிவரம் திருத்தம்' : 'Edit Farmer Profile'}</span>
            </h3>

            <div>
              <label className="font-semibold text-slate-700 block mb-0.5">
                {isTa ? 'பெயர்:' : 'Farmer Name:'}
              </label>
              <input
                type="text"
                value={tempProfile.name}
                onChange={(e) => setTempProfile({ ...tempProfile, name: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-0.5">
                  {isTa ? 'தொலைபேசி:' : 'Phone:'}
                </label>
                <input
                  type="text"
                  value={tempProfile.phone}
                  onChange={(e) => setTempProfile({ ...tempProfile, phone: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-0.5">
                  {isTa ? 'கிராமம்:' : 'Village:'}
                </label>
                <input
                  type="text"
                  value={tempProfile.village}
                  onChange={(e) => setTempProfile({ ...tempProfile, village: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-0.5">
                  {isTa ? 'பட்டா எண்:' : 'Patta No:'}
                </label>
                <input
                  type="text"
                  value={tempProfile.pattaNumber}
                  onChange={(e) => setTempProfile({ ...tempProfile, pattaNumber: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-0.5">
                  {isTa ? 'சர்வே எண்:' : 'Survey No:'}
                </label>
                <input
                  type="text"
                  value={tempProfile.surveyNumber}
                  onChange={(e) => setTempProfile({ ...tempProfile, surveyNumber: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            {/* Checklist items viewable in profile review */}
            <div className="p-2.5 bg-slate-50 border rounded-xl space-y-1">
              <span className="font-bold text-[11px] text-slate-700 block">
                {isTa ? 'தேவையான ஆவணங்கள் (Checklist):' : 'Required Documents (Checklist):'}
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.patta}
                  onChange={(e) => setChecklist({ ...checklist, patta: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-[11px]">{isTa ? 'பட்டா / சிட்டா நகல்' : 'Patta / Chitta Copy'}</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.bank}
                  onChange={(e) => setChecklist({ ...checklist, bank: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-[11px]">{isTa ? 'வங்கி கணக்குப் புத்தகம்' : 'Bank Passbook'}</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button
                onClick={() => setShowProfileModal(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
              >
                {isTa ? 'ரத்து' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setProfile(tempProfile);
                  localStorage.setItem('raidproof_farmer_profile', JSON.stringify(tempProfile));
                  setShowProfileModal(false);
                }}
                className="flex-1 py-2 bg-[#0066CC] hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isTa ? 'சேமி' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: DIAGNOSTICS */}
      {/* ============================================================== */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>{isTa ? 'கணினி ஆய்வு (Diagnostics)' : 'System Diagnostics'}</span>
              </h3>
              <button onClick={() => setShowDiagnostics(false)}>
                <XCircle className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            {isLoadingDiag ? (
              <div className="text-center py-6 text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                <p>{isTa ? 'ஞானி AI சோதிக்கிறது...' : 'Testing Gnani AI cloud...'}</p>
              </div>
            ) : diagData ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-slate-50 border flex justify-between">
                  <span>Prisma STT:</span>
                  <span className="font-bold text-emerald-700">{diagData.stt?.status}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border flex justify-between">
                  <span>Timbre TTS:</span>
                  <span className="font-bold text-emerald-700">{diagData.tts?.status}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border flex justify-between">
                  <span>Latency:</span>
                  <span className="font-mono font-bold">{diagData.latency_ms} ms</span>
                </div>
              </div>
            ) : null}

            <button
              onClick={handleRunDiagnostics}
              className="w-full py-2 bg-[#0066CC] hover:bg-blue-700 text-white font-bold rounded-xl"
            >
              {isTa ? 'மீண்டும் சோதி' : 'Test Again'}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 6: RECENT RECORDS */}
      {/* ============================================================== */}
      {showRecordsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-lg shadow-2xl text-xs space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-700" />
                <span>{isTa ? 'முந்தைய பயிர்ச்சேத சான்றாவணங்கள்' : 'Previous Incident Records'}</span>
              </h3>
              <button onClick={() => setShowRecordsModal(false)}>
                <XCircle className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {claimsList.map((claim, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{claim.incident_code || 'RPD-2026-VAL-A03284'}</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {isTa ? claim.crop_damaged_tamil || claim.crop_damaged : claim.crop_damaged} • {isTa ? claim.wildlife_species_tamil || claim.wildlife_species : claim.wildlife_species}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(claim.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <a
                    href={`/api/v1/dossier/${claim.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-[#0066CC] hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1 text-[11px]"
                  >
                    <Download className="w-3 h-3" />
                    <span>PDF</span>
                  </a>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowRecordsModal(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
            >
              {isTa ? 'மூடு' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 7: HELP & INSTRUCTIONS */}
      {/* ============================================================== */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#0066CC]" />
                <span>{isTa ? 'விவசாயிகளுக்கான உதவி வழிகாட்டி' : 'Farmer Guide & Instructions'}</span>
              </h3>
              <button onClick={() => setShowHelpModal(false)}>
                <XCircle className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="space-y-2 text-slate-600 leading-relaxed">
              <p>
                <b>1. {isTa ? 'குரல் பதிவு:' : 'Voice Recording:'}</b>{' '}
                {isTa
                  ? 'நீல நிற மைக் பட்டனை அழுத்தி சேதமடைந்த பயிர் மற்றும் வனவிலங்கு பற்றிய விவரங்களை தமிழில் பேசவும்.'
                  : 'Tap the blue mic button and describe the wildlife damage in Tamil or English.'}
              </p>
              <p>
                <b>2. {isTa ? 'புகைப்படம் & GPS:' : 'Photo & GPS:'}</b>{' '}
                {isTa
                  ? 'பயிர்ச்சேத இடத்திலேயே கேமராவை இயக்கி புகைப்படம் எடுக்கவும். GPS இருப்பிடம் தானாக சேர்க்கப்படும்.'
                  : 'Capture field photos directly with device GPS coordinates attached.'}
              </p>
              <p>
                <b>3. {isTa ? 'சான்றாவணம் (Dossier):' : 'Evidence Dossier:'}</b>{' '}
                {isTa
                  ? 'அனைத்து விவரங்களையும் சரிபார்த்து உடனே அதிகாரப்பூர்வ PDF சான்றாவணத்தை பதிவிறக்கம் செய்யலாம்.'
                  : 'Generate a structured PDF report ready for forest department inspection.'}
              </p>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
            >
              {isTa ? 'புரிந்தது' : 'Understood'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
