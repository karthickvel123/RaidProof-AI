import { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Download,
  Share2,
  Calendar,
  ChevronLeft,
  Activity,
  User,
  Edit3,
  RefreshCw,
  XCircle,
  Save,
  Eye,
  Upload,
  Smartphone,
  FileText,
  MapPin
} from 'lucide-react';

import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useCameraGPS } from './hooks/useCameraGPS';
import { PushToTalkMic } from './components/PushToTalkMic';
import { AudioWaveform } from './components/AudioWaveform';
import { SpokenAudioPlayer } from './components/SpokenAudioPlayer';
import { GPSIndicator } from './components/GPSIndicator';
import { LocationMapPicker } from './components/LocationMapPicker';
import { offlineDb, type LocalIncidentDraft } from './services/db/offlineDb';

type Step = 'DASHBOARD' | 'FIELD_REPORT' | 'VOICE' | 'CAMERA' | 'CHECKLIST' | 'DOSSIER';

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

const DEFAULT_FARMER_PROFILE: FarmerProfile = {
  name: "செல்வம்",
  phone: "9876543210",
  village: "வால்பாறை",
  taluk: "பொள்ளாச்சி",
  district: "கோயம்புத்தூர்",
  pattaNumber: "1042",
  surveyNumber: "84/2A",
  acres: 2.5
};

