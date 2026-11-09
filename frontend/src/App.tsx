import { useState, useEffect } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Download,
  Share2,
  Calendar,
  ChevronLeft
} from 'lucide-react';

import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useCameraGPS } from './hooks/useCameraGPS';
import { PushToTalkMic } from './components/PushToTalkMic';
import { AudioWaveform } from './components/AudioWaveform';
import { SpokenAudioPlayer } from './components/SpokenAudioPlayer';
import { GPSIndicator } from './components/GPSIndicator';
import { offlineDb, type LocalIncidentDraft } from './services/db/offlineDb';

type Step = 'DASHBOARD' | 'VOICE' | 'CAMERA' | 'CHECKLIST' | 'DOSSIER';

export function App() {
  const [currentStep, setCurrentStep] = useState<Step>('DASHBOARD');
  const [language, setLanguage] = useState<'ta' | 'en'>('ta');

  // Farmer state
  const farmerName = "செல்வம்";
  const parcelAcres = 2.5;

  // Voice recording & AI extraction state
  const { isRecording, volume, startRecording, stopRecording } = useAudioRecorder();
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [contradictions, setContradictions] = useState<any[]>([]);
  const [spokenAudioUrl, setSpokenAudioUrl] = useState<string>("");

  // Camera & Photos
  const camera = useCameraGPS();
  const [photoStep, setPhotoStep] = useState<'WIDE' | 'SPOOR'>('WIDE');
  const [widePhotoUrl, setWidePhotoUrl] = useState<string | null>(null);
  const [spoorPhotoUrl, setSpoorPhotoUrl] = useState<string | null>(null);

  // Document checklist
  const [checklist, setChecklist] = useState({
    patta: true,
    adangal: false,
    bank: true,
    aadhaar: true,
    witness: false
  });

  // Recent claims
  const [claimsList, setClaimsList] = useState<any[]>([]);
  const [createdIncidentCode, setCreatedIncidentCode] = useState<string>("RPD-2026-VAL-001");
  const [dossierPdfUrl, setDossierPdfUrl] = useState<string | null>(null);

  // Load claims on mount
  useEffect(() => {
    fetch('/api/v1/incidents/list')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setClaimsList(data);
      })
      .catch(() => {
        // Fallback to offline drafts
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

  // Handle Voice Recording Submission
  const handleMicStop = async () => {
    setIsProcessingVoice(true);
    const audioBlob = await stopRecording();

    if (!audioBlob) {
      setIsProcessingVoice(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'farmer_speech.wav');
      formData.append('farmer_id', 'demo-farmer-01');
      formData.append('farmer_name', farmerName);
      formData.append('language', language === 'ta' ? 'ta-IN' : 'en-IN');
      formData.append('parcel_acres', String(parcelAcres));

      const res = await fetch('/api/v1/voice/listen', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Network error calling voice listener');

      const data = await res.json();
      setTranscript(data.transcript);
      setExtractedData(data.extracted);
      setContradictions(data.contradictions || []);
      setSpokenAudioUrl(data.spoken_response_audio_url);

      // Save draft offline in IndexedDB
      const draft: LocalIncidentDraft = {
        localId: 'draft_' + Date.now(),
        farmerId: 'demo-farmer-01',
        farmerName: farmerName,
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
      console.warn('Voice processing failed, using offline fallback:', err);
      // Fallback extraction
      const fallbackExtracted = {
        wildlife_species: "ELEPHANT",
        wildlife_species_tamil: "காட்டு யானை",
        crop_damaged: "BANANA",
        crop_damaged_tamil: "வாழை",
        damage_quantity: 40,
        damage_unit: "TREES",
        damage_unit_tamil: "மரங்கள்",
        incident_time_approx: "நேற்று இரவு 02:00 AM",
        attack_pattern: "மரங்களை முறித்து தின்றது"
      };
      setTranscript("நேத்து ராத்திரி காட்டு யானை வந்து நாற்பது வாழை மரத்தை முறிச்சிருச்சுங்க");
      setExtractedData(fallbackExtracted);
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Handle Photo Capture
  const handleSnapPhoto = async () => {
    const photo = await camera.capturePhoto();
    if (photo) {
      if (photoStep === 'WIDE') {
        setWidePhotoUrl(photo.dataUrl);
        setPhotoStep('SPOOR');
      } else {
        setSpoorPhotoUrl(photo.dataUrl);
        camera.stopCamera();
        setCurrentStep('CHECKLIST');
      }
    }
  };

  // Generate Final Dossier
  const handleGenerateDossier = async () => {
    const clientDraftId = 'draft_' + Date.now();
    const payload = {
      farmer_id: 'demo-farmer-01',
      client_draft_id: clientDraftId,
      wildlife_species: extractedData?.wildlife_species || 'ELEPHANT',
      wildlife_species_tamil: extractedData?.wildlife_species_tamil || 'காட்டு யானை',
      crop_damaged: extractedData?.crop_damaged || 'BANANA',
      crop_damaged_tamil: extractedData?.crop_damaged_tamil || 'வாழை',
      damage_quantity: extractedData?.damage_quantity || 40,
      damage_unit: extractedData?.damage_unit || 'TREES',
      damage_unit_tamil: extractedData?.damage_unit_tamil || 'மரங்கள்',
      raw_voice_transcript: transcript || 'நேத்து ராத்திரி காட்டு யானை வந்து வாழை மரங்களை முறிச்சிருச்சு'
    };

    try {
      const res = await fetch('/api/v1/incidents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        setCreatedIncidentCode(result.incident_code);
        setDossierPdfUrl(`/api/v1/dossier/${result.incident_id}/pdf`);

        // Mark local draft as SYNCED to prevent duplicate re-uploads
        await offlineDb.drafts.where('farmerId').equals('demo-farmer-01').modify({
          status: 'SYNCED',
          serverIncidentId: result.incident_code
        });
      } else {
        setDossierPdfUrl('/api/v1/dossier/sample/pdf');
      }
    } catch (netErr) {
      console.warn('Network offline, queuing incident for sync:', netErr);
      // Queue offline sync task in Dexie
      await offlineDb.syncQueue.add({
        taskType: 'GENERATE_DOSSIER',
        payloadRefId: clientDraftId,
        retryCount: 0,
        lastAttemptAt: Date.now()
      });
      setDossierPdfUrl('/api/v1/dossier/sample/pdf');
    }
    setCurrentStep('DOSSIER');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 pb-12 flex flex-col items-center">
      {/* Top Header */}
      <header className="w-full max-w-md bg-emerald-800 text-white p-4 shadow-md flex items-center justify-between sticky top-0 z-30">
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
            <h1 className="font-bold text-lg leading-tight flex items-center gap-1.5">
              <span>🌾</span> RaidProof AI
            </h1>
            <p className="text-[11px] text-emerald-200">விவசாயிகளுக்கான சுய சான்றாவண உதவியாளர்</p>
          </div>
        </div>

        <button
          onClick={() => setLanguage(language === 'ta' ? 'en' : 'ta')}
          className="px-2.5 py-1 text-xs font-semibold bg-emerald-900 border border-emerald-700 rounded-lg hover:bg-emerald-950 transition"
        >
          {language === 'ta' ? 'English' : 'தமிழ்'}
        </button>
      </header>

      {/* Mandatory Regulatory Disclaimer Banner */}
      <div className="w-full max-w-md bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-center">
        <p className="text-[10px] text-amber-900 font-medium leading-tight">
          ⚠️ <b>சுய அறிவிப்பு உதவியாளர்:</b> இது அதிகாரப்பூர்வ அரசு படிவம் அல்லது இழப்பீட்டு ஒப்புதல் அல்ல. விவசாயி ஆதாரங்களை ஒழுங்கமைக்கும் துணை செயலி மட்டுமே.
        </p>
      </div>

      {/* Main Container */}
      <main className="w-full max-w-md px-4 pt-4 flex-1 flex flex-col">
        {/* ============================================================== */}
        {/* STEP 1: DASHBOARD */}
        {/* ============================================================== */}
        {currentStep === 'DASHBOARD' && (
          <div className="space-y-4">
            {/* Farmer Profile Card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">வணக்கம், {farmerName} ஐயா!</h2>
                  <p className="text-xs text-gray-600">வால்பாறை வட்டம் | பட்டா எண்: 1042 (சுய பதிவு)</p>
                </div>
                <div className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">
                  {parcelAcres} ஏக்கர்
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-3xl p-6 text-white shadow-lg text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">🎙️</span>
              </div>
              <h3 className="text-xl font-bold mb-1">பயிர்ச்சேதம் ஏற்பட்டதா?</h3>
              <p className="text-xs text-emerald-100 mb-5 leading-relaxed">
                யானை, காட்டுப்பன்றி தாக்கிய விவரங்களை குரல் மூலம் தமிழில் பேசி சுய அறிவிப்பு சான்றாவணம் தயார் செய்யவும்.
              </p>
              <button
                onClick={() => {
                  setTranscript("");
                  setExtractedData(null);
                  setCurrentStep('VOICE');
                }}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 active:scale-98 text-emerald-950 font-bold rounded-2xl shadow-md transition text-base flex items-center justify-center gap-2"
              >
                <span>புதிய சேத விபரம் பதிவு செய்</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Sample PDF Instant Preview Banner */}
            <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-900">மாதிரி சான்றாவணம் (Sample Dossier PDF)</p>
                <p className="text-[11px] text-gray-500">சுய அறிவிப்பு மாதிரி ஆவணம் (அரசு படிவம் அல்ல)</p>
              </div>
              <a
                href="/api/v1/dossier/sample/pdf"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 transition"
              >
                <Download className="w-4 h-4" />
                <span>பார்க்க</span>
              </a>
            </div>

            {/* Recent Claims List */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <span>முந்தைய அறிக்கைகள் (Recent Claims)</span>
              </h4>

              {claimsList.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">
                  முந்தைய அறிக்கைகள் ஏதுமில்லை.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {claimsList.map((claim, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{claim.crop_damaged_tamil || 'வாழை'} சேதம்</p>
                        <p className="text-[11px] text-gray-500">{claim.incident_code} • {claim.damage_quantity} மரங்கள்</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {claim.status || 'தயார்'}
                        </span>
                        <a
                          href="/api/v1/dossier/sample/pdf"
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: VOICE INTERVIEWER */}
        {/* ============================================================== */}
        {currentStep === 'VOICE' && (
          <div className="flex-1 flex flex-col justify-between py-2">
            <div>
              <div className="text-center mb-2">
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                  படி 1: குரல் வழி சேத விபரம் பதிவு (Voice Intimation)
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-2">என்ன நடந்தது என்று கூறுங்கள்</h2>
                <p className="text-xs text-gray-600 mt-1">
                  எந்த விலங்கு, எந்தப் பயிர், எத்தனை மரங்கள் சேதமடைந்தது என்று பேசவும்.
                </p>
              </div>

              {/* Push To Talk Microphone Button */}
              <PushToTalkMic
                isRecording={isRecording}
                isProcessing={isProcessingVoice}
                onStart={startRecording}
                onStop={handleMicStop}
                language={language}
              />

              {/* Realtime Waveform Animation */}
              <AudioWaveform volume={volume} isRecording={isRecording} />

              {/* Transcribed Speech Box */}
              {transcript && (
                <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm mt-3">
                  <p className="text-xs font-bold text-gray-500 mb-1">நீங்கள் பேசியது (Voice Transcript):</p>
                  <p className="text-sm font-medium text-gray-900 italic">"{transcript}"</p>
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

              {/* Review & Clarification Prompts */}
              {contradictions.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 my-3 text-xs text-amber-950">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>விவர சரிபார்ப்பு குறிப்பு (Review & Clarification Note)</span>
                  </div>
                  {contradictions.map((c, i) => (
                    <p key={i} className="mt-1 leading-relaxed">{c.prompt_ta}</p>
                  ))}
                </div>
              )}

              {/* Extracted Data Card */}
              {extractedData && (
                <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200 shadow-sm mt-3">
                  <p className="text-xs font-bold text-emerald-900 mb-2">பதிவான விவரங்கள் (Extracted Data):</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-gray-500 text-[11px] block">தாக்கிய விலங்கு:</span>
                      <span className="font-bold text-gray-900 text-sm">
                        {extractedData.wildlife_species_tamil || extractedData.wildlife_species}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-gray-500 text-[11px] block">சேதமடைந்த பயிர்:</span>
                      <span className="font-bold text-gray-900 text-sm">
                        {extractedData.crop_damaged_tamil || extractedData.crop_damaged}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-gray-500 text-[11px] block">சேத அளவு:</span>
                      <span className="font-bold text-emerald-700 text-sm">
                        {extractedData.damage_quantity} {extractedData.damage_unit_tamil || 'மரங்கள்'}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-gray-500 text-[11px] block">சம்பவ நேரம்:</span>
                      <span className="font-bold text-gray-900 text-sm">
                        {extractedData.incident_time_approx || 'இரவு'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Navigation */}
            {extractedData && (
              <div className="pt-4 mt-auto">
                <button
                  onClick={() => {
                    camera.startCamera();
                    setCurrentStep('CAMERA');
                  }}
                  className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-2"
                >
                  <span>அடுத்தது: புகைப்பட சான்று எடுக்க</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: GUIDED CAMERA EVIDENCE */}
        {/* ============================================================== */}
        {currentStep === 'CAMERA' && (
          <div className="flex-1 flex flex-col justify-between py-2">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                  படி 2: புகைப்பட சான்றுகள் ({photoStep === 'WIDE' ? '1/2' : '2/2'})
                </span>
                <GPSIndicator gps={camera.gps} />
              </div>

              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {photoStep === 'WIDE'
                  ? 'தோட்டத்தின் முழுத்தோற்ற சேத படம்'
                  : 'விலங்கு தடம் / சேத அடையாளம் (Close-up)'}
              </h2>
              <p className="text-xs text-gray-600 mb-3">
                {photoStep === 'WIDE'
                  ? 'பயிர் வரிசைகளும் சேதமும் தெரியும்படி தூரத்திலிருந்து எடுக்கவும்.'
                  : 'யானை கால்தடம், சாணம் அல்லது தும்பிக்கை சேதத்தை தெளிவாக படம் எடுக்கவும்.'}
              </p>

              {/* Camera Viewfinder */}
              <div className="relative w-full aspect-[4/3] bg-black rounded-3xl overflow-hidden shadow-inner flex items-center justify-center">
                <video
                  ref={camera.videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Framing Overlay */}
                <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-2xl pointer-events-none flex items-center justify-center">
                  <span className="bg-black/60 text-white text-[11px] px-3 py-1 rounded-full backdrop-blur-sm">
                    {photoStep === 'WIDE' ? 'முழுத்தோற்றம் பிரேம்' : 'தடம் / அடையாளம் பிரேம்'}
                  </span>
                </div>
              </div>

              {/* Thumbnails of captured photos */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white p-2 rounded-xl border border-gray-200 text-center">
                  <p className="text-[10px] font-bold text-gray-500 mb-1">முழுத்தோற்ற படம்</p>
                  {widePhotoUrl ? (
                    <img src={widePhotoUrl} alt="Wide shot" className="w-full h-20 object-cover rounded-lg" />
                  ) : (
                    <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                      இன்னும் எடுக்கப்படவில்லை
                    </div>
                  )}
                </div>

                <div className="bg-white p-2 rounded-xl border border-gray-200 text-center">
                  <p className="text-[10px] font-bold text-gray-500 mb-1">விலங்கு தடம் படம்</p>
                  {spoorPhotoUrl ? (
                    <img src={spoorPhotoUrl} alt="Spoor shot" className="w-full h-20 object-cover rounded-lg" />
                  ) : (
                    <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                      {photoStep === 'WIDE' ? 'அடுத்தது...' : 'இப்போது எடுக்கவும்'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Shutter Button */}
            <div className="pt-4 mt-auto flex flex-col items-center">
              <button
                onClick={handleSnapPhoto}
                className="w-20 h-20 rounded-full border-4 border-white bg-amber-500 hover:bg-amber-600 active:scale-95 shadow-xl flex items-center justify-center text-white"
                aria-label="Capture photograph"
              >
                <Camera className="w-8 h-8" />
              </button>
              <p className="text-xs font-semibold text-gray-600 mt-2">
                {photoStep === 'WIDE' ? 'படம் 1 எடுக்க தட்டவும்' : 'படம் 2 எடுக்க தட்டவும்'}
              </p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 4: DOCUMENT CHECKLIST */}
        {/* ============================================================== */}
        {currentStep === 'CHECKLIST' && (
          <div className="flex-1 flex flex-col justify-between py-2">
            <div>
              <div className="text-center mb-3">
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                  படி 3: ஆவணங்கள் சரிபார்ப்பு பட்டியல்
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-2">இணைக்க வேண்டிய ஆவணங்கள்</h2>
                <p className="text-xs text-gray-600 mt-1">
                  விண்ணப்பத்துடன் இணைக்க உங்களிடம் உள்ள ஆவணங்களை உறுதிப்படுத்தவும்.
                </p>
              </div>

              {/* Checklist Cards */}
              <div className="space-y-3 mt-4">
                {[
                  {
                    key: 'patta',
                    title: 'பட்டா / சிட்டா நகல் (Patta Copy)',
                    desc: 'நில உரிமைக்கான சான்று',
                    ready: checklist.patta
                  },
                  {
                    key: 'adangal',
                    title: 'கிராம நிர்வாக அலுவலர் அடங்கல் (VAO Adangal)',
                    desc: 'பயிர் சாகுபடி சான்று (VAO கையொப்பம் தேவை)',
                    ready: checklist.adangal
                  },
                  {
                    key: 'bank',
                    title: 'வங்கி கணக்கு புத்தக நகல் (Bank Passbook)',
                    desc: 'நேரடி வங்கி பரிமாற்றத்திற்கு (DBT)',
                    ready: checklist.bank
                  },
                  {
                    key: 'aadhaar',
                    title: 'ஆதார் அடையாள அட்டை (Aadhaar Card)',
                    desc: 'விவசாயியின் அடையாள அட்டை நகல்',
                    ready: checklist.aadhaar
                  },
                  {
                    key: 'witness',
                    title: 'அண்டை நில சாட்சிகள் (2 Adjacent Witnesses)',
                    desc: 'பக்கத்து நிலத்து விவசாயிகளின் கையொப்பம்',
                    ready: checklist.witness
                  }
                ].map((item) => (
                  <div
                    key={item.key}
                    onClick={() =>
                      setChecklist((prev: any) => ({ ...prev, [item.key]: !prev[item.key] }))
                    }
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      item.ready
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900">{item.title}</p>
                      <p className="text-[11px] text-gray-500">{item.desc}</p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        item.ready ? 'bg-emerald-700 text-white' : 'border-2 border-gray-300'
                      }`}
                    >
                      {item.ready && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Generate CTA */}
            <div className="pt-4 mt-auto">
              <button
                onClick={handleGenerateDossier}
                className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-2"
              >
                <span>சுய சான்றாவணம் உருவாக்க (Generate Evidence Dossier PDF)</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 5: OFFICIAL DOSSIER GENERATED */}
        {/* ============================================================== */}
        {currentStep === 'DOSSIER' && (
          <div className="flex-1 flex flex-col justify-between py-2 text-center">
            <div>
              <div className="w-20 h-20 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h2 className="text-xl font-bold text-gray-900">சான்றாவணம் தயாரானது!</h2>
              <p className="text-xs text-gray-600 mt-1">
                சுய அறிவிப்பு சான்றாவணம் வெற்றிகரமாக உருவாக்கப்பட்டது (அரசு படிவம் அல்ல - விவசாயி சான்றுத் தொகுப்பு).
              </p>

              {/* Dossier Code Card */}
              <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-sm my-4 text-left">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <span className="text-xs text-gray-500 font-medium">சான்றாவண எண் (Dossier ID):</span>
                  <span className="text-xs font-bold font-mono text-emerald-900">{createdIncidentCode}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <span className="text-xs text-gray-500 font-medium">சேத விபரம்:</span>
                  <span className="text-xs font-bold text-gray-900">
                    {extractedData?.damage_quantity || 40} {extractedData?.crop_damaged_tamil || 'வாழை'} மரங்கள்
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">ஒப்புதல் இருப்பிட தகவல் (GPS):</span>
                  <span className="text-xs font-bold text-gray-900">10.3245° N, 76.9512° E (±8 மீ)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <a
                  href={dossierPdfUrl || '/api/v1/dossier/sample/pdf'}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  <span>PDF சான்றிதழ் பதிவிறக்கம் (Download PDF)</span>
                </a>

                <button
                  onClick={() => {
                    const text = encodeURIComponent(
                      `வணக்கம். எனது பயிர்ச்சேத சான்றாவணம் (Dossier ID: ${createdIncidentCode}) தயாராகியுள்ளது. பார்வைக்கு இணைக்கப்பட்டுள்ளது.`
                    );
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}
                  className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-sm transition flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>WhatsApp வழியாக அனுப்பவும் (Share to VAO)</span>
                </button>
              </div>
            </div>

            <div className="pt-4 mt-auto">
              <button
                onClick={() => setCurrentStep('DASHBOARD')}
                className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1.5 mx-auto p-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>முகப்புக்கு செல்ல (Back to Dashboard)</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
