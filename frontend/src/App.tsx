import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  User,
  Settings,
  HelpCircle,
  Mic,
  Camera,
  Upload,
  RefreshCw,
  Check,
  CheckCircle2,
  AlertTriangle,
  Download,
  Share2,
  MapPin,
  XCircle,
  Save,
  Volume2,
  Activity,
  ShieldCheck,
  Eye,
  Bell,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  ExternalLink,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  PhoneCall,
  IndianRupee,
  Printer,
  Coins,
  ChevronRight
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

type Language = 'ta' | 'en';
type ActiveTab = 'dashboard' | 'new_report' | 'my_reports' | 'compensation' | 'contacts' | 'profile' | 'settings' | 'help' | 'landing';
type WizardStep = 1 | 2 | 3 | 4; // 1: Voice, 2: Evidence, 3: Review, 4: Dossier

interface FarmerProfile {
  name: string;
  farmerId: string;
  phone: string;
  village: string;
  taluk: string;
  district: string;
  pattaNumber: string;
  surveyNumber: string;
  acres: number;
}

const DEFAULT_PROFILE: FarmerProfile = {
  name: "Tamilselvan S",
  farmerId: "F-0427",
  phone: "+91 98765 43210",
  village: "Valparai",
  taluk: "Pollachi",
  district: "Coimbatore",
  pattaNumber: "1042",
  surveyNumber: "84/2A",
  acres: 2.5
};