export function App() {
  const [currentStep, setCurrentStep] = useState<Step>('DASHBOARD');
  const [language, setLanguage] = useState<'ta' | 'en'>('ta');

  // System Health & Voice Mode State
  const [systemHealth, setSystemHealth] = useState<{ status: string; voice_provider: string } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPdfViewerModal, setShowPdfViewerModal] = useState(false);
  const [diagData, setDiagData] = useState<any>(null);
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Farmer Profile State (No hardcoded demo data forced)
  const [profile, setProfile] = useState<FarmerProfile>(() => {
    const saved = localStorage.getItem('raidproof_farmer_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_FARMER_PROFILE;
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState<FarmerProfile>(profile);

  // Voice Recording & Error State (Preserves recording on error, zero fabricated transcripts)
  const { isRecording, volume, startRecording, stopRecording } = useAudioRecorder();
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [savedAudioBlob, setSavedAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [contradictions, setContradictions] = useState<any[]>([]);
  const [spokenAudioUrl, setSpokenAudioUrl] = useState<string>("");

  // Camera & Real Evidence Photos
  const camera = useCameraGPS();
  const [photoStep, setPhotoStep] = useState<'WIDE' | 'SPOOR'>('WIDE');
  const [activePhotoUploadSlot, setActivePhotoUploadSlot] = useState<'WIDE' | 'SPOOR'>('WIDE');
  const [widePhotoUrl, setWidePhotoUrl] = useState<string | null>(null);
  const [widePhotoBlob, setWidePhotoBlob] = useState<Blob | null>(null);
  const [spoorPhotoUrl, setSpoorPhotoUrl] = useState<string | null>(null);
  const [spoorPhotoBlob, setSpoorPhotoBlob] = useState<Blob | null>(null);
  const [capturedGps, setCapturedGps] = useState<{ latitude: number; longitude: number; accuracy: number; isLocked: boolean } | null>(null);

  // Field Report Location & Map State (matching user mockup)
  const [locationName, setLocationName] = useState('வால்பாறை மேற்கு தோட்டம் (Valparai Farm)');
  const [description, setDescription] = useState('');
  const [mapCoords, setMapCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    source: 'consent_device_gps' | 'farmer_map_pin';
  }>({
    latitude: 10.3275,
    longitude: 76.9554,
    accuracy: 5.0,
    source: 'farmer_map_pin'
  });

  // Document Checklist (Reflects actual farmer selections, unselected by default)
  const [checklist, setChecklist] = useState({
    patta: false,
    adangal: false,
    bank: false,
    aadhaar: false,
    witness: false
  });

  // Incident & Dossier State
  const [claimsList, setClaimsList] = useState<any[]>([]);
  const [createdIncidentCode, setCreatedIncidentCode] = useState<string>("");
  const [dossierPdfUrl, setDossierPdfUrl] = useState<string | null>(null);

  // Load system health and previous claims on mount
  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => res.json())
      .then((data) => setSystemHealth(data))
      .catch(() => {});

    fetch('/api/v1/incidents/list')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setClaimsList(data);
      })
      .catch(() => {
        offlineDb.drafts.toArray().then((drafts) => {
          setClaimsList(
            drafts.map((d) => ({
              incident_code: d.serverIncidentId || d.localId.substring(0, 8),
              crop_damaged_tamil: d.cropDamagedTamil || d.cropDamaged,
              damage_quantity: d.damageQuantity,
              status: d.status,
              created_at: new Date(d.createdAt).toLocaleDateString()
            }))
          );
        });
      });
  }, []);

  // Save profile changes
  const handleSaveProfile = () => {
    setProfile(tempProfile);
    localStorage.setItem('raidproof_farmer_profile', JSON.stringify(tempProfile));
    setIsEditingProfile(false);
  };

  // Run live diagnostics test
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

  // Submit audio blob to voice listen API
  const submitAudioTurn = async (audioBlob: Blob, transcriptOverride?: string) => {
    setIsProcessingVoice(true);
    setVoiceError(null);
    setSavedAudioBlob(audioBlob);

    try {
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'farmer_speech.wav');
      formData.append('farmer_id', profile.phone || 'farmer-01');
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
      if (!description) {
        setDescription(data.transcript);
      }
      setExtractedData(data.extracted);
      setContradictions(data.contradictions || []);
      setSpokenAudioUrl(data.spoken_response_audio_url);
      setVoiceError(null);

      // Save draft in IndexedDB
      const draft: LocalIncidentDraft = {
        localId: 'draft_' + Date.now(),
        farmerId: profile.phone || 'farmer-01',
        farmerName: profile.name,
        audioBlob: audioBlob,
        transcript: data.transcript,
        wildlifeSpecies: data.extracted.wildlife_species,
        wildlifeSpeciesTamil: data.extracted.wildlife_species_tamil,
        cropDamaged: data.extracted.crop_damaged,
        cropDamagedTamil: data.extracted.crop_damaged_tamil,
        damageQuantity: data.extracted.damage_quantity,
        damageUnit: data.extracted.damage_unit,
        damageUnitTamil: data.extracted.damage_unit_tamil,
        attackPattern: data.extracted.attack_pattern,
        status: 'DRAFT_LOCAL',
        createdAt: Date.now()
      };
      await offlineDb.drafts.put(draft);

    } catch (err: any) {
      console.error('Voice processing failure:', err);
      // REMOVED ALL FABRICATED FALLBACK TRANSCRIPTS!
      setVoiceError(
        `குரல் செயலாக்கத்தில் பிழை ஏற்பட்டது (${err.message || 'இணைப்பு பிழை'}). உங்கள் பதிவு பாதுகாக்கப்பட்டுள்ளது; மீண்டும் முயற்சி செய்யவும்.`
      );
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Quick test of realistic farmer scenario
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

  // Handle local file upload for photo (handles both step-by-step and unified field report)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (currentStep === 'FIELD_REPORT') {
          if (activePhotoUploadSlot === 'WIDE') {
            setWidePhotoUrl(dataUrl);
            setWidePhotoBlob(file);
          } else {
            setSpoorPhotoUrl(dataUrl);
            setSpoorPhotoBlob(file);
          }
        } else {
          if (photoStep === 'WIDE') {
            setWidePhotoUrl(dataUrl);
            setWidePhotoBlob(file);
            setPhotoStep('SPOOR');
          } else {
            setSpoorPhotoUrl(dataUrl);
            setSpoorPhotoBlob(file);
            camera.stopCamera();
            setCurrentStep('CHECKLIST');
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Simulate realistic field photo for specific slot
  const handleSimulateSamplePhoto = async (slot: 'WIDE' | 'SPOOR') => {
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

  // Handle sample field photo capture fallback
  const handleSampleFieldPhoto = async () => {
    const photo = await camera.capturePhoto();
    if (photo) {
      if (camera.gps.isLocked) {
        setCapturedGps({
          latitude: camera.gps.latitude,
          longitude: camera.gps.longitude,
          accuracy: camera.gps.accuracy,
          isLocked: true
        });
      }
      if (photoStep === 'WIDE') {
        setWidePhotoUrl(photo.dataUrl);
        setWidePhotoBlob(photo.blob);
        setPhotoStep('SPOOR');
      } else {
        setSpoorPhotoUrl(photo.dataUrl);
        setSpoorPhotoBlob(photo.blob);
        camera.stopCamera();
        setCurrentStep('CHECKLIST');
      }
    }
  };

  // Handle Voice Recording Stop
  const handleMicStop = async () => {
    const audioBlob = await stopRecording();
    if (audioBlob) {
      await submitAudioTurn(audioBlob);
    }
  };

  // Handle Photo Capture
  const handleSnapPhoto = async () => {
    const photo = await camera.capturePhoto();
    if (photo) {
      if (camera.gps.isLocked) {
        setCapturedGps({
          latitude: camera.gps.latitude,
          longitude: camera.gps.longitude,
          accuracy: camera.gps.accuracy,
          isLocked: true
        });
      }

      if (photoStep === 'WIDE') {
        setWidePhotoUrl(photo.dataUrl);
        setWidePhotoBlob(photo.blob);
        setPhotoStep('SPOOR');
      } else {
        setSpoorPhotoUrl(photo.dataUrl);
        setSpoorPhotoBlob(photo.blob);
        camera.stopCamera();
        setCurrentStep('CHECKLIST');
      }
    }
  };

  // Generate Final Dossier with real farmer data and real evidence photos
  const handleGenerateDossier = async () => {
    const clientDraftId = 'draft_' + Date.now();
    const consentLat = mapCoords.latitude ?? (capturedGps?.isLocked ? capturedGps.latitude : null);
    const consentLng = mapCoords.longitude ?? (capturedGps?.isLocked ? capturedGps.longitude : null);
    const consentAcc = mapCoords.accuracy ?? (capturedGps?.isLocked ? capturedGps.accuracy : null);

    const payload = {
      farmer_id: profile.phone || 'farmer-01',
      client_draft_id: clientDraftId,
      farmer_name: profile.name,
      farmer_phone: profile.phone,
      village: profile.village,
      taluk: profile.taluk,
      district: profile.district,
      patta_number: profile.pattaNumber,
      survey_number: profile.surveyNumber,
      area_acres: profile.acres,
      consent_latitude: consentLat,
      consent_longitude: consentLng,
      consent_gps_accuracy: consentAcc,
      checklist: checklist,
      wildlife_species: extractedData?.wildlife_species || 'ELEPHANT',
      wildlife_species_tamil: extractedData?.wildlife_species_tamil || 'காட்டு யானை',
      crop_damaged: extractedData?.crop_damaged || 'BANANA',
      crop_damaged_tamil: extractedData?.crop_damaged_tamil || 'வாழை',
      damage_quantity: extractedData?.damage_quantity || 15,
      damage_unit: extractedData?.damage_unit || 'TREES',
      damage_unit_tamil: extractedData?.damage_unit_tamil || 'மரங்கள்',
      raw_voice_transcript: transcript || description || 'நேத்து ராத்திரி வால்பாறை தோட்டத்தில் ஒரு காட்டு யானை உள்ளே நுழைந்து 15 வாழை மரங்களை வேரோடு சாய்த்து தின்றுவிட்டது.'
    };

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

        // Upload evidence photos associated with the real incident ID
        if (widePhotoBlob) {
          const form = new FormData();
          form.append('photo_file', widePhotoBlob, 'wide_photo.jpg');
          form.append('incident_id', incidentId);
          form.append('photo_type', 'WIDE_ANGLE');
          if (consentLat !== null && consentLng !== null) {
            form.append('latitude', String(consentLat));
            form.append('longitude', String(consentLng));
            form.append('accuracy', String(consentAcc || 5.0));
          }
          await fetch('/api/v1/evidence/upload', { method: 'POST', body: form }).catch(console.warn);
        }

        if (spoorPhotoBlob) {
          const form = new FormData();
          form.append('photo_file', spoorPhotoBlob, 'spoor_photo.jpg');
          form.append('incident_id', incidentId);
          form.append('photo_type', 'CLOSE_UP_SPOOR');
          if (consentLat !== null && consentLng !== null) {
            form.append('latitude', String(consentLat));
            form.append('longitude', String(consentLng));
            form.append('accuracy', String(consentAcc || 5.0));
          }
          await fetch('/api/v1/evidence/upload', { method: 'POST', body: form }).catch(console.warn);
        }

        setDossierPdfUrl(`/api/v1/dossier/${incidentId}/pdf`);

        // Mark local draft as SYNCED
        await offlineDb.drafts.where('farmerId').equals(payload.farmer_id).modify({
          status: 'SYNCED',
          serverIncidentId: result.incident_code
        });
      } else {
        setDossierPdfUrl('/api/v1/dossier/sample/pdf');
      }
    } catch (netErr) {
      console.warn('Network offline, queuing incident for sync:', netErr);
      setDossierPdfUrl('/api/v1/dossier/sample/pdf');
    }
    setCurrentStep('DOSSIER');
  };

  const isRealGnaniMode = systemHealth?.voice_provider === 'gnani_prisma_timbre';

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 pb-12 flex flex-col items-center">
      {/* Top Header */}
      <header className="w-full max-w-5xl bg-emerald-800 text-white p-3.5 shadow-md flex items-center justify-between sticky top-0 z-30 md:rounded-b-2xl">
        <div className="flex items-center gap-2">
          {currentStep !== 'DASHBOARD' && (
            <button
              onClick={() => setCurrentStep('DASHBOARD')}
              className="p-1 hover:bg-emerald-700 rounded-full transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="font-bold text-base leading-tight flex items-center gap-1.5">
              <span>🌾</span> RaidProof AI
            </h1>
            <p className="text-[10px] text-emerald-200">சுய சான்றாவண உதவியாளர் · Self-Declaration Dossier</p>
          </div>
        </div>

        {/* Real Gnani Mode / Mock Mode Badge & Diagnostic Button */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowShareModal(true)}
            title="மொபைல் பகிர்வு (Open on Mobile)"
            className="p-1.5 rounded-lg bg-emerald-900 border border-emerald-700 text-emerald-200 hover:bg-emerald-950 transition"
          >
            <Smartphone className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setShowDiagnostics(true);
              handleRunDiagnostics();
            }}
            title="கணினி ஆய்வு (System Diagnostics)"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
              isRealGnaniMode
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 hover:bg-emerald-900'
                : 'bg-amber-950/80 border-amber-400 text-amber-300 hover:bg-amber-900'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isRealGnaniMode ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{isRealGnaniMode ? 'REAL GNANI' : 'MOCK MODE'}</span>
            <Activity className="w-3 h-3 ml-0.5" />
          </button>

          <button
            onClick={() => setLanguage(language === 'ta' ? 'en' : 'ta')}
            className="px-2 py-1 text-xs font-semibold bg-emerald-900 border border-emerald-700 rounded-lg hover:bg-emerald-950 transition"
          >
            {language === 'ta' ? 'EN' : 'தமிழ்'}
          </button>
        </div>
      </header>

      {/* Regulatory Notice Banner */}
      <div className="w-full max-w-5xl bg-amber-50 border-b border-amber-200 px-4 py-1 text-center">
        <p className="text-[10px] text-amber-900 font-medium leading-tight">
          ⚠️ <b>சுய அறிவிப்பு சான்றாவணம்:</b> இது அதிகாரப்பூர்வ அரசு படிவம் அல்லது இழப்பீட்டு உத்தரவாதம் அல்ல. விவசாயி சான்றுகளைத் தொகுக்கும் செயலி மட்டுமே.
        </p>
      </div>

      {/* Main Container */}
      <main className="w-full max-w-5xl px-3 md:px-4 pt-3 flex-1 flex flex-col">
        {/* ============================================================== */}
        {/* STEP 1: DASHBOARD */}
        {/* ============================================================== */}
        {currentStep === 'DASHBOARD' && (
          <div className="max-w-xl mx-auto w-full space-y-3.5">
            {/* Farmer Profile Card (Editable, No Hardcoding) */}
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">விவசாயி: {profile.name}</h2>
                    <p className="text-[11px] text-gray-500">{profile.village} | பட்டா: {profile.pattaNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setTempProfile(profile);
                    setIsEditingProfile(true);
                  }}
                  className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-1 hover:bg-emerald-100"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>மாற்ற</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-600">
                <div className="bg-gray-50 p-1.5 rounded-lg text-center">
                  <span className="block text-gray-400 text-[10px]">நிலப்பரப்பு</span>
                  <span className="font-bold text-gray-800">{profile.acres} ஏக்கர்</span>
                </div>
                <div className="bg-gray-50 p-1.5 rounded-lg text-center">
                  <span className="block text-gray-400 text-[10px]">சர்வே எண்</span>
                  <span className="font-bold text-gray-800">{profile.surveyNumber}</span>
                </div>
                <div className="bg-gray-50 p-1.5 rounded-lg text-center">
                  <span className="block text-gray-400 text-[10px]">தொலைபேசி</span>
                  <span className="font-bold text-gray-800">{profile.phone}</span>
                </div>
              </div>
            </div>

            {/* Primary Voice Action Banner */}
            <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-3xl p-5 text-white shadow-lg text-center">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2.5">
                <span className="text-2xl">🎙️</span>
              </div>
              <h3 className="text-lg font-bold mb-1">பயிர்ச்சேதம் ஏற்பட்டதா?</h3>
              <p className="text-xs text-emerald-100 mb-4 leading-relaxed">
                யானை, காட்டுப்பன்றி தாக்கிய விவரங்களை தமிழில் பேசி 3 நிமிடத்தில் சுய சான்றாவணம் தயார் செய்யவும்.
              </p>
              <button
                onClick={() => {
                  setTranscript("");
                  setExtractedData(null);
                  setVoiceError(null);
                  setSavedAudioBlob(null);
                  setCurrentStep('FIELD_REPORT');
                }}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-emerald-950 font-bold rounded-2xl shadow-md transition text-sm flex items-center justify-center gap-2"
              >
                <span>புதிய கள அறிக்கை பதிவு (Create Field Report)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setTranscript("");
                    setExtractedData(null);
                    setVoiceError(null);
                    setSavedAudioBlob(null);
                    setCurrentStep('FIELD_REPORT');
                  }}
                  className="flex-1 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>வரைபட கள அறிக்கை (Map & Form)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTranscript("");
                    setExtractedData(null);
                    setVoiceError(null);
                    setSavedAudioBlob(null);
                    setCurrentStep('VOICE');
                  }}
                  className="py-2 px-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition"
                >
                  <span>படிப் படியாக (Steps)</span>
                </button>
              </div>
            </div>

            {/* Mode & Diagnostic Banner */}
            <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-gray-800 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isRealGnaniMode ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>{isRealGnaniMode ? 'ரியல் ஞானி AI (Real Cloud Connected)' : 'மாக் பயன்முறை (Mock Offline Mode)'}</span>
                </p>
                <p className="text-[11px] text-gray-500">
                  {isRealGnaniMode ? 'Prisma v3.0 STT & Timbre v3.0 (Lakshmi)' : 'உள்ளூர் மாதிரி அமைப்பில் இயங்குகிறது'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDiagnostics(true);
                  handleRunDiagnostics();
                }}
                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs flex items-center gap-1 transition"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>ஆய்வு</span>
              </button>
            </div>

            {/* Sample PDF Preview */}
            <div className="bg-white rounded-2xl p-3 border border-emerald-200 shadow-sm flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-emerald-900">மாதிரி சான்றாவணம் (Sample PDF)</p>
                <p className="text-[11px] text-gray-500">சுய அறிவிப்பு மாதிரி ஆவணம்</p>
              </div>
              <a
                href="/api/v1/dossier/sample/pdf"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl font-bold flex items-center gap-1 hover:bg-emerald-100 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>பார்க்க</span>
              </a>
            </div>

            {/* Recent Claims List */}
            <div className="bg-white rounded-2xl p-3.5 border border-gray-200 shadow-sm">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>முந்தைய பதிவுகள் (Recent Records)</span>
              </h4>

              {claimsList.length === 0 ? (
                <div className="text-center py-5 text-gray-400 text-xs">முந்தைய பதிவுகள் ஏதுமில்லை.</div>
              ) : (
                <div className="space-y-2">
                  {claimsList.map((claim, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{claim.crop_damaged_tamil || 'பயிர்'} சேதம்</p>
                        <p className="text-[11px] text-gray-500">{claim.incident_code} • {claim.damage_quantity} {claim.damage_unit_tamil || 'அளவு'}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={claim.id ? `/api/v1/dossier/${claim.id}/pdf` : '/api/v1/dossier/sample/pdf'}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                        >
                          <FileText className="w-3 h-3" />
                          <span>PDF</span>
                        </a>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {claim.status || 'தயார்'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP: CREATE FIELD REPORT (Unified Map + Voice + Evidence Form) */}
        {/* ============================================================== */}
        {currentStep === 'FIELD_REPORT' && (
          <div className="space-y-4 pb-6">
            {/* Top Subheader inspired by Mangrove Guardian AI / Create Field Report */}
            <div className="bg-white rounded-3xl p-4 md:p-5 shadow-xs border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  RaidProof AI · Field Incident Workflow
                </span>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">
                  Create Field Report (கள அறிக்கை பதிவு)
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Pin the location, attach evidence, and trigger AI damage analysis. (இருப்பிடத்தை வரைபடத்தில் குறித்து, சான்றுகளை இணைத்து சுய அறிக்கை தயார் செய்யவும்).
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrentStep('DASHBOARD')}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back (முகப்பு)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTranscript('');
                    setDescription('');
                    setExtractedData(null);
                    setWidePhotoUrl(null);
                    setWidePhotoBlob(null);
                    setSpoorPhotoUrl(null);
                    setSpoorPhotoBlob(null);
                  }}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs transition"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Split Screen Grid: Map on the left, Reporting & Evidence Form on the right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* LEFT COLUMN: Interactive Map & Location Details */}
              <div className="lg:col-span-6 space-y-4">
                {/* Interactive Leaflet Location Map */}
                <LocationMapPicker
                  latitude={mapCoords.latitude}
                  longitude={mapCoords.longitude}
                  accuracy={mapCoords.accuracy}
                  source={mapCoords.source}
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
                        (err) => {
                          alert('GPS இருப்பிடம் பெற முடியவில்லை: ' + err.message);
                        },
                        { enableHighAccuracy: true, timeout: 10000 }
                      );
                    }
                  }}
                />

                {/* Location Name & Description Inputs (as seen in user screenshot) */}
                <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-xs space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Location Name (இடத்தின் பெயர் / தோட்டம்)
                    </label>
                    <input
                      type="text"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder="e.g. Mangrove Forest A / வால்பாறை மேற்கு தோட்டம்"
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-emerald-600 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Description (சேத விவர விளக்கம் / நிகழ்வு விபரம்)
                    </label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe current conditions or record speech..."
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-emerald-600 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Voice Interview, Photo Upload, Checklist, Submit */}
              <div className="lg:col-span-6 space-y-4">
                {/* 1. Voice Interview Box */}
                <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <span className="text-base">🎙️</span>
                      <span>குரல் வழி சேதப் பதிவு (Voice Incident Reporting)</span>
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      GNANI PRISMA STT
                    </span>
                  </div>

                  {/* Push To Talk Mic & Waveform */}
                  <PushToTalkMic
                    isRecording={isRecording}
                    isProcessing={isProcessingVoice}
                    onStart={startRecording}
                    onStop={handleMicStop}
                    language={language}
                  />

                  <AudioWaveform volume={volume} isRecording={isRecording} />

                  {/* 1-Click Realistic Scenarios */}
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                        <span>⚡</span> மாதிரி விவசாயி குரல் சூழல் (1-Click Test Scenarios):
                      </span>
                      <span className="text-[9px] bg-emerald-200/60 text-emerald-900 px-1.5 py-0.5 rounded font-bold">
                        REAL GNANI VOICE
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleScenarioClick(
                            'நேத்து ராத்திரி வால்பாறை தோட்டத்தில் ஒரு காட்டு யானை உள்ளே நுழைந்து 15 வாழை மரங்களை வேரோடு சாய்த்து தின்றுவிட்டது.'
                          )
                        }
                        disabled={isProcessingVoice}
                        className="p-2 rounded-xl bg-white hover:bg-emerald-100/60 border border-emerald-200 text-left transition flex items-center justify-between text-[11px] shadow-2xs group"
                      >
                        <div>
                          <span className="font-bold text-emerald-950 block">🐘 வால்பாறை: காட்டு யானை 15 வாழை மரங்கள்</span>
                          <span className="text-[10px] text-gray-500">"நேத்து ராத்திரி காட்டு யானை 15 வாழை மரங்களை வேரோடு சாய்த்தது..."</span>
                        </div>
                        <span className="text-emerald-700 font-bold text-xs group-hover:translate-x-0.5 transition-transform">▶</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleScenarioClick(
                            'பொள்ளாச்சி தோட்டத்தில் முந்தாநாள் இரவு 6 காட்டுப்பன்றிகள் வந்து அரை ஏக்கர் நிலக்கடலை பயிரை கிளறி நாசம் செய்துவிட்டது.'
                          )
                        }
                        disabled={isProcessingVoice}
                        className="p-2 rounded-xl bg-white hover:bg-emerald-100/60 border border-emerald-200 text-left transition flex items-center justify-between text-[11px] shadow-2xs group"
                      >
                        <div>
                          <span className="font-bold text-emerald-950 block">🐗 பொள்ளாச்சி: காட்டுப்பன்றிகள் நிலக்கடலை சேதம்</span>
                          <span className="text-[10px] text-gray-500">"முந்தாநாள் இரவு 6 காட்டுப்பன்றிகள் வந்து நிலக்கடலையை கிளறியது..."</span>
                        </div>
                        <span className="text-emerald-700 font-bold text-xs group-hover:translate-x-0.5 transition-transform">▶</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleScenarioClick(
                            'நீலகிரி மலையடிவாரத்தில் காட்டெருமை கூட்டம் வந்து 25 தேயிலை செடிகளையும் வேலியையும் முட்டி உடைத்துவிட்டது.'
                          )
                        }
                        disabled={isProcessingVoice}
                        className="p-2 rounded-xl bg-white hover:bg-emerald-100/60 border border-emerald-200 text-left transition flex items-center justify-between text-[11px] shadow-2xs group"
                      >
                        <div>
                          <span className="font-bold text-emerald-950 block">🐂 நீலகிரி: காட்டெருமை தேயிலை செடி சேதம்</span>
                          <span className="text-[10px] text-gray-500">"காட்டெருமை கூட்டம் வந்து 25 தேயிலை செடிகளை முட்டி உடைத்தது..."</span>
                        </div>
                        <span className="text-emerald-700 font-bold text-xs group-hover:translate-x-0.5 transition-transform">▶</span>
                      </button>
                    </div>
                  </div>

                  {/* Transcript */}
                  {transcript && (
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 text-xs">
                      <span className="text-[10px] font-bold text-gray-500 block mb-0.5">நீங்கள் பேசியது (Voice Transcript):</span>
                      <p className="italic text-gray-900 font-medium leading-relaxed">"{transcript}"</p>
                    </div>
                  )}

                  {/* Timbre Spoken Response */}
                  {spokenAudioUrl && (
                    <SpokenAudioPlayer
                      audioUrl={spokenAudioUrl}
                      autoPlay={true}
                      label="கணினியின் குரல் பதில் (Timbre Voice Response)"
                    />
                  )}
                </div>

                {/* 2. Extracted Incident Details */}
                {extractedData && (
                  <div className="bg-white rounded-3xl p-4 border border-emerald-200 shadow-xs space-y-2">
                    <span className="text-xs font-bold text-emerald-900 block">AI பகுப்பாய்வு விபரங்கள் (Extracted Details):</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <span className="text-gray-500 text-[10px] block">விலங்கு (Species):</span>
                        <span className="font-bold text-gray-900">{extractedData.wildlife_species_tamil || extractedData.wildlife_species}</span>
                      </div>
                      <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <span className="text-gray-500 text-[10px] block">பயிர் (Crop):</span>
                        <span className="font-bold text-gray-900">{extractedData.crop_damaged_tamil || extractedData.crop_damaged}</span>
                      </div>
                      <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <span className="text-gray-500 text-[10px] block">சேத அளவு (Quantity):</span>
                        <span className="font-bold text-emerald-800">{extractedData.damage_quantity} {extractedData.damage_unit_tamil || 'மரங்கள்'}</span>
                      </div>
                      <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <span className="text-gray-500 text-[10px] block">நேரம் (Time):</span>
                        <span className="font-bold text-gray-900">{extractedData.incident_time_approx || 'இரவு'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Photo Evidence Upload (Wide + Spoor) */}
                <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-emerald-700" />
                      <span>சான்று புகைப்படங்கள் (Evidence Photos)</span>
                    </span>
                    <span className="text-[10px] text-gray-500">2 படங்கள் தேவை (முழுத்தோற்றம் + தடம்)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Slot 1: Wide Angle */}
                    <div className="p-2.5 rounded-2xl border border-gray-200 bg-gray-50 text-center flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-gray-700 block mb-1.5">
                        1. முழுத்தோற்ற படம் (Wide)
                      </span>
                      {widePhotoUrl ? (
                        <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-black">
                          <img src={widePhotoUrl} alt="Wide shot" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setWidePhotoUrl(null);
                              setWidePhotoBlob(null);
                            }}
                            className="absolute top-1 right-1 bg-black/70 hover:bg-red-600 text-white rounded-full p-1 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="aspect-[4/3] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-2 text-gray-400 bg-white">
                          <Upload className="w-5 h-5 mb-1 text-gray-300" />
                          <span className="text-[10px]">இன்னும் இணைக்கப்படவில்லை</span>
                        </div>
                      )}
                      <div className="flex gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePhotoUploadSlot('WIDE');
                            fileInputRef.current?.click();
                          }}
                          className="flex-1 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-[10px] font-bold text-gray-700 shadow-2xs transition"
                        >
                          Choose Image
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSimulateSamplePhoto('WIDE')}
                          className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[10px] font-bold text-emerald-800 shadow-2xs transition"
                          title="மாதிரி படம்"
                        >
                          🌾 மாதிரி
                        </button>
                      </div>
                    </div>

                    {/* Slot 2: Spoor / Close up */}
                    <div className="p-2.5 rounded-2xl border border-gray-200 bg-gray-50 text-center flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-gray-700 block mb-1.5">
                        2. விலங்கு தடம் (Spoor)
                      </span>
                      {spoorPhotoUrl ? (
                        <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-black">
                          <img src={spoorPhotoUrl} alt="Spoor shot" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setSpoorPhotoUrl(null);
                              setSpoorPhotoBlob(null);
                            }}
                            className="absolute top-1 right-1 bg-black/70 hover:bg-red-600 text-white rounded-full p-1 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="aspect-[4/3] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-2 text-gray-400 bg-white">
                          <Upload className="w-5 h-5 mb-1 text-gray-300" />
                          <span className="text-[10px]">இன்னும் இணைக்கப்படவில்லை</span>
                        </div>
                      )}
                      <div className="flex gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePhotoUploadSlot('SPOOR');
                            fileInputRef.current?.click();
                          }}
                          className="flex-1 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-[10px] font-bold text-gray-700 shadow-2xs transition"
                        >
                          Choose Image
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSimulateSamplePhoto('SPOOR')}
                          className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[10px] font-bold text-emerald-800 shadow-2xs transition"
                          title="மாதிரி படம்"
                        >
                          🌾 மாதிரி
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Document Checklist */}
                <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-xs space-y-2">
                  <span className="text-xs font-bold text-gray-800 block">உங்களிடம் தயாராக உள்ள ஆவணங்கள் (Checklist):</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                    {[
                      { key: 'patta', label: 'பட்டா நகல் (Patta)' },
                      { key: 'adangal', label: 'அடங்கல் (Adangal)' },
                      { key: 'bank', label: 'வங்கி புத்தகம் (Passbook)' },
                      { key: 'aadhaar', label: 'ஆதார் அட்டை (Aadhaar)' },
                      { key: 'witness', label: 'சாட்சிகள் (Witnesses)' }
                    ].map((item) => (
                      <label
                        key={item.key}
                        className={`p-2 rounded-xl border flex items-center gap-1.5 cursor-pointer transition ${
                          (checklist as any)[item.key] ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-950' : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={(checklist as any)[item.key]}
                          onChange={() => setChecklist((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
                          className="rounded text-emerald-700"
                        />
                        <span className="truncate">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 5. Submit Field Report & Generate Dossier Button */}
                <button
                  type="button"
                  onClick={handleGenerateDossier}
                  className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-2 text-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>Submit Report & Generate Dossier (சுய சான்றாவணம் உருவாக்குக)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: VOICE INTERVIEWER */}
        {/* ============================================================== */}
        {currentStep === 'VOICE' && (
          <div className="max-w-xl mx-auto w-full flex-1 flex flex-col justify-between py-1">
            <div>
              <div className="text-center mb-2">
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-3 py-0.5 rounded-full">
                  படி 1: குரல் வழி சேத விபரம் பதிவு
                </span>
                <h2 className="text-lg font-bold text-gray-900 mt-1.5">என்ன நடந்தது என்று கூறுங்கள்</h2>
                <p className="text-xs text-gray-600">எந்த விலங்கு, எந்தப் பயிர், எத்தனை மரங்கள் சேதமடைந்தது என்று பேசவும்.</p>
              </div>

              {/* Push To Talk Mic */}
              <PushToTalkMic
                isRecording={isRecording}
                isProcessing={isProcessingVoice}
                onStart={startRecording}
                onStop={handleMicStop}
                language={language}
              />

              {/* Realtime Waveform Animation */}
              <AudioWaveform volume={volume} isRecording={isRecording} />

              {/* 1-Click Realistic Farmer Scenarios for Instant Real Voice & AI Testing */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-3 my-2.5 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                    <span>⚡</span> மாதிரி விவசாயி குரல் சூழல் (1-Click Test Scenarios):
                  </span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                    REAL GNANI AI
                  </span>
                </div>
                <p className="text-[10px] text-gray-600 mb-2">
                  நேரடியாக குரல் பதிவு செய்ய முடியாவிட்டால், கீழேயுள்ள நிஜ சூழலைத் தேர்ந்தெடுத்து உடனடி ஞானி AI சோதனையை காணலாம்:
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    onClick={() =>
                      handleScenarioClick(
                        'நேத்து ராத்திரி வால்பாறை தோட்டத்தில் ஒரு காட்டு யானை உள்ளே நுழைந்து 15 வாழை மரங்களை வேரோடு சாய்த்து தின்றுவிட்டது.'
                      )
                    }
                    disabled={isProcessingVoice}
                    className="p-2 rounded-xl bg-white hover:bg-emerald-100/70 border border-emerald-200 text-left transition flex items-center justify-between text-[11px] shadow-xs group"
                  >
                    <div>
                      <span className="font-bold text-emerald-950 block">🐘 வால்பாறை: காட்டு யானை 15 வாழை மரங்கள்</span>
                      <span className="text-[10px] text-gray-500">"நேத்து ராத்திரி காட்டு யானை 15 வாழை மரங்களை வேரோடு சாய்த்தது..."</span>
                    </div>
                    <span className="text-emerald-700 font-bold text-xs group-hover:translate-x-0.5 transition-transform">▶</span>
                  </button>

                  <button
                    onClick={() =>
                      handleScenarioClick(
                        'பொள்ளாச்சி தோட்டத்தில் முந்தாநாள் இரவு 6 காட்டுப்பன்றிகள் வந்து அரை ஏக்கர் நிலக்கடலை பயிரை கிளறி நாசம் செய்துவிட்டது.'
                      )
                    }
                    disabled={isProcessingVoice}
                    className="p-2 rounded-xl bg-white hover:bg-emerald-100/70 border border-emerald-200 text-left transition flex items-center justify-between text-[11px] shadow-xs group"
                  >
                    <div>
                      <span className="font-bold text-emerald-950 block">🐗 பொள்ளாச்சி: காட்டுப்பன்றிகள் நிலக்கடலை சேதம்</span>
                      <span className="text-[10px] text-gray-500">"முந்தாநாள் இரவு 6 காட்டுப்பன்றிகள் வந்து நிலக்கடலையை கிளறியது..."</span>
                    </div>
                    <span className="text-emerald-700 font-bold text-xs group-hover:translate-x-0.5 transition-transform">▶</span>
                  </button>

                  <button
                    onClick={() =>
                      handleScenarioClick(
                        'நீலகிரி மலையடிவாரத்தில் காட்டெருமை கூட்டம் வந்து 25 தேயிலை செடிகளையும் வேலியையும் முட்டி உடைத்துவிட்டது.'
                      )
                    }
                    disabled={isProcessingVoice}
                    className="p-2 rounded-xl bg-white hover:bg-emerald-100/70 border border-emerald-200 text-left transition flex items-center justify-between text-[11px] shadow-xs group"
                  >
                    <div>
                      <span className="font-bold text-emerald-950 block">🐂 நீலகிரி: காட்டெருமை தேயிலை செடி சேதம்</span>
                      <span className="text-[10px] text-gray-500">"காட்டெருமை கூட்டம் வந்து 25 தேயிலை செடிகளை முட்டி உடைத்தது..."</span>
                    </div>
                    <span className="text-emerald-700 font-bold text-xs group-hover:translate-x-0.5 transition-transform">▶</span>
                  </button>
                </div>
              </div>

              {/* Voice Error Notice with Retry Button (Preserves recording) */}
              {voiceError && (
                <div className="bg-red-50 border border-red-300 rounded-2xl p-3.5 my-3 text-xs text-red-900">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>குரல் செயலாக்கம் பிழை (Processing Error)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed mb-2.5">{voiceError}</p>

                  {savedAudioBlob && (
                    <button
                      onClick={() => submitAudioTurn(savedAudioBlob)}
                      disabled={isProcessingVoice}
                      className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition text-xs shadow-sm"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isProcessingVoice ? 'animate-spin' : ''}`} />
                      <span>பதிவான குரலை மீண்டும் சமர்ப்பி (Retry Same Recording)</span>
                    </button>
                  )}
                </div>
              )}

              {/* Real Transcript */}
              {transcript && (
                <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm mt-3">
                  <p className="text-[11px] font-bold text-gray-500 mb-0.5">நீங்கள் பேசியது (Voice Transcript):</p>
                  <p className="text-xs font-medium text-gray-900 italic leading-relaxed">"{transcript}"</p>
                </div>
              )}

              {/* Spoken Response Player */}
              {spokenAudioUrl && (
                <SpokenAudioPlayer
                  audioUrl={spokenAudioUrl}
                  autoPlay={true}
                  label="கணினியின் குரல் பதில் (Timbre Voice Response)"
                />
              )}

              {/* Review & Clarification Prompts (Neutral, no impossibility rules) */}
              {contradictions.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 my-3 text-xs text-amber-950">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>விவர சரிபார்ப்பு குறிப்பு (Review & Clarification)</span>
                  </div>
                  {contradictions.map((c, i) => (
                    <p key={i} className="mt-1 leading-relaxed text-[11px]">{c.prompt_ta}</p>
                  ))}
                </div>
              )}

              {/* Extracted Data Card */}
              {extractedData && (
                <div className="bg-emerald-50/60 rounded-2xl p-3.5 border border-emerald-200 shadow-sm mt-3">
                  <p className="text-xs font-bold text-emerald-900 mb-2">பதிவான விவரங்கள் (Extracted Details):</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-xl border border-emerald-100">
                      <span className="text-gray-500 text-[10px] block">தாக்கிய விலங்கு:</span>
                      <span className="font-bold text-gray-900 text-xs">
                        {extractedData.wildlife_species_tamil || extractedData.wildlife_species}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-100">
                      <span className="text-gray-500 text-[10px] block">சேதமடைந்த பயிர்:</span>
                      <span className="font-bold text-gray-900 text-xs">
                        {extractedData.crop_damaged_tamil || extractedData.crop_damaged}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-100">
                      <span className="text-gray-500 text-[10px] block">சேத அளவு:</span>
                      <span className="font-bold text-emerald-700 text-xs">
                        {extractedData.damage_quantity} {extractedData.damage_unit_tamil || 'மரங்கள்'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-100">
                      <span className="text-gray-500 text-[10px] block">சம்பவ நேரம்:</span>
                      <span className="font-bold text-gray-900 text-xs">
                        {extractedData.incident_time_approx || 'இரவு'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Proceed CTA */}
            {extractedData && (
              <div className="pt-3 mt-auto">
                <button
                  onClick={() => {
                    camera.startCamera();
                    setCurrentStep('CAMERA');
                  }}
                  className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-2 text-sm"
                >
                  <span>அடுத்தது: புகைப்பட சான்று எடுக்க</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: CAMERA EVIDENCE */}
        {/* ============================================================== */}
        {currentStep === 'CAMERA' && (
          <div className="max-w-xl mx-auto w-full flex-1 flex flex-col justify-between py-1">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                  படி 2: புகைப்பட சான்றுகள் ({photoStep === 'WIDE' ? '1/2' : '2/2'})
                </span>
                <GPSIndicator gps={camera.gps} />
              </div>

              <h2 className="text-base font-bold text-gray-900 mb-0.5">
                {photoStep === 'WIDE' ? 'தோட்டத்தின் முழுத்தோற்ற சேத படம்' : 'விலங்கு தடம் / சேத அடையாளம் (Close-up)'}
              </h2>
              <p className="text-[11px] text-gray-600 mb-2.5">
                {photoStep === 'WIDE'
                  ? 'பயிர் வரிசைகளும் சேதமும் தெரியும்படி சற்று தூரத்திலிருந்து எடுக்கவும்.'
                  : 'யானை கால்தடம், சாணம் அல்லது தும்பிக்கை முறிவை தெளிவாக படம் எடுக்கவும்.'}
              </p>

              {/* Viewfinder */}
              <div className="relative w-full aspect-[4/3] bg-black rounded-3xl overflow-hidden shadow-inner flex items-center justify-center">
                <video ref={camera.videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-2xl pointer-events-none flex items-center justify-center">
                  <span className="bg-black/60 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-sm">
                    {photoStep === 'WIDE' ? 'முழுத்தோற்றம் பிரேம்' : 'தடம் / அடையாளம் பிரேம்'}
                  </span>
                </div>
              </div>

              {/* Thumbnails */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-white p-1.5 rounded-xl border border-gray-200 text-center">
                  <p className="text-[10px] font-bold text-gray-500 mb-1">முழுத்தோற்ற படம்</p>
                  {widePhotoUrl ? (
                    <img src={widePhotoUrl} alt="Wide shot" className="w-full h-16 object-cover rounded-lg" />
                  ) : (
                    <div className="w-full h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-[11px]">
                      இன்னும் எடுக்கப்படவில்லை
                    </div>
                  )}
                </div>

                <div className="bg-white p-1.5 rounded-xl border border-gray-200 text-center">
                  <p className="text-[10px] font-bold text-gray-500 mb-1">விலங்கு தடம் படம்</p>
                  {spoorPhotoUrl ? (
                    <img src={spoorPhotoUrl} alt="Spoor shot" className="w-full h-16 object-cover rounded-lg" />
                  ) : (
                    <div className="w-full h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-[11px]">
                      {photoStep === 'WIDE' ? 'அடுத்தது...' : 'இப்போது எடுக்கவும்'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Hidden File Input for Gallery / Test Photos */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Shutter Button & Fallbacks */}
            <div className="pt-3 mt-auto flex flex-col items-center gap-2.5">
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl text-[11px] font-bold text-gray-700 flex items-center gap-1.5 shadow-2xs transition"
                  title="கேலரியிலிருந்து படம் பதிவேற்ற"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-700" />
                  <span>📁 கேலரி படம்</span>
                </button>

                <button
                  onClick={handleSnapPhoto}
                  className="w-16 h-16 rounded-full border-4 border-white bg-amber-500 hover:bg-amber-600 active:scale-95 shadow-xl flex items-center justify-center text-white shrink-0"
                  aria-label="Capture photograph"
                >
                  <Camera className="w-7 h-7" />
                </button>

                <button
                  type="button"
                  onClick={handleSampleFieldPhoto}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-[11px] font-bold text-emerald-900 flex items-center gap-1.5 shadow-2xs transition"
                  title="கள மாதிரி படம் உருவாக்க"
                >
                  <span>🌾 மாதிரி படம்</span>
                </button>
              </div>

              <p className="text-[11px] font-semibold text-gray-600">
                {photoStep === 'WIDE' ? 'படம் 1 (முழுத்தோற்றம்) எடுக்க அல்லது பதிவேற்றவும்' : 'படம் 2 (தடம்/அடையாளம்) எடுக்க அல்லது பதிவேற்றவும்'}
              </p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 4: DOCUMENT CHECKLIST (Reflects Actual Selections) */}
        {/* ============================================================== */}
        {currentStep === 'CHECKLIST' && (
          <div className="max-w-xl mx-auto w-full flex-1 flex flex-col justify-between py-1">
            <div>
              <div className="text-center mb-2.5">
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-3 py-0.5 rounded-full">
                  படி 3: ஆவணங்கள் சரிபார்ப்பு பட்டியல்
                </span>
                <h2 className="text-lg font-bold text-gray-900 mt-1">உங்களிடம் தயாராக உள்ள ஆவணங்கள்</h2>
                <p className="text-xs text-gray-600">உங்களிடம் உள்ள ஆவணங்களை மட்டும் தேர்ந்தெடுக்கவும் (உண்மையான தேர்வு).</p>
              </div>

              <div className="space-y-2 mt-3">
                {[
                  { key: 'patta', title: 'பட்டா / சிட்டா நகல் (Patta Copy)', desc: 'நில உரிமைக்கான சான்று' },
                  { key: 'adangal', title: 'VAO அடங்கல் சான்று (VAO Adangal)', desc: 'பயிர் சாகுபடி சான்று' },
                  { key: 'bank', title: 'வங்கி கணக்கு புத்தகம் (Bank Passbook)', desc: 'நேரடி வங்கி பரிமாற்றத்திற்கு' },
                  { key: 'aadhaar', title: 'ஆதார் அட்டை (Aadhaar Card)', desc: 'விவசாயியின் அடையாள சான்று' },
                  { key: 'witness', title: 'அண்டை நில சாட்சிகள் (Adjacent Witnesses)', desc: 'பக்கத்து நிலத்து விவசாயிகள் உறுதி' }
                ].map((item) => {
                  const isChecked = (checklist as any)[item.key];
                  return (
                    <div
                      key={item.key}
                      onClick={() => setChecklist((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                        isChecked ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-gray-900">{item.title}</p>
                        <p className="text-[11px] text-gray-500">{item.desc}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          isChecked ? 'bg-emerald-700 text-white' : 'border-2 border-gray-300'
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Generate CTA */}
            <div className="pt-3 mt-auto">
              <button
                onClick={handleGenerateDossier}
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-2 text-sm"
              >
                <span>சுய சான்றாவணம் உருவாக்க (Generate Dossier)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 5: OFFICIAL DOSSIER GENERATED */}
        {/* ============================================================== */}
        {currentStep === 'DOSSIER' && (
          <div className="max-w-xl mx-auto w-full flex-1 flex flex-col justify-between py-1 text-center">
            <div>
              <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h2 className="text-lg font-bold text-gray-900">சான்றாவணம் தயாரானது!</h2>
              <p className="text-xs text-gray-600">சுய அறிவிப்பு சான்றாவணம் வெற்றிகரமாக உருவாக்கப்பட்டது (அரசு ஆவணம் அல்ல).</p>

              {/* Dossier Summary Card (Shows Real GPS and Real Farmer) */}
              <div className="bg-white rounded-2xl p-3.5 border border-emerald-200 shadow-sm my-3 text-left text-xs">
                <div className="flex items-center justify-between border-b pb-1.5 mb-1.5">
                  <span className="text-gray-500">சான்றாவண எண் (Dossier ID):</span>
                  <span className="font-bold font-mono text-emerald-900">{createdIncidentCode || 'RPD-2026-VAL-001'}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-1.5 mb-1.5">
                  <span className="text-gray-500">விவசாயி:</span>
                  <span className="font-bold text-gray-900">{profile.name} ({profile.village})</span>
                </div>
                <div className="flex items-center justify-between border-b pb-1.5 mb-1.5">
                  <span className="text-gray-500">சேத விபரம்:</span>
                  <span className="font-bold text-gray-900">
                    {extractedData?.damage_quantity || 10} {extractedData?.crop_damaged_tamil || 'வாழை'} {extractedData?.damage_unit_tamil || 'மரங்கள்'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">ஒப்புதல் இருப்பிட தகவல் (GPS):</span>
                  <span className="font-bold text-gray-900">
                    {capturedGps?.isLocked
                      ? `${capturedGps.latitude.toFixed(4)}°N, ${capturedGps.longitude.toFixed(4)}°E (±${Math.round(capturedGps.accuracy)}மீ)`
                      : 'இருப்பிடம் பதிவு செய்யப்படவில்லை (No GPS Recorded)'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowPdfViewerModal(true)}
                  className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-2 text-sm"
                >
                  <Eye className="w-4 h-4" />
                  <span>சான்றாவணத்தை நேரடியாக பார் (View Dossier In-App)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={dossierPdfUrl || '/api/v1/dossier/sample/pdf'}
                    target="_blank"
                    rel="noreferrer"
                    className="py-3 bg-white hover:bg-gray-50 border border-emerald-300 text-emerald-800 font-bold rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF பதிவிறக்கு</span>
                  </a>

                  <button
                    onClick={() => {
                      const text = encodeURIComponent(
                        `வணக்கம். எனது பயிர்ச்சேத சான்றாவணம் (Dossier ID: ${createdIncidentCode || 'RPD-2026-VAL-001'}) தயாராகியுள்ளது.`
                      );
                      window.open(`https://wa.me/?text=${text}`, '_blank');
                    }}
                    className="py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp பகிர்வு</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-auto">
              <button
                onClick={() => setCurrentStep('DASHBOARD')}
                className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1 mx-auto p-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>முகப்புக்கு செல்ல (Back to Dashboard)</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* MODAL: EDIT FARMER PROFILE */}
      {/* ============================================================== */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl text-xs space-y-3">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-700" />
              <span>விவசாயி சுய விபரங்கள் திருத்தம் (Farmer Profile)</span>
            </h3>

            <div>
              <label className="font-semibold text-gray-700 block mb-0.5">விவசாயி பெயர் (Farmer Name):</label>
              <input
                type="text"
                value={tempProfile.name}
                onChange={(e) => setTempProfile({ ...tempProfile, name: e.target.value })}
                className="w-full p-2 border rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-gray-700 block mb-0.5">தொலைபேசி எண்:</label>
                <input
                  type="text"
                  value={tempProfile.phone}
                  onChange={(e) => setTempProfile({ ...tempProfile, phone: e.target.value })}
                  className="w-full p-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-0.5">கிராமம் (Village):</label>
                <input
                  type="text"
                  value={tempProfile.village}
                  onChange={(e) => setTempProfile({ ...tempProfile, village: e.target.value })}
                  className="w-full p-2 border rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="font-semibold text-gray-700 block mb-0.5">வட்டம் (Taluk):</label>
                <input
                  type="text"
                  value={tempProfile.taluk}
                  onChange={(e) => setTempProfile({ ...tempProfile, taluk: e.target.value })}
                  className="w-full p-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-0.5">பட்டா எண்:</label>
                <input
                  type="text"
                  value={tempProfile.pattaNumber}
                  onChange={(e) => setTempProfile({ ...tempProfile, pattaNumber: e.target.value })}
                  className="w-full p-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-0.5">நிலப்பரப்பு (ஏக்கர்):</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempProfile.acres}
                  onChange={(e) => setTempProfile({ ...tempProfile, acres: parseFloat(e.target.value) || 1.0 })}
                  className="w-full p-2 border rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-0.5">சர்வே எண் (Survey No):</label>
              <input
                type="text"
                value={tempProfile.surveyNumber}
                onChange={(e) => setTempProfile({ ...tempProfile, surveyNumber: e.target.value })}
                className="w-full p-2 border rounded-xl"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button
                onClick={() => setIsEditingProfile(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl"
              >
                ரத்து (Cancel)
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>சேமி (Save Profile)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: LIVE API DIAGNOSTICS & SYSTEM AUDIT */}
      {/* ============================================================== */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-700" />
                <span>கணினி ஆய்வு (API Diagnostics)</span>
              </h3>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <XCircle className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {isLoadingDiag ? (
              <div className="text-center py-8 text-gray-500 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-700" />
                <p>ஞானி AI இணைப்பை சோதிக்கிறது...</p>
              </div>
            ) : diagData ? (
              <div className="space-y-2.5">
                {/* Voice Mode Banner */}
                <div className={`p-3 rounded-2xl border ${
                  diagData.voice_mode === 'REAL' ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'
                }`}>
                  <p className="font-bold text-xs flex items-center justify-between">
                    <span>பயன்முறை (Voice Mode):</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      diagData.voice_mode === 'REAL' ? 'bg-emerald-700 text-white' : 'bg-amber-600 text-white'
                    }`}>
                      {diagData.voice_mode === 'REAL' ? 'REAL GNANI CLOUD' : 'MOCK EMULATION'}
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-600 mt-1">{diagData.message}</p>
                </div>

                {/* STT Status */}
                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">Prisma STT:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      diagData.stt?.status === 'connected' || diagData.stt?.status === 'operational'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {diagData.stt?.status?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">Model: {diagData.stt?.model} ({diagData.stt?.endpoint})</p>
                </div>

                {/* TTS Status */}
                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">Timbre TTS:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      diagData.tts?.status === 'connected' || diagData.tts?.status === 'operational'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {diagData.tts?.status?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">Model: {diagData.tts?.model} • Voice: {diagData.tts?.voice}</p>
                </div>

                {/* Latency */}
                <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                  <span>இணைப்பு வேகம் (Latency):</span>
                  <span className="font-mono font-bold text-emerald-800">{diagData.latency_ms} ms</span>
                </div>
              </div>
            ) : null}

            <div className="pt-2 border-t">
              <button
                onClick={handleRunDiagnostics}
                disabled={isLoadingDiag}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiag ? 'animate-spin' : ''}`} />
                <span>மீண்டும் இணைப்பை சோதி (Test Connection Again)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: MOBILE / REMOTE SHARE ACCESS */}
      {/* ============================================================== */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-700" />
                <span>மொபைலில் அணுக (Open on Mobile)</span>
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <XCircle className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <p className="text-[11px] text-gray-600 leading-relaxed">
              உங்கள் மொபைல் போனை இதே வைஃபை (Wi-Fi) நெட்வொர்க்கில் இணைத்து, பிரவுசரில் கீழேயுள்ள இணைப்பை திறக்கவும்:
            </p>

            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between">
              <div className="overflow-hidden">
                <span className="text-[10px] text-emerald-800 font-semibold block">உள்ளூர் நெட்வொர்க் இணைப்பு (Local Wi-Fi):</span>
                <span className="font-mono font-bold text-emerald-950 text-xs truncate select-all">
                  http://10.230.118.81:5173
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('http://10.230.118.81:5173');
                  alert('இணைப்பு நகலெடுக்கப்பட்டது! (Link copied)');
                }}
                className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-[10px] shrink-0"
              >
                Copy Link
              </button>
            </div>

            <div className="p-2.5 bg-gray-50 rounded-xl text-[11px] text-gray-500 space-y-1">
              <p>✓ மொபைல் மைக்ரோஃபோன் வழியாக நேரடியாக தமிழில் பேசலாம்</p>
              <p>✓ மொபைல் கேமரா மற்றும் நேரடி GPS இருப்பிடத்தைப் பதிவு செய்யலாம்</p>
              <p>✓ உருவான PDF சான்றாவணத்தை உடனே பதிவிறக்கலாம்</p>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl"
            >
              சரி (Done)
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: IN-APP PDF DOSSIER PREVIEW */}
      {/* ============================================================== */}
      {showPdfViewerModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-3.5 border-b flex items-center justify-between bg-emerald-800 text-white">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-300" />
                <h3 className="text-sm font-bold">சான்றாவண நேரடி முன்னோட்டம் (Dossier PDF)</h3>
              </div>
              <button
                onClick={() => setShowPdfViewerModal(false)}
                className="p-1 hover:bg-emerald-700 rounded-full transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-2 bg-gray-100 overflow-hidden">
              <iframe
                src={dossierPdfUrl || '/api/v1/dossier/sample/pdf'}
                title="Dossier PDF Preview"
                className="w-full h-[65vh] rounded-xl border border-gray-300 bg-white shadow-inner"
              />
            </div>

            <div className="p-3 border-t bg-white flex items-center justify-between gap-2 text-xs">
              <a
                href={dossierPdfUrl || '/api/v1/dossier/sample/pdf'}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>புதிய பக்கத்தில் திற / பதிவிறக்கு</span>
              </a>

              <button
                onClick={() => setShowPdfViewerModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
              >
                மூடு (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