export function App() {
  const [language, setLanguage] = useState<Language>('ta');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  // System & Connection State
  const [systemHealth, setSystemHealth] = useState<{ status: string; voice_provider: string } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [diagData, setDiagData] = useState<any>(null);
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);

  // Settings Toggles
  const [voiceResponseEnabled, setVoiceResponseEnabled] = useState(true);
  const [autoSaveDraft, setAutoSaveDraft] = useState(true);
  const [offlineMode, setOfflineMode] = useState(true);

  // Farmer Profile
  const [profile, setProfile] = useState<FarmerProfile>(() => {
    const saved = localStorage.getItem('raidproof_farmer_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_PROFILE;
  });
  const [tempProfile, setTempProfile] = useState<FarmerProfile>(profile);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Voice & Speech
  const { isRecording, volume, startRecording, stopRecording } = useAudioRecorder();
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>(
    "என் வயலில் யானை வந்து, சோளப் பயிரை சேதப்படுத்தி விட்டது. இது நேற்று இரவு நடந்தது."
  );
  const [extractedData, setExtractedData] = useState<any>({
    wildlife_species: "ELEPHANT",
    wildlife_species_tamil: "காட்டு யானை",
    crop_damaged: "MAIZE",
    crop_damaged_tamil: "சோளம்",
    damage_quantity: 15,
    damage_unit: "TREES",
    damage_unit_tamil: "மரங்கள்/செடிகள்",
    incident_time: "நேற்று இரவு (Yesterday Night)",
    damage_type: "பயிர்ச்சேதம் (Crop damage)"
  });
  const [contradictions, setContradictions] = useState<any[]>([]);
  const [spokenAudioUrl, setSpokenAudioUrl] = useState<string>("");

  // Location & Map
  const [mapCoords, setMapCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    source: 'consent_device_gps' | 'farmer_map_pin';
  }>({
    latitude: 11.1276,
    longitude: 78.1589,
    accuracy: 5.0,
    source: 'consent_device_gps'
  });

  // Evidence Photos
  const camera = useCameraGPS();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [evidencePhotos, setEvidencePhotos] = useState<Array<{ url: string; blob?: Blob }>>([
    { url: fieldImg }
  ]);

  // Review & Confirmation
  const [confirmCertified, setConfirmCertified] = useState(true);

  // Dossier & Claims
  const [createdIncidentCode, setCreatedIncidentCode] = useState<string>("RP-2026-0003");
  const [dossierPdfUrl, setDossierPdfUrl] = useState<string>("/api/v1/dossier/sample/pdf");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimsList, setClaimsList] = useState<any[]>([
    {
      id: "sample-1",
      incident_code: "RP-2026-0003",
      reported_animal: "Elephant",
      reported_animal_tamil: "காட்டு யானை",
      crop: "Maize (சோளம்)",
      created_at: "09 Nov 2026",
      status: "Completed"
    },
    {
      id: "sample-2",
      incident_code: "RP-2026-0002",
      reported_animal: "Wild Boar",
      reported_animal_tamil: "காட்டுப்பன்றி",
      crop: "Groundnut (நிலக்கடலை)",
      created_at: "08 Nov 2026",
      status: "Under Review"
    },
    {
      id: "sample-3",
      incident_code: "RP-2026-0001",
      reported_animal: "Elephant",
      reported_animal_tamil: "காட்டு யானை",
      crop: "Banana (வாழை)",
      created_at: "28 Oct 2026",
      status: "Completed"
    }
  ]);
  const [reportsFilter, setReportsFilter] = useState<'ALL' | 'UNDER_REVIEW' | 'COMPLETED'>('ALL');

  // Compensation Norms & Calculator State
  const [calcCrop, setCalcCrop] = useState<'banana' | 'paddy' | 'maize' | 'coconut' | 'sugarcane'>('banana');
  const [calcQty, setCalcQty] = useState<number>(15);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => res.json())
      .then((data) => setSystemHealth(data))
      .catch(() => {});

    fetch('/api/v1/incidents/list')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map((d: any) => ({
            id: d.id,
            incident_code: d.incident_code || "RP-2026-0003",
            reported_animal: d.wildlife_species || "Elephant",
            reported_animal_tamil: d.wildlife_species_tamil || "காட்டு யானை",
            crop: d.crop_damaged_tamil ? `${d.crop_damaged} (${d.crop_damaged_tamil})` : (d.crop_damaged || "Maize"),
            created_at: new Date(d.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            status: "Completed"
          }));
          setClaimsList(formatted);
          if (data[0].id) {
            setDossierPdfUrl(`/api/v1/dossier/${data[0].id}/pdf`);
            setCreatedIncidentCode(data[0].incident_code || 'RP-2026-0003');
          }
        }
      })
      .catch(() => {});
  }, []);

  const isRealGnani = systemHealth?.voice_provider === 'gnani_prisma_timbre';
  const isTa = language === 'ta';

  // Run diagnostics
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

  // 1-Click Scenario selection
  const handleScenarioClick = async (scenarioText: string, animal: string, animalTa: string, crop: string, cropTa: string, qty: number, photoUrl: string) => {
    setTranscript(scenarioText);
    setEvidencePhotos([{ url: photoUrl }]);
    setExtractedData({
      wildlife_species: animal,
      wildlife_species_tamil: animalTa,
      crop_damaged: crop,
      crop_damaged_tamil: cropTa,
      damage_quantity: qty,
      damage_unit: "TREES",
      damage_unit_tamil: "செடிகள்/மரங்கள்",
      incident_time: "நேற்று இரவு (Yesterday Night)",
      damage_type: "பயிர்ச்சேதம் (Crop damage)"
    });

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

  // Push to talk toggle
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

  // File upload from gallery
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setEvidencePhotos(prev => [...prev, { url, blob: file }]);
      };
      reader.readAsDataURL(file);
    }
  };

  // Live camera capture
  const handleCapturePhoto = async () => {
    const photo = await camera.capturePhoto();
    if (photo) {
      setEvidencePhotos(prev => [...prev, { url: photo.dataUrl, blob: photo.blob }]);
      if (camera.gps.isLocked) {
        setMapCoords({
          latitude: camera.gps.latitude,
          longitude: camera.gps.longitude,
          accuracy: camera.gps.accuracy,
          source: 'consent_device_gps'
        });
      }
    }
  };

  // Remove a photo
  const handleRemovePhoto = (index: number) => {
    setEvidencePhotos(prev => prev.filter((_, idx) => idx !== index));
  };

  // Generate Evidence Dossier (Final Submission)
  const handleGenerateEvidenceDossier = async () => {
    setIsSubmitting(true);
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
      checklist: { patta: true, adangal: true, bank: true, aadhaar: true, witness: false },
      wildlife_species: extractedData?.wildlife_species || 'ELEPHANT',
      wildlife_species_tamil: extractedData?.wildlife_species_tamil || 'காட்டு யானை',
      crop_damaged: extractedData?.crop_damaged || 'MAIZE',
      crop_damaged_tamil: extractedData?.crop_damaged_tamil || 'சோளம்',
      damage_quantity: extractedData?.damage_quantity || 15,
      damage_unit: extractedData?.damage_unit || 'TREES',
      damage_unit_tamil: extractedData?.damage_unit_tamil || 'செடிகள்',
      raw_voice_transcript: transcript || 'என் வயலில் யானை வந்து, சோளப் பயிரை சேதப்படுத்தி விட்டது.'
    };

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
      // offlineDb fallback
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
        const code = result.incident_code || "RP-2026-0003";
        setCreatedIncidentCode(code);

        // Upload evidence photos (converting any URL to Blob if blob is not set)
        for (let idx = 0; idx < Math.min(evidencePhotos.length, 2); idx++) {
          const p = evidencePhotos[idx];
          let blob = p.blob;
          if (!blob && p.url) {
            try {
              const resBlob = await fetch(p.url);
              blob = await resBlob.blob();
            } catch (e) {
              console.warn('Could not fetch photo blob', e);
            }
          }
          if (blob) {
            const form = new FormData();
            form.append('photo_file', blob, `evidence_${idx + 1}.jpg`);
            form.append('incident_id', incidentId);
            form.append('photo_type', idx === 0 ? 'WIDE_ANGLE' : 'CLOSE_UP_SPOOR');
            form.append('latitude', String(mapCoords.latitude));
            form.append('longitude', String(mapCoords.longitude));
            form.append('accuracy', String(mapCoords.accuracy));
            await fetch('/api/v1/evidence/upload', { method: 'POST', body: form }).catch(console.warn);
          }
        }

        setDossierPdfUrl(`/api/v1/dossier/${incidentId}/pdf`);
        setWizardStep(4);

        // Add to claimsList
        setClaimsList(prev => [
          {
            id: incidentId,
            incident_code: code,
            reported_animal: payload.wildlife_species,
            reported_animal_tamil: payload.wildlife_species_tamil,
            crop: `${payload.crop_damaged} (${payload.crop_damaged_tamil})`,
            created_at: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            status: "Completed"
          },
          ...prev
        ]);
      } else {
        setDossierPdfUrl('/api/v1/dossier/sample/pdf');
        setWizardStep(4);
      }
    } catch {
      setDossierPdfUrl('/api/v1/dossier/sample/pdf');
      setWizardStep(4);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F6] text-slate-900 font-sans flex flex-col">
      {/* ============================================================== */}
      {/* 1. TOP HEADER (Clean Emerald Green Header matching design) */}
      {/* ============================================================== */}
      <header className="w-full bg-[#055B38] text-white px-4 md:px-8 py-3 shadow-sm flex items-center justify-between sticky top-0 z-30">
        {/* Brand Shield & Logo */}
        <div
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">
              RaidProof AI
            </h1>
          </div>
        </div>

        {/* Center Links (on landing) or Status Pill */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 text-xs font-semibold text-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{isRealGnani ? (isTa ? 'ஞானி AI இணைப்பு தயார்' : 'Prisma & Timbre Online') : (isTa ? 'அனைத்து சேவைகளும் தயார்' : 'All Systems Online')}</span>
          </div>
        </div>

        {/* Right Actions: Language Switch, Bell, Profile */}
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <div className="flex items-center bg-black/25 p-0.5 rounded-full border border-white/20 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLanguage('ta')}
              className={`px-3 py-1 rounded-full transition-all ${
                language === 'ta' ? 'bg-white text-emerald-900 shadow-xs' : 'text-emerald-100 hover:text-white'
              }`}
            >
              தமிழ்
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 rounded-full transition-all ${
                language === 'en' ? 'bg-white text-emerald-900 shadow-xs' : 'text-emerald-100 hover:text-white'
              }`}
            >
              English
            </button>
          </div>

          {/* Diagnostics Ping */}
          <button
            type="button"
            onClick={() => {
              setShowDiagnostics(true);
              handleRunDiagnostics();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition hidden sm:flex"
            title="System Diagnostics"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Mobile Access */}
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
            title="Mobile Link"
          >
            <Smartphone className="w-4 h-4" />
          </button>

          {/* Notification Bell */}
          <button
            type="button"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition relative"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full" />
          </button>

          {/* Farmer Profile Avatar */}
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="hidden sm:inline">{profile.name}</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. MAIN LAYOUT (Left Sidebar + Content Workspace) */}
      {/* ============================================================== */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-3 md:p-6 gap-6">
        {/* Left Navigation Sidebar */}
        <aside className="w-52 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col p-3 gap-1 shrink-0 hidden md:flex">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left ${
              activeTab === 'dashboard'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{isTa ? 'முகப்பு பலகை' : 'Dashboard'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('new_report');
              setWizardStep(1);
            }}
            className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left ${
              activeTab === 'new_report'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isTa ? 'புதிய அறிக்கை' : 'New Report'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my_reports')}
            className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left ${
              activeTab === 'my_reports'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{isTa ? 'எனது அறிக்கைகள்' : 'My Reports'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compensation')}
            className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left ${
              activeTab === 'compensation'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <IndianRupee className="w-4 h-4" />
            <span>{isTa ? 'நிவாரண அட்டவணை' : 'Relief Norms'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left ${
              activeTab === 'contacts'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            <span>{isTa ? 'அவசர தொடர்புகள்' : 'Forest Helplines'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left ${
              activeTab === 'profile'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>{isTa ? 'விவசாயி விவரம்' : 'Profile'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left ${
              activeTab === 'settings'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>{isTa ? 'அமைப்புகள்' : 'Settings'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('help')}
            className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition text-left ${
              activeTab === 'help'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>{isTa ? 'உதவி & வழிகாட்டி' : 'Help'}</span>
          </button>

          {/* Quick Map Button */}
          <button
            type="button"
            onClick={() => setShowMapModal(true)}
            className="w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition text-left mt-auto"
          >
            <MapPin className="w-4 h-4" />
            <span>{isTa ? 'கள வரைபடம்' : 'Location Map'}</span>
          </button>
        </aside>

        {/* Center Main Workspace */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* ============================================================== */}
          {/* SCREEN 1: LANDING PAGE (Optional view from logo click) */}
          {/* ============================================================== */}
          {activeTab === 'landing' && (
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xs space-y-6">
              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-900 to-emerald-700 text-white p-6 md:p-10 flex flex-col justify-between min-h-[280px]">
                <div className="max-w-lg space-y-3 z-10">
                  <h2 className="text-2xl md:text-3xl font-extrabold leading-tight">
                    {isTa ? 'வனவிலங்கு பயிர்ச்சேத சான்றாவண உதவியாளர்' : 'Wildlife Crop Damage Evidence Assistant'}
                  </h2>
                  <p className="text-emerald-100 text-xs md:text-sm leading-relaxed">
                    {isTa
                      ? 'உங்கள் குரல். உங்கள் சான்று. உங்கள் அறிக்கை. பயிர் சேதத்தைப் பதிவு செய்யுங்கள், புகைப்படங்களை இணைத்து அரசு ஆய்வுக்குரிய சான்றாவணத்தைப் பெறுங்கள்.'
                      : 'Your Voice. Your Evidence. Your Story. Report crop damage, capture evidence, and generate an official dossier for Forest Department inspection.'}
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setActiveTab('new_report');
                        setWizardStep(1);
                      }}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
                    >
                      <span>{isTa ? 'புகார் பதிவு செய்' : 'Report an Incident'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs transition border border-white/20"
                    >
                      {isTa ? 'முகப்பு பலகை' : 'Go to Dashboard'}
                    </button>
                  </div>
                </div>

                <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-25 md:opacity-40 pointer-events-none">
                  <img src={elephantImg} alt="Elephant in field" className="w-full h-full object-cover" />
                </div>
              </div>

              {/* 4 Feature Pills matching Screen 1 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-2">
                    <Mic className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-slate-800">{isTa ? 'குரல் பதிவு' : 'Voice Reporting'}</h4>
                  <p className="text-[11px] text-slate-500">{isTa ? 'தமிழ் / English' : 'Tamil / English'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-2">
                    <Camera className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-slate-800">{isTa ? 'புகைப்பட சான்று' : 'Photo Evidence'}</h4>
                  <p className="text-[11px] text-slate-500">{isTa ? 'பயிர்ச்சேதம்' : 'Crop Damage'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-2">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-slate-800">{isTa ? 'GPS இருப்பிடம்' : 'GPS Location'}</h4>
                  <p className="text-[11px] text-slate-500">{isTa ? 'துல்லிய புள்ளி' : 'Exact Spot'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-2">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-slate-800">{isTa ? 'சான்றாவணம் (PDF)' : 'Evidence Dossier'}</h4>
                  <p className="text-[11px] text-slate-500">{isTa ? 'உடனடி பதிவிறக்கம்' : 'PDF Download'}</p>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 2: FARMER DASHBOARD (Matching Screen 2 in picture) */}
          {/* ============================================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              {/* Live Wildlife Movement Alert Banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3.5 text-amber-950 shadow-xs">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-600 text-white uppercase tracking-wider animate-pulse">
                      {isTa ? 'நேரடி வன எச்சரிக்கை' : 'Live Wildlife Alert'}
                    </span>
                    <span className="text-xs font-bold text-amber-950">
                      {isTa ? 'வால்பாறை - ஆனைமலை புலிகள் காப்பக எல்லை (ATR)' : 'Valparai - Anamalai Tiger Reserve Buffer'}
                    </span>
                  </div>
                  <p className="text-xs text-amber-900/90 mt-1.5 leading-relaxed">
                    {isTa
                      ? 'வனத்துறை ரோந்துப்படை தகவல்: 4 காட்டு யானைகள் கூட்டம் வால்பாறை தேயிலை மற்றும் சோளப் பயிர் எல்லைப் பகுதியில் நடமாடுகிறது. விவசாயிகள் மாலை 6 மணிக்குப் பின் தனியாக களத்திற்கு செல்ல வேண்டாம். வனத்துறை அவசர உதவி எண்: 1926 அல்லது 04259 235385.'
                      : 'Forest Patrol Advisory: A herd of 4 wild elephants is active near the Valparai tea and maize crop boundary. Cultivators are advised to exercise caution after dusk. Helpline: 1926 or 04259 235385.'}
                  </p>
                </div>
              </div>

              {/* Welcome Header */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {isTa ? `வணக்கம், ${profile.name} 👋` : `Welcome, ${profile.name} 👋`}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isTa ? 'பயிர்ச்சேதத்தைப் பதிவு செய்து உடனே சான்றாவணம் உருவாக்குங்கள்.' : 'Report crop damage and create evidence easily.'}
                  </p>
                </div>
              </div>

              {/* 3 Stat Cards */}
              <div className="grid grid-cols-3 gap-3.5">
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xl font-extrabold text-emerald-950 block leading-tight">{claimsList.length}</span>
                    <span className="text-[11px] font-semibold text-emerald-800">{isTa ? 'மொத்த அறிக்கைகள்' : 'Total Reports'}</span>
                  </div>
                </div>

                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xl font-extrabold text-amber-950 block leading-tight">1</span>
                    <span className="text-[11px] font-semibold text-amber-800">{isTa ? 'ஆய்வில் உள்ளவை' : 'Under Review'}</span>
                  </div>
                </div>

                <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xl font-extrabold text-blue-950 block leading-tight">2</span>
                    <span className="text-[11px] font-semibold text-blue-800">{isTa ? 'முடிவுற்றவை' : 'Completed'}</span>
                  </div>
                </div>
              </div>

              {/* 2 Quick Access Feature Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div
                  onClick={() => setActiveTab('compensation')}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-emerald-300 hover:shadow-sm cursor-pointer transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        {isTa ? 'அரசு நிவாரண விகிதங்கள் (G.O. 42)' : 'TN Relief Norms & Calculator'}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isTa ? 'பயிர் வாரியாக உத்தேச இழப்பீட்டைக் கணக்கிட' : 'Estimate government compensation per crop'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>

                <div
                  onClick={() => setActiveTab('contacts')}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-emerald-300 hover:shadow-sm cursor-pointer transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">
                        {isTa ? 'வனத்துறை அவசர எண்கள் (1926)' : 'Forest Emergency Helplines (1926)'}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isTa ? 'பறக்கும் படை மற்றும் வனச்சரக அலுவலகங்கள்' : 'Range offices & rapid response teams'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Big Action Card: Start a New Incident Report */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-1">
                    <Mic className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isTa ? 'புதிய சம்பவ அறிக்கை தொடங்குக' : 'Start a New Incident Report'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    {isTa
                      ? 'பயிர்ச்சேதம் குறித்து தமிழில் அல்லது ஆங்கிலத்தில் பேசி சில நிமிடங்களில் அறிக்கையை முடிக்கவும்.'
                      : 'Speak about the crop damage in Tamil or English and generate your PDF report in minutes.'}
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setActiveTab('new_report');
                        setWizardStep(1);
                      }}
                      className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>{isTa ? '+ புதிய அறிக்கை தொடங்கு' : '+ Report New Incident'}</span>
                    </button>
                  </div>
                </div>

                <div className="w-44 h-32 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                  <img src={fieldImg} alt="Crops" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREENS 3, 4, 5, 6, 7: THE 4-STEP WIZARD (Clean & Neat) */}
          {/* ============================================================== */}
          {activeTab === 'new_report' && (
            <div className="space-y-4">
              {/* Top Stepper Bar (4 Steps matching Screens 3-7 in proposed diagram) */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div className="flex items-center justify-between w-full max-w-2xl mx-auto px-2">
                  {/* Step 1: Voice */}
                  <div
                    onClick={() => setWizardStep(1)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      wizardStep === 1
                        ? 'bg-emerald-700 text-white ring-4 ring-emerald-100'
                        : wizardStep > 1
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {wizardStep > 1 ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
                    </div>
                    <span className={`text-xs font-bold ${wizardStep === 1 ? 'text-emerald-800' : 'text-slate-600'}`}>
                      {isTa ? 'குரல்' : 'Voice'}
                    </span>
                  </div>

                  <div className={`flex-1 h-0.5 mx-3 ${wizardStep >= 2 ? 'bg-emerald-600' : 'bg-slate-200'}`} />

                  {/* Step 2: Evidence */}
                  <div
                    onClick={() => setWizardStep(2)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      wizardStep === 2
                        ? 'bg-emerald-700 text-white ring-4 ring-emerald-100'
                        : wizardStep > 2
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {wizardStep > 2 ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
                    </div>
                    <span className={`text-xs font-bold ${wizardStep === 2 ? 'text-emerald-800' : 'text-slate-600'}`}>
                      {isTa ? 'சான்றுகள்' : 'Evidence'}
                    </span>
                  </div>

                  <div className={`flex-1 h-0.5 mx-3 ${wizardStep >= 3 ? 'bg-emerald-600' : 'bg-slate-200'}`} />

                  {/* Step 3: Review */}
                  <div
                    onClick={() => setWizardStep(3)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      wizardStep === 3
                        ? 'bg-emerald-700 text-white ring-4 ring-emerald-100'
                        : wizardStep > 3
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {wizardStep > 3 ? <Check className="w-4 h-4 stroke-[3]" /> : '3'}
                    </div>
                    <span className={`text-xs font-bold ${wizardStep === 3 ? 'text-emerald-800' : 'text-slate-600'}`}>
                      {isTa ? 'சரிபார்ப்பு' : 'Review'}
                    </span>
                  </div>

                  <div className={`flex-1 h-0.5 mx-3 ${wizardStep >= 4 ? 'bg-emerald-600' : 'bg-slate-200'}`} />

                  {/* Step 4: Dossier */}
                  <div
                    onClick={() => setWizardStep(4)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      wizardStep === 4
                        ? 'bg-emerald-700 text-white ring-4 ring-emerald-100'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      4
                    </div>
                    <span className={`text-xs font-bold ${wizardStep === 4 ? 'text-emerald-800' : 'text-slate-600'}`}>
                      {isTa ? 'சான்றாவணம்' : 'Dossier'}
                    </span>
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------------- */}
              {/* STEP 1: VOICE REPORTING & AI EXTRACTION (Screens 3 & 4) */}
              {/* -------------------------------------------------------- */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  {/* Upper Section: Big Mic & Speak (Screen 3) */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center space-y-4">
                    <h3 className="text-base font-bold text-slate-900">
                      {isTa ? 'பயிர்ச்சேதத்தைப் பதிவு செய்க' : 'Report Crop Damage'}
                    </h3>

                    {/* Language selector in card */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-full border text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setLanguage('ta')}
                        className={`px-4 py-1 rounded-full transition ${language === 'ta' ? 'bg-emerald-700 text-white' : 'text-slate-600'}`}
                      >
                        தமிழ்
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage('en')}
                        className={`px-4 py-1 rounded-full transition ${language === 'en' ? 'bg-emerald-700 text-white' : 'text-slate-600'}`}
                      >
                        English
                      </button>
                    </div>

                    {/* Big Mic Button with Waveform */}
                    <div className="relative my-2 flex items-center justify-center">
                      <div className="w-28 h-28 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={handleMicToggle}
                          disabled={isProcessingVoice}
                          className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition cursor-pointer ${
                            isRecording
                              ? 'bg-amber-600 animate-pulse ring-4 ring-amber-300'
                              : 'bg-emerald-700 hover:bg-emerald-800'
                          }`}
                        >
                          <Mic className="w-7 h-7" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="font-bold text-sm text-slate-800">
                        {isRecording ? (isTa ? 'கேட்கிறேன்... பேசி முடிக்க மீண்டும் தட்டவும்' : 'Listening... Tap to stop') : (isTa ? 'மைக்ரோஃபோனை அழுத்திப் பேசவும்' : 'Tap the microphone and speak')}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isTa ? 'மைக்ரோஃபோனை அழுத்தி, விவசாயச் சேதம் பற்றிப் பேசுங்கள்' : 'Speak clearly about what wildlife entered and what crop was damaged'}
                      </p>
                    </div>

                    {isRecording && (
                      <div className="w-full max-w-sm pt-2">
                        <AudioWaveform volume={volume} isRecording={isRecording} />
                      </div>
                    )}

                    {/* Example Prompt Box matching Screen 3 */}
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 max-w-md flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>
                        {isTa
                          ? 'எடுத்துக்காட்டு: "என் வயலில் யானை வந்து, சோளப் பயிரை சேதப்படுத்தி விட்டது."'
                          : 'Example: "Elephant entered my field and damaged the maize crop."'}
                      </span>
                    </div>

                    {/* Error Alert Banner if Voice Processing Fails */}
                    {voiceError && (
                      <div className="w-full max-w-md p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 text-left">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{voiceError}</span>
                      </div>
                    )}

                    {/* Neutral Clarification Prompt if Contradictions / Ambiguity */}
                    {contradictions.length > 0 && (
                      <div className="w-full max-w-md p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 text-left">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block mb-0.5">{isTa ? 'விளக்கக் குறிப்பு:' : 'Clarification Note:'}</span>
                          {contradictions.map((c, i) => (
                            <p key={i} className="text-amber-800">{c.clarification_question || c.message}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3 Quick 1-Click Simulation Buttons */}
                    <div className="pt-2 border-t border-slate-100 w-full max-w-lg">
                      <span className="text-[11px] font-semibold text-slate-500 block mb-2">
                        {isTa ? 'அல்லது மாதிரி சூழலைத் தேர்ந்தெடுக்கவும் (1-Click Test):' : 'Or select a quick realistic scenario:'}
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleScenarioClick(
                              'என் வயலில் யானை வந்து, சோளப் பயிரை சேதப்படுத்தி விட்டது. இது நேற்று இரவு நடந்தது.',
                              'ELEPHANT',
                              'காட்டு யானை',
                              'MAIZE',
                              'சோளம்',
                              15,
                              elephantImg
                            )
                          }
                          className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-center transition"
                        >
                          <span className="font-bold text-xs block text-slate-800">{isTa ? 'யானை' : 'Elephant'}</span>
                          <span className="text-[10px] text-slate-500">{isTa ? 'சோளம்' : 'Maize'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleScenarioClick(
                              'பொள்ளாச்சி தோட்டத்தில் முந்தாநாள் இரவு 6 காட்டுப்பன்றிகள் வந்து அரை ஏக்கர் நிலக்கடலை பயிரை நாசம் செய்தது.',
                              'WILD_BOAR',
                              'காட்டுப்பன்றி',
                              'GROUNDNUT',
                              'நிலக்கடலை',
                              6,
                              boarImg
                            )
                          }
                          className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-center transition"
                        >
                          <span className="font-bold text-xs block text-slate-800">{isTa ? 'காட்டுப்பன்றி' : 'Wild Boar'}</span>
                          <span className="text-[10px] text-slate-500">{isTa ? 'நிலக்கடலை' : 'Groundnut'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleScenarioClick(
                              'நீலகிரி மலையடிவாரத்தில் காட்டெருமை கூட்டம் வந்து 25 தேயிலை செடிகளை முட்டி உடைத்துவிட்டது.',
                              'GAUR',
                              'காட்டெருமை',
                              'TEA',
                              'தேயிலை',
                              25,
                              gaurImg
                            )
                          }
                          className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-center transition"
                        >
                          <span className="font-bold text-xs block text-slate-800">{isTa ? 'காட்டெருமை' : 'Gaur'}</span>
                          <span className="text-[10px] text-slate-500">{isTa ? 'தேயிலை' : 'Tea'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Lower Section: Transcription & AI Extraction (Screen 4) */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Volume2 className="w-5 h-5 text-emerald-700" />
                      <h3 className="font-bold text-sm text-slate-900">
                        {isTa ? 'குரல் பதிவு & தானியங்கி விவரங்கள் (Voice & AI Extraction)' : 'Voice Transcription & AI Extraction'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Your Spoken Report */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 flex flex-col justify-between">
                        <div>
                          <span className="font-bold text-xs text-slate-700 block">
                            {isTa ? 'உங்கள் குரல் வாக்குமூலம் (Transcription):' : 'Your Spoken Report (Transcription):'}
                          </span>
                          <p className="text-xs italic text-slate-800 mt-2 leading-relaxed bg-white p-3 rounded-lg border">
                            "{transcript}"
                          </p>
                        </div>

                        {spokenAudioUrl && (
                          <SpokenAudioPlayer
                            audioUrl={spokenAudioUrl}
                            autoPlay={true}
                            label={isTa ? 'ஞானி டிம்ப்ரே குரல் பதில்' : 'Timbre Voice Response'}
                          />
                        )}

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => handleMicToggle()}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{isTa ? 'மீண்டும் பேச (Re-record)' : 'Re-record'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Right: AI Extracted Details Table */}
                      <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-200/80 space-y-2">
                        <span className="font-bold text-xs text-emerald-950 block">
                          {isTa ? 'தானியங்கி விவரங்கள் (AI Extracted Details):' : 'AI Extracted Details:'}
                        </span>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between py-1.5 border-b border-emerald-100">
                            <span className="text-slate-500">{isTa ? 'வனவிலங்கு:' : 'Reported Animal:'}</span>
                            <span className="font-bold text-slate-900">
                              {isTa ? extractedData?.wildlife_species_tamil || 'காட்டு யானை' : extractedData?.wildlife_species || 'Elephant'}
                            </span>
                          </div>

                          <div className="flex justify-between py-1.5 border-b border-emerald-100">
                            <span className="text-slate-500">{isTa ? 'பயிர் வகை:' : 'Crop Type:'}</span>
                            <span className="font-bold text-slate-900">
                              {extractedData?.crop_damaged} ({isTa ? extractedData?.crop_damaged_tamil : 'சோளம்'})
                            </span>
                          </div>

                          <div className="flex justify-between py-1.5 border-b border-emerald-100">
                            <span className="text-slate-500">{isTa ? 'சேத அளவு:' : 'Damage Quantity:'}</span>
                            <span className="font-bold text-slate-900">
                              {extractedData?.damage_quantity || 15} {isTa ? extractedData?.damage_unit_tamil || 'செடிகள்' : 'plants/trees'}
                            </span>
                          </div>

                          <div className="flex justify-between py-1.5 border-b border-emerald-100">
                            <span className="text-slate-500">{isTa ? 'சம்பவ நேரம்:' : 'Incident Time:'}</span>
                            <span className="font-bold text-slate-900">{extractedData?.incident_time || 'Yesterday, Night'}</span>
                          </div>

                          <div className="flex justify-between py-1.5">
                            <span className="text-slate-500">{isTa ? 'சேத வகை:' : 'Damage Type:'}</span>
                            <span className="font-bold text-slate-900">{extractedData?.damage_type || 'Crop damage'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Forward button */}
                    <div className="flex justify-end pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setWizardStep(2)}
                        className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition"
                      >
                        <span>{isTa ? 'சான்றுகள் இணைக்க தொடர்' : 'Continue to Evidence'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------- */}
              {/* STEP 2: ADD EVIDENCE (PHOTOS & LOCATION) (Screen 5) */}
              {/* -------------------------------------------------------- */}
              {wizardStep === 2 && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
                  <div className="pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-base text-slate-900">
                      {isTa ? 'சான்றுகளை இணைக்க (Add Evidence)' : 'Add Evidence'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isTa
                        ? 'பயிர்ச்சேத புகைப்படங்களை பதிவேற்றி, GPS இருப்பிடத்தைப் பதிவு செய்யவும்.'
                        : 'Upload photos of the crop damage and capture location.'}
                    </p>
                  </div>

                  {/* Upload Actions & Thumbnails */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      <button
                        type="button"
                        onClick={handleCapturePhoto}
                        className="p-4 rounded-xl border border-dashed border-slate-300 hover:border-emerald-600 hover:bg-emerald-50/40 text-center flex flex-col items-center justify-center gap-2 transition"
                      >
                        <Camera className="w-6 h-6 text-emerald-700" />
                        <span className="font-bold text-xs text-slate-800">
                          {isTa ? 'கேமரா மூலம் படம் எடு' : 'Capture Photo'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-4 rounded-xl border border-dashed border-slate-300 hover:border-emerald-600 hover:bg-emerald-50/40 text-center flex flex-col items-center justify-center gap-2 transition"
                      >
                        <Upload className="w-6 h-6 text-emerald-700" />
                        <span className="font-bold text-xs text-slate-800">
                          {isTa ? 'கேலரியில் இருந்து பதிவேற்று' : 'Upload from Gallery'}
                        </span>
                      </button>
                    </div>

                    {/* Photo Thumbnails */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      {evidencePhotos.map((photo, idx) => (
                        <div key={idx} className="relative w-36 h-28 rounded-xl overflow-hidden border border-slate-300 shadow-xs group">
                          <img src={photo.url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-red-600 transition"
                            title="Remove photo"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[9px] text-white font-mono">
                            Photo {idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Location (GPS) Box matching Screen 5 */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">
                          {isTa ? 'இருப்பிடம் (GPS Coordinates):' : 'Location (GPS)'}
                        </span>
                        <span className="font-mono text-xs text-slate-700">
                          Lat: {mapCoords.latitude.toFixed(4)}° N, Long: {mapCoords.longitude.toFixed(4)}° E (Accuracy: ±{mapCoords.accuracy} m)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowMapModal(true)}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto shrink-0"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{isTa ? 'இருப்பிடத்தை பதிவு செய்' : 'Capture Location'}</span>
                    </button>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{isTa ? 'பின்செல்' : 'Back'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWizardStep(3)}
                      className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition"
                    >
                      <span>{isTa ? 'சரிபார்ப்புக்கு தொடர்' : 'Continue to Review'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------- */}
              {/* STEP 3: REVIEW & CONFIRM (Screen 6) */}
              {/* -------------------------------------------------------- */}
              {wizardStep === 3 && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
                  <div className="pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-base text-slate-900">
                      {isTa ? 'சம்பவ விவரங்களை சரிபார்க்கவும் (Review Incident Details)' : 'Review Incident Details'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isTa
                        ? 'சான்றாவணம் உருவாக்கும் முன் தகவல்களை சரிபார்த்து உறுதிப்படுத்தவும்.'
                        : 'Please check and confirm the information before generating the dossier.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left: Table of Details */}
                    <div className="lg:col-span-8 space-y-2 text-xs">
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">{isTa ? 'பாதிக்கப்பட்ட வனவிலங்கு:' : 'Reported Animal'}</span>
                        <span className="font-bold text-slate-900">
                          {extractedData?.wildlife_species} ({isTa ? extractedData?.wildlife_species_tamil : 'யானை'})
                        </span>
                      </div>

                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">{isTa ? 'பயிர் வகை:' : 'Crop Type'}</span>
                        <span className="font-bold text-slate-900">
                          {extractedData?.crop_damaged} / {isTa ? extractedData?.crop_damaged_tamil : 'சோளம்'}
                        </span>
                      </div>

                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">{isTa ? 'சம்பவ நாள் & நேரம்:' : 'Incident Date & Time'}</span>
                        <span className="font-bold text-slate-900">09 Nov 2026, 10:30 PM</span>
                      </div>

                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">{isTa ? 'GPS இருப்பிடம்:' : 'Location'}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {mapCoords.latitude.toFixed(4)}° N, {mapCoords.longitude.toFixed(4)}° E
                        </span>
                      </div>

                      <div className="py-2 border-b border-slate-100">
                        <span className="text-slate-500 font-medium block mb-1">{isTa ? 'விளக்கம்:' : 'Description'}</span>
                        <p className="italic text-slate-800 bg-slate-50 p-2.5 rounded-lg border leading-relaxed">
                          "{transcript}"
                        </p>
                      </div>
                    </div>

                    {/* Right: Photos Thumbnails */}
                    <div className="lg:col-span-4 space-y-2">
                      <span className="font-bold text-xs text-slate-700 block">
                        {isTa ? `இணைக்கப்பட்ட படங்கள் (${evidencePhotos.length}):` : `Evidence Photos (${evidencePhotos.length})`}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {evidencePhotos.map((p, idx) => (
                          <div key={idx} className="h-24 rounded-lg overflow-hidden border">
                            <img src={p.url} alt="Evidence" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Confirmation Checkbox */}
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/90 rounded-xl">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmCertified}
                        onChange={(e) => setConfirmCertified(e.target.checked)}
                        className="rounded text-emerald-700 w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-emerald-950">
                        {isTa
                          ? 'மேற்கண்ட தகவல்கள் அனைத்தும் எனது உண்மை அறிவுக்கு உட்பட்டு சரியானவை என உறுதி கூறுகிறேன்.'
                          : 'I confirm that the above information is true to the best of my knowledge.'}
                      </span>
                    </label>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setWizardStep(2)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{isTa ? 'பின்செல்' : 'Back'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateEvidenceDossier}
                      disabled={!confirmCertified || isSubmitting}
                      className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{isTa ? 'தயாராகிறது...' : 'Generating...'}</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>{isTa ? 'சான்றாவணம் உருவாக்க (Generate Dossier)' : 'Generate Evidence Dossier'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------- */}
              {/* STEP 4: EVIDENCE DOSSIER (PDF PREVIEW) (Screen 7) */}
              {/* -------------------------------------------------------- */}
              {wizardStep === 4 && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
                  <div className="pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-base text-slate-900">
                      {isTa ? 'சான்றாவணம் முன்னோட்டம் (Evidence Dossier PDF Preview)' : 'Evidence Dossier (PDF Preview)'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left: PDF Document Viewer */}
                    <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-slate-300 shadow-sm bg-slate-800">
                      <div className="bg-[#323639] text-slate-300 px-3 py-1.5 flex items-center justify-between text-[11px] font-mono border-b border-slate-700 select-none">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-slate-500 rounded-sm"></span>
                          <span>RaidProof_AI_Dossier.pdf (1 / 1)</span>
                        </span>
                        <span className="text-slate-400">100%</span>
                        <a href={dossierPdfUrl} target="_blank" rel="noreferrer" title="Download">
                          <Download className="w-3.5 h-3.5 hover:text-white" />
                        </a>
                      </div>

                      <iframe
                        src={dossierPdfUrl}
                        title="Dossier PDF"
                        className="w-full h-[420px] bg-white"
                      />
                    </div>

                    {/* Right: Actions Card matching Screen 7 */}
                    <div className="lg:col-span-4 bg-emerald-50/50 rounded-2xl p-5 border border-emerald-200/80 space-y-4">
                      <div className="text-center space-y-1">
                        <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-xs">
                          <Check className="w-6 h-6 stroke-[3]" />
                        </div>
                        <h4 className="font-bold text-sm text-emerald-950 mt-2">
                          {isTa ? 'சான்றாவணம் தயாரானது!' : 'Dossier Generated!'}
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {isTa
                            ? 'உங்கள் பயிர்ச்சேத சான்றாவணம் வனத்துறை கள ஆய்வுக்குத் தயாராக உள்ளது.'
                            : 'Your wildlife crop damage evidence dossier is ready.'}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2">
                        <a
                          href={dossierPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition"
                        >
                          <Download className="w-4 h-4" />
                          <span>{isTa ? 'PDF பதிவிறக்கம்' : 'Download PDF'}</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            const iframe = document.querySelector('iframe[title="Dossier PDF"]') as HTMLIFrameElement;
                            if (iframe && iframe.contentWindow) {
                              iframe.contentWindow.focus();
                              iframe.contentWindow.print();
                            } else {
                              window.open(dossierPdfUrl, '_blank');
                            }
                          }}
                          className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
                        >
                          <Printer className="w-4 h-4 text-slate-700" />
                          <span>{isTa ? 'அச்சிடு (Print Dossier)' : 'Print Dossier'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const text = encodeURIComponent(
                              `வணக்கம். பயிர்ச்சேத சான்றாவணம் (Dossier ID: ${createdIncidentCode}) தயாராகியுள்ளது: http://10.230.118.81:5173`
                            );
                            window.open(`https://wa.me/?text=${text}`, '_blank');
                          }}
                          className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
                        >
                          <Share2 className="w-4 h-4 text-emerald-700" />
                          <span>{isTa ? 'பகிர (Share)' : 'Share via WhatsApp'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setWizardStep(1);
                            setActiveTab('new_report');
                          }}
                          className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>{isTa ? '+ புதிய அறிக்கை' : '+ New Report'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 8: MY REPORTS (Matching Screen 8 in diagram) */}
          {/* ============================================================== */}
          {activeTab === 'my_reports' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isTa ? 'எனது அறிக்கைகள் (My Reports)' : 'My Reports'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isTa ? 'முந்தைய பயிர்ச்சேத அறிக்கைகளைக் காணவும் பதிவிறக்கவும்.' : 'View and manage your incident reports.'}
                  </p>
                </div>

                {/* Filter Tabs matching Screen 8 */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setReportsFilter('ALL')}
                    className={`px-3 py-1 rounded-lg transition ${reportsFilter === 'ALL' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600'}`}
                  >
                    {isTa ? `அனைத்தும் (${claimsList.length})` : `All (${claimsList.length})`}
                  </button>
                  <button
                    onClick={() => setReportsFilter('UNDER_REVIEW')}
                    className={`px-3 py-1 rounded-lg transition ${reportsFilter === 'UNDER_REVIEW' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600'}`}
                  >
                    {isTa ? 'ஆய்வில் (1)' : 'Under Review (1)'}
                  </button>
                  <button
                    onClick={() => setReportsFilter('COMPLETED')}
                    className={`px-3 py-1 rounded-lg transition ${reportsFilter === 'COMPLETED' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600'}`}
                  >
                    {isTa ? 'முடிவுற்றவை (2)' : 'Completed (2)'}
                  </button>
                </div>
              </div>

              {/* Table matching Screen 8 */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">{isTa ? 'அறிக்கை எண்' : 'Incident ID'}</th>
                      <th className="py-2.5 px-3">{isTa ? 'வனவிலங்கு' : 'Reported Animal'}</th>
                      <th className="py-2.5 px-3">{isTa ? 'தேதி' : 'Date'}</th>
                      <th className="py-2.5 px-3">{isTa ? 'நிலை' : 'Status'}</th>
                      <th className="py-2.5 px-3 text-right">{isTa ? 'செயல்' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {claimsList.map((claim, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{claim.incident_code}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {isTa ? claim.reported_animal_tamil || claim.reported_animal : claim.reported_animal}
                        </td>
                        <td className="py-3 px-3 text-slate-600">{claim.created_at}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            claim.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isTa ? (claim.status === 'Completed' ? 'முடிந்தது' : 'ஆய்வில்') : claim.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <a
                            href={`/api/v1/dossier/${claim.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isTa ? 'பார்' : 'View'}</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 9: PROFILE & SETTINGS (Matching Screen 9 in diagram) */}
          {/* ============================================================== */}
          {(activeTab === 'profile' || activeTab === 'settings') && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Farmer Profile Card (Left 7 cols) */}
              <div className="md:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-base text-slate-900">
                    {isTa ? 'விவசாயி சுயவிவரம் (Farmer Profile)' : 'Farmer Profile'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                  >
                    {isEditingProfile ? (isTa ? 'மூடு' : 'Close') : (isTa ? 'திருத்து' : 'Edit Profile')}
                  </button>
                </div>

                {/* Avatar Banner */}
                <div className="flex items-center gap-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <div className="w-12 h-12 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-lg">
                    {profile.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{profile.name}</h4>
                    <span className="text-[11px] text-emerald-800 font-mono">Farmer ID: {profile.farmerId}</span>
                  </div>
                </div>

                {/* Form or Readonly View */}
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-500 block mb-0.5">
                      {isTa ? 'தொலைபேசி எண்:' : 'Phone Number:'}
                    </label>
                    {isEditingProfile ? (
                      <input
                        type="text"
                        value={tempProfile.phone}
                        onChange={(e) => setTempProfile({ ...tempProfile, phone: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg"
                      />
                    ) : (
                      <span className="font-bold text-slate-900 font-mono">{profile.phone}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-500 block mb-0.5">
                        {isTa ? 'கிராமம்:' : 'Village:'}
                      </label>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={tempProfile.village}
                          onChange={(e) => setTempProfile({ ...tempProfile, village: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded-lg"
                        />
                      ) : (
                        <span className="font-bold text-slate-900">{profile.village}</span>
                      )}
                    </div>
                    <div>
                      <label className="font-semibold text-slate-500 block mb-0.5">
                        {isTa ? 'மாவட்டம்:' : 'District:'}
                      </label>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={tempProfile.district}
                          onChange={(e) => setTempProfile({ ...tempProfile, district: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded-lg"
                        />
                      ) : (
                        <span className="font-bold text-slate-900">{profile.district}</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-500 block mb-0.5">
                      {isTa ? 'மொழி விருப்பம்:' : 'Language Preference:'}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as Language)}
                        className="p-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                      >
                        <option value="ta">தமிழ் (Tamil)</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </div>

                  {isEditingProfile && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setProfile(tempProfile);
                          localStorage.setItem('raidproof_farmer_profile', JSON.stringify(tempProfile));
                          setIsEditingProfile(false);
                        }}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isTa ? 'சேமி' : 'Save Changes'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* App Settings & Help (Right 5 cols) */}
              <div className="md:col-span-5 space-y-4">
                {/* App Settings Box */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <h4 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">
                    {isTa ? 'செயலி அமைப்புகள் (App Settings)' : 'App Settings'}
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 font-semibold">{isTa ? 'குரல் பதில் (Timbre Voice)' : 'Voice Response (Timbre)'}</span>
                      <button
                        type="button"
                        onClick={() => setVoiceResponseEnabled(!voiceResponseEnabled)}
                        className="text-emerald-700"
                      >
                        {voiceResponseEnabled ? <ToggleRight className="w-6 h-6 fill-emerald-600" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 font-semibold">{isTa ? 'தானியங்கி வரைவு (Auto-Save)' : 'Auto-Save Draft'}</span>
                      <button
                        type="button"
                        onClick={() => setAutoSaveDraft(!autoSaveDraft)}
                        className="text-emerald-700"
                      >
                        {autoSaveDraft ? <ToggleRight className="w-6 h-6 fill-emerald-600" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 font-semibold">{isTa ? 'ஆஃப்லைன் முறை (Offline Mode)' : 'Offline Mode'}</span>
                      <button
                        type="button"
                        onClick={() => setOfflineMode(!offlineMode)}
                        className="text-emerald-700"
                      >
                        {offlineMode ? <ToggleRight className="w-6 h-6 fill-emerald-600" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Help & Support Box */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
                  <h4 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">
                    {isTa ? 'உதவி & ஆதரவு (Help & Support)' : 'Help & Support'}
                  </h4>
                  <div className="space-y-2 text-xs text-slate-600">
                    <button
                      onClick={() => setActiveTab('help')}
                      className="w-full text-left py-1 hover:text-emerald-700 flex items-center justify-between"
                    >
                      <span>{isTa ? 'எப்படி புகார் அளிப்பது?' : 'How to report?'}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button
                      onClick={() => setActiveTab('help')}
                      className="w-full text-left py-1 hover:text-emerald-700 flex items-center justify-between"
                    >
                      <span>{isTa ? 'அடிக்கடி கேட்கப்படும் கேள்விகள்' : 'FAQs'}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <div className="pt-1 text-[11px] text-slate-500">
                      <span>{isTa ? 'வனத்துறை உதவி எண்: 1800-425-4747' : 'Forest Help: 1800-425-4747'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN: HELP & INSTRUCTIONS */}
          {/* ============================================================== */}
          {activeTab === 'help' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4 max-w-2xl">
              <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
                {isTa ? 'விவசாயிகளுக்கான உதவி வழிகாட்டி (Help Guide)' : 'Farmer Guide & Instructions'}
              </h2>
              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <h4 className="font-bold text-slate-900 mb-1">{isTa ? '1. குரல் பதிவு (Voice):' : '1. Voice Recording:'}</h4>
                  <p>{isTa ? 'மைக்கை அழுத்தி சேதமடைந்த பயிர் மற்றும் வந்த வனவிலங்கு பற்றி தமிழில் பேசவும்.' : 'Tap the microphone and describe the wildlife species and crop damaged in Tamil or English.'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <h4 className="font-bold text-slate-900 mb-1">{isTa ? '2. சான்றுகள் & GPS:' : '2. Evidence & GPS:'}</h4>
                  <p>{isTa ? 'சேதமடைந்த இடத்திலேயே கேமராவை இயக்கி புகைப்படம் எடுக்கவும். GPS இருப்பிடம் தானாக சேர்க்கப்படும்.' : 'Take a photo directly in your field with GPS coordinates automatically stamped.'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <h4 className="font-bold text-slate-900 mb-1">{isTa ? '3. சான்றாவணம் (Dossier):' : '3. Evidence Dossier:'}</h4>
                  <p>{isTa ? 'அனைத்து விவரங்களையும் சரிபார்த்து உடனே அதிகாரப்பூர்வ PDF சான்றாவணத்தைப் பதிவிறக்கம் செய்து வனத்துறைக்கு சமர்ப்பிக்கலாம்.' : 'Review and generate the structured PDF dossier ready for official Forest Department inspection.'}</p>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN: COMPENSATION NORMS & CALCULATOR (G.O. Ms. No. 42) */}
          {/* ============================================================== */}
          {activeTab === 'compensation' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-emerald-700" />
                    <span>
                      {isTa
                        ? 'வனவிலங்கு பயிர்ச்சேத நிவாரண அட்டவணை & கணக்கீட்டாளர்'
                        : 'Wildlife Crop Damage Relief Norms & Calculator'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isTa
                      ? 'தமிழ்நாடு வனத்துறை அரசாணை (நிலை) எண்: 42 வழிகாட்டு நெறிமுறைகள்'
                      : 'Tamil Nadu Forest Department G.O. Ms. No. 42 Official Schedule & Guidelines'}
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200 self-start sm:self-auto">
                  G.O. Ms. No. 42 (E&F)
                </span>
              </div>

              {/* Interactive Relief Calculator */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-2xl p-5 border border-emerald-200/80 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-emerald-950">
                      {isTa ? 'உத்தேச நிவாரணக் கணக்கீட்டாளர்' : 'Estimated Relief Calculator'}
                    </h3>
                    <p className="text-[11px] text-emerald-800">
                      {isTa
                        ? 'அரசு வழிகாட்டுதல்படி உத்தேச இழப்பீட்டுத் தொகையைக் கணக்கிடவும்.'
                        : 'Calculate indicative government compensation norms.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isTa ? 'பயிர் வகை (Crop Type):' : 'Crop Type:'}
                    </label>
                    <select
                      value={calcCrop}
                      onChange={(e) => setCalcCrop(e.target.value as any)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="banana">{isTa ? 'வாழை (Banana) - ₹300 / மரம்' : 'Banana - ₹300 / tree'}</option>
                      <option value="paddy">{isTa ? 'நெல் (Paddy) - ₹10,000 / ஏக்கர்' : 'Paddy - ₹10,000 / acre'}</option>
                      <option value="maize">{isTa ? 'மக்காச்சோளம் (Maize) - ₹8,000 / ஏக்கர்' : 'Maize - ₹8,000 / acre'}</option>
                      <option value="coconut">{isTa ? 'தென்னை (Coconut) - ₹1,500 / மரம்' : 'Coconut - ₹1,500 / tree'}</option>
                      <option value="sugarcane">{isTa ? 'கரும்பு (Sugarcane) - ₹25,000 / ஏக்கர்' : 'Sugarcane - ₹25,000 / acre'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {calcCrop === 'banana' || calcCrop === 'coconut'
                        ? (isTa ? 'சேதமடைந்த மரங்கள் எண்ணிக்கை:' : 'Damaged Trees Count:')
                        : (isTa ? 'சேதமடைந்த பரப்பளவு (ஏக்கர்):' : 'Damaged Area (Acres):')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step={calcCrop === 'banana' || calcCrop === 'coconut' ? '1' : '0.5'}
                      value={calcQty}
                      onChange={(e) => setCalcQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-emerald-200 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      {isTa ? 'உத்தேச நிவாரணத் தொகை' : 'Estimated Guideline Relief'}
                    </span>
                    <span className="text-xl font-extrabold text-emerald-950 font-mono">
                      ₹{' '}
                      {(
                        calcCrop === 'banana'
                          ? calcQty * 300
                          : calcCrop === 'coconut'
                          ? calcQty * 1500
                          : calcCrop === 'paddy'
                          ? calcQty * 10000
                          : calcCrop === 'maize'
                          ? calcQty * 8000
                          : calcQty * 25000
                      ).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60">
                  <span className="text-[11px] text-emerald-900/80">
                    * {isTa ? 'நிர்ணயிக்கப்பட்ட உச்சவரம்புகளுக்கு உட்பட்டது' : 'Subject to departmental caps and rules'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setExtractedData({
                        wildlife_species: "ELEPHANT",
                        wildlife_species_tamil: "காட்டு யானை",
                        crop_damaged: calcCrop.toUpperCase(),
                        crop_damaged_tamil:
                          calcCrop === 'banana'
                            ? 'வாழை'
                            : calcCrop === 'paddy'
                            ? 'நெல்'
                            : calcCrop === 'maize'
                            ? 'சோளம்'
                            : calcCrop === 'coconut'
                            ? 'தென்னை'
                            : 'கரும்பு',
                        damage_quantity: calcQty,
                        damage_unit: calcCrop === 'banana' || calcCrop === 'coconut' ? 'TREES' : 'ACRES',
                        damage_unit_tamil: calcCrop === 'banana' || calcCrop === 'coconut' ? 'மரங்கள்' : 'ஏக்கர்',
                        incident_time: "நேற்று இரவு (Yesterday Night)",
                        damage_type: "பயிர்ச்சேதம் (Crop damage)"
                      });
                      setActiveTab('new_report');
                      setWizardStep(2);
                    }}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs"
                  >
                    <span>{isTa ? 'இந்த பயிரை அறிக்கையில் சேர்க்க' : 'Use in Incident Report'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Official Relief Schedule Table */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900">
                  {isTa ? 'அரசாணை வழிகாட்டு நிவாரண அட்டவணை' : 'Official Government Relief Schedule'}
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">{isTa ? 'பயிர் / சேத வகை' : 'Crop / Damage Type'}</th>
                        <th className="py-2.5 px-3">{isTa ? 'நிவாரண விகிதம் (Norms)' : 'Prescribed Relief Rate'}</th>
                        <th className="py-2.5 px-3">{isTa ? 'உச்ச வரம்பு (Max Cap)' : 'Maximum Cap'}</th>
                        <th className="py-2.5 px-3">{isTa ? 'தேவையான சான்றுகள்' : 'Required Documents'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono text-slate-400">1</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{isTa ? 'வாழை (Banana)' : 'Banana'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹300 / குலை தள்ளிய மரம்' : '₹300 / bearing tree'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹35,000 / ஏக்கர்' : '₹35,000 / acre'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{isTa ? 'பட்டா, சேத புகைப்படங்கள்' : 'Patta, Damage Photos'}</td>
                      </tr>
                      <tr className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono text-slate-400">2</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{isTa ? 'தென்னை (Coconut)' : 'Coconut'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹1,500 - ₹3,000 / மரம்' : '₹1,500 - ₹3,000 / palm'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹50,000 / ஏக்கர்' : '₹50,000 / acre'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{isTa ? 'பட்டா, மர வயது விவரம்' : 'Patta, Palm Age Details'}</td>
                      </tr>
                      <tr className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono text-slate-400">3</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{isTa ? 'நெல் (Paddy)' : 'Paddy'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹10,000 / ஏக்கர் (₹25,000/ஹெக்)' : '₹10,000 / acre'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹25,000 / ஹெக்டேர்' : '₹25,000 / hectare'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{isTa ? 'அடங்கல், நில உரிமை ஆவணம்' : 'Adangal, Land Record'}</td>
                      </tr>
                      <tr className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono text-slate-400">4</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{isTa ? 'சோளம் / மக்காச்சோளம் (Maize)' : 'Maize / Cholam'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹8,000 / ஏக்கர் (₹20,000/ஹெக்)' : '₹8,000 / acre'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹20,000 / ஹெக்டேர்' : '₹20,000 / hectare'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{isTa ? 'பயிர் அடங்கல், கள படம்' : 'Adangal, Field Photos'}</td>
                      </tr>
                      <tr className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono text-slate-400">5</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{isTa ? 'கரும்பு (Sugarcane)' : 'Sugarcane'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹25,000 / ஏக்கர்' : '₹25,000 / acre'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹25,000 / ஏக்கர்' : '₹25,000 / acre'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{isTa ? 'ஆலை பதிவு / பட்டா' : 'Mill Registration / Patta'}</td>
                      </tr>
                      <tr className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono text-slate-400">6</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{isTa ? 'கால்நடை இழப்பு (பசு / எருமை)' : 'Cattle / Buffalo Loss'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹30,000 / கால்நடை' : '₹30,000 / cattle'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{isTa ? '₹30,000 / ஒன்றுக்கு' : '₹30,000 each'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{isTa ? 'கால்நடை மருத்துவர் PM அறிக்கை' : 'Veterinary PM Report'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4-Step Official Sanction Flow */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs text-slate-900">
                  {isTa ? 'அரசு நிவாரணம் பெறும் செயல்முறை வழிகாட்டி:' : 'Official Ex-Gratia Sanction Process:'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px] mb-1.5">1</span>
                    <h5 className="font-bold text-slate-800">{isTa ? 'சான்றாவணம் பதிவு' : 'Report & Dossier'}</h5>
                    <p className="text-[11px] text-slate-500 mt-1">{isTa ? 'சம்பவம் நடந்த 24 மணி நேரத்திற்குள் சான்றாவணம் தயார் செய்தல்.' : 'Generate dossier within 24 hours of incident.'}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px] mb-1.5">2</span>
                    <h5 className="font-bold text-slate-800">{isTa ? 'கூட்டு கள ஆய்வு' : 'Joint Inspection'}</h5>
                    <p className="text-[11px] text-slate-500 mt-1">{isTa ? 'வனச்சரக அலுவலர் & கிராம நிர்வாக அலுவலர் (VAO) கள ஆய்வு.' : 'Forest Range Officer & VAO inspect damage site.'}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px] mb-1.5">3</span>
                    <h5 className="font-bold text-slate-800">{isTa ? 'மாவட்ட அலுவலர் ஒப்புதல்' : 'DFO Sanction'}</h5>
                    <p className="text-[11px] text-slate-500 mt-1">{isTa ? 'மாவட்ட வன அலுவலர் இழப்பீட்டு தொகையை இறுதி செய்தல்.' : 'DFO reviews inspection and sanctions relief.'}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px] mb-1.5">4</span>
                    <h5 className="font-bold text-slate-800">{isTa ? 'வங்கி கணக்கில் வரவு' : 'DBT Bank Credit'}</h5>
                    <p className="text-[11px] text-slate-500 mt-1">{isTa ? 'விவசாயியின் வங்கிக் கணக்கிற்கு நேரடியாக நிதி பரிமாற்றம்.' : 'Relief transferred directly to bank account.'}</p>
                  </div>
                </div>
              </div>

              {/* Regulatory Notice */}
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">
                    {isTa ? 'சட்டப்பூர்வ அறிவிப்பு:' : 'Statutory Regulatory Notice:'}
                  </span>
                  <span>
                    {isTa
                      ? 'மேற்கண்ட கணக்கீடு அரசாணை வழிகாட்டுதல்களின்படியான உத்தேச மதிப்பீடு மட்டுமே. AI தளம் இழப்பீட்டை அனுமதிக்கும் அதிகாரம் கொண்டதல்ல. இழப்பீட்டுத் தொகை துறைசார்ந்த அதிகாரிகளின் நேரடி கள ஆய்விற்குப் பிறகே தீர்மானிக்கப்படும்.'
                      : 'The values above are indicative estimates derived from Government Orders. AI never approves or disburses claims. Formal compensation is sanctioned strictly post official joint departmental inspection.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN: FOREST EMERGENCY CONTACTS & RAPID RESPONSE TEAMS */}
          {/* ============================================================== */}
          {activeTab === 'contacts' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <PhoneCall className="w-5 h-5 text-rose-600" />
                    <span>
                      {isTa
                        ? 'வனத்துறை அவசர தொடர்புகள் & பறக்கும் படை'
                        : 'Forest Emergency Helplines & Rapid Response Teams'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isTa
                      ? 'வனவிலங்கு நடமாட்டம், பயிர்ச்சேதம் மற்றும் அவசர உதவிக்கான தொடர்பு எண்கள்'
                      : 'Emergency contact directory for wildlife incursions and depredation assistance'}
                  </p>
                </div>
                <span className="px-3 py-1 bg-rose-50 text-rose-700 text-[11px] font-bold rounded-lg border border-rose-200 self-start sm:self-auto flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                  24x7 Active
                </span>
              </div>

              {/* 24x7 State Helpline Card */}
              <div className="bg-gradient-to-r from-emerald-800 to-teal-800 rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 uppercase tracking-wider">
                    {isTa ? 'மாநில வனத்துறை 24x7 கட்டுப்பாட்டு அறை' : 'State Forest 24x7 Control Room'}
                  </span>
                  <h3 className="text-2xl font-black tracking-tight">1926</h3>
                  <p className="text-xs text-emerald-100 max-w-md">
                    {isTa
                      ? 'தமிழ்நாடு முழுவதும் வனவிலங்கு மனித எதிர்கொள்ளல் மற்றும் அவசர உதவிக்கான கட்டணமில்லா தொலைபேசி எண்.'
                      : 'Statewide toll-free helpline for human-wildlife encounters and rapid assistance.'}
                  </p>
                </div>
                <a
                  href="tel:1926"
                  className="px-5 py-3 bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-xs shrink-0"
                >
                  <PhoneCall className="w-4 h-4 text-emerald-800" />
                  <span>{isTa ? 'உடனடியாக அழைக்க: 1926' : 'Call 1926 Toll-Free'}</span>
                </a>
              </div>

              {/* District & Division Range Offices Directory */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900">
                  {isTa ? 'மண்டல வனச்சரக அலுவலகங்கள் & ரோந்துப் படைகள்' : 'Regional Range Offices & Patrol Units'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* ATR Pollachi */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">
                          {isTa ? 'ஆனைமலை புலிகள் காப்பகம் (ATR) கட்டுப்பாட்டு அறை' : 'Anamalai Tiger Reserve Control Room'}
                        </h4>
                        <span className="text-[11px] text-slate-500">பொள்ளாச்சி (Pollachi)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">24 Hours</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono font-bold text-xs text-slate-800">04259 235385 / 1800 425 4545</span>
                      <a
                        href="tel:04259235385"
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>{isTa ? 'அழைக்க' : 'Call'}</span>
                      </a>
                    </div>
                  </div>

                  {/* Valparai Range */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">
                          {isTa ? 'வால்பாறை வனச்சரக அலுவலகம்' : 'Valparai Forest Range Office'}
                        </h4>
                        <span className="text-[11px] text-slate-500">வால்பாறை & எஸ்டேட் எல்லைகள்</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">Range Office</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono font-bold text-xs text-slate-800">04253 222234</span>
                      <a
                        href="tel:04253222234"
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>{isTa ? 'அழைக்க' : 'Call'}</span>
                      </a>
                    </div>
                  </div>

                  {/* Manambolly Range */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">
                          {isTa ? 'மணம்பள்ளி வனச்சரக அலுவலகம்' : 'Manambolly Forest Range Office'}
                        </h4>
                        <span className="text-[11px] text-slate-500">சோலையார் அணை & ஆனைமலை</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">Range Office</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono font-bold text-xs text-slate-800">04253 222235</span>
                      <a
                        href="tel:04253222235"
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>{isTa ? 'அழைக்க' : 'Call'}</span>
                      </a>
                    </div>
                  </div>

                  {/* Coimbatore Flying Squad */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">
                          {isTa ? 'கோயம்புத்தூர் யானை தடுப்பு பறக்கும் படை' : 'Coimbatore Elephant Flying Squad'}
                        </h4>
                        <span className="text-[11px] text-slate-500">மதுக்கரை, தொண்டாமுத்தூர், போளூவாம்பட்டி</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900">Rapid Response</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono font-bold text-xs text-slate-800">0422 2434777</span>
                      <a
                        href="tel:04222434777"
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>{isTa ? 'அழைக்க' : 'Call'}</span>
                      </a>
                    </div>
                  </div>

                  {/* Nilgiris Division */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">
                          {isTa ? 'நீலகிரி வனக்கோட்ட விரைவு அதிரடிப்படை' : 'Nilgiris Depredation Response Team'}
                        </h4>
                        <span className="text-[11px] text-slate-500">கூடலூர், உதகை & கோத்தகிரி</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">QRT Team</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono font-bold text-xs text-slate-800">0423 2444071</span>
                      <a
                        href="tel:04232444071"
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>{isTa ? 'அழைக்க' : 'Call'}</span>
                      </a>
                    </div>
                  </div>

                  {/* Sathyamangalam (STR) */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">
                          {isTa ? 'சத்தியமங்கலம் புலிகள் காப்பகம் (STR)' : 'Sathyamangalam Tiger Reserve'}
                        </h4>
                        <span className="text-[11px] text-slate-500">ஈரோடு & பவானிசாகர் எல்லை</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">STR Control</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono font-bold text-xs text-slate-800">04295 220312</span>
                      <a
                        href="tel:04295220312"
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>{isTa ? 'அழைக்க' : 'Call'}</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legal Regulatory Notice */}
          <div className="text-center py-4 px-4 text-[11px] text-slate-500 mt-auto">
            ⚠️ <b>{isTa ? 'சுய அறிவிப்பு சான்றாவணம்:' : 'Self-Declaration Evidence Dossier:'}</b>{' '}
            {isTa
              ? 'இது அதிகாரப்பூர்வ அரசு படிவம் அல்லது இழப்பீட்டு உத்தரவாதம் அல்ல. வனத்துறையின் கள ஆய்வுக்கு சமர்ப்பிக்க விவசாயி சான்றுகளைத் தொகுக்கும் தளம் மட்டுமே.'
              : 'This is not an official government compensation approval. All wildlife claims are subject to official Forest Department field inspection.'}
          </div>
        </main>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* ============================================================== */}
      {/* MODAL: LOCATION MAP PICKER */}
      {/* ============================================================== */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            <div className="p-3.5 border-b flex items-center justify-between bg-slate-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>{isTa ? 'கள வரைபடம் (OpenStreetMap)' : 'Incident Location Map'}</span>
              </h3>
              <button onClick={() => setShowMapModal(false)}>
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
                }}
              />
            </div>

            <div className="p-3 border-t bg-white flex justify-end">
              <button
                onClick={() => setShowMapModal(false)}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition"
              >
                {isTa ? 'சரி, உறுதி செய்' : 'Confirm Location'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: MOBILE SHARE */}
      {/* ============================================================== */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                {isTa ? 'மொபைலில் திறக்க' : 'Open on Mobile'}
              </h3>
              <button onClick={() => setShowShareModal(false)}>
                <XCircle className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <p className="text-[11px] text-slate-600">
              {isTa
                ? 'உங்கள் மொபைல் போனை இதே வைஃபை நெட்வொர்க்கில் இணைத்து கீழேயுள்ள முகவரியை திறக்கவும்:'
                : 'Connect your smartphone to the same Wi-Fi and open:'}
            </p>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
              <span className="font-mono font-bold text-emerald-950 text-xs select-all">
                http://10.230.118.81:5173
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('http://10.230.118.81:5173');
                  alert(isTa ? 'இணைப்பு நகலெடுக்கப்பட்டது!' : 'Link copied!');
                }}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-[10px]"
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
      {/* MODAL: DIAGNOSTICS */}
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
                <XCircle className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {isLoadingDiag ? (
              <div className="text-center py-6 text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
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
              className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl"
            >
              {isTa ? 'மீண்டும் சோதி' : 'Test Again'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
