export type Language = 'en' | 'ta';

export interface Translations {
  nav: {
    brand: string;
    tagline: string;
    mobileShare: string;
    diagnostics: string;
    realMode: string;
    mockMode: string;
  };
  disclaimer: {
    banner: string;
    legalNote: string;
  };
  dashboard: {
    farmerProfile: string;
    village: string;
    patta: string;
    surveyNo: string;
    acres: string;
    phone: string;
    edit: string;
    createReportTitle: string;
    createReportDesc: string;
    createReportBtn: string;
    guidedStepsBtn: string;
    connectionTitle: string;
    realConnDesc: string;
    mockConnDesc: string;
    diagnosticsBtn: string;
    sampleDossierTitle: string;
    sampleDossierDesc: string;
    viewSampleBtn: string;
    recentClaimsTitle: string;
    noClaims: string;
    statusReady: string;
  };
  fieldReport: {
    title: string;
    subtitle: string;
    backBtn: string;
    resetBtn: string;
    mapSectionTitle: string;
    mapSectionSubtitle: string;
    deviceGpsBtn: string;
    latitude: string;
    longitude: string;
    notSet: string;
    sourceDevice: string;
    sourcePin: string;
    accuracy: string;
    locationNameLabel: string;
    locationNamePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    voiceSectionTitle: string;
    voiceBadge: string;
    scenariosTitle: string;
    scenariosSubtitle: string;
    scenario1Title: string;
    scenario1Text: string;
    scenario2Title: string;
    scenario2Text: string;
    scenario3Title: string;
    scenario3Text: string;
    transcriptLabel: string;
    audioResponseLabel: string;
    clarificationTitle: string;
    extractedSectionTitle: string;
    wildlifeSpecies: string;
    cropDamaged: string;
    damageQuantity: string;
    incidentTime: string;
    photosSectionTitle: string;
    photosSubtitle: string;
    widePhotoTitle: string;
    spoorPhotoTitle: string;
    notUploaded: string;
    chooseImage: string;
    samplePhoto: string;
    checklistTitle: string;
    checklistSubtitle: string;
    checklistPatta: string;
    checklistAdangal: string;
    checklistBank: string;
    checklistAadhaar: string;
    checklistWitness: string;
    submitReportBtn: string;
    submitting: string;
  };
  dossier: {
    readyTitle: string;
    readySubtitle: string;
    dossierId: string;
    farmerName: string;
    damageSummary: string;
    gpsCoordinates: string;
    noGpsRecorded: string;
    viewInAppBtn: string;
    downloadPdfBtn: string;
    shareWhatsAppBtn: string;
    backToDashboard: string;
    previewTitle: string;
    openInNewTab: string;
    close: string;
  };
  profileModal: {
    title: string;
    name: string;
    phone: string;
    village: string;
    taluk: string;
    patta: string;
    acres: string;
    survey: string;
    cancel: string;
    save: string;
  };
  mobileModal: {
    title: string;
    instructions: string;
    networkUrlLabel: string;
    copyLink: string;
    copied: string;
    bullet1: string;
    bullet2: string;
    bullet3: string;
    done: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    nav: {
      brand: "RaidProof AI",
      tagline: "Farmer Wildlife Damage Dossier Assistant",
      mobileShare: "Mobile Access",
      diagnostics: "Diagnostics",
      realMode: "GNANI CLOUD",
      mockMode: "MOCK EMULATION"
    },
    disclaimer: {
      banner: "Self-Declaration Dossier: This is not an official government compensation approval. All wildlife claims are subject to official field inspection.",
      legalNote: "Regulatory Notice: AI extraction assists the farmer in assembling evidence; it does not adjudicate claims."
    },
    dashboard: {
      farmerProfile: "Farmer Profile",
      village: "Village",
      patta: "Patta No",
      surveyNo: "Survey No",
      acres: "Acres",
      phone: "Phone",
      edit: "Edit Profile",
      createReportTitle: "Wildlife Crop Damage Incident?",
      createReportDesc: "Record your statement in Tamil or English, pin your farm on the map, attach evidence photos, and generate an official self-declaration dossier in under 3 minutes.",
      createReportBtn: "Create Field Report",
      guidedStepsBtn: "Step-by-Step Mode",
      connectionTitle: "AI Voice Engine Status",
      realConnDesc: "Connected to Gnani Prisma STT & Timbre TTS cloud services.",
      mockConnDesc: "Operating in local simulation mode.",
      diagnosticsBtn: "System Health",
      sampleDossierTitle: "Sample Dossier Preview",
      sampleDossierDesc: "View a standard formatted self-declaration PDF evidence record.",
      viewSampleBtn: "View Sample PDF",
      recentClaimsTitle: "Recent Incident Records",
      noClaims: "No incident records found. Create your first report above.",
      statusReady: "Dossier Ready"
    },
    fieldReport: {
      title: "Create Field Report",
      subtitle: "Pin your farm location, record voice statement, attach evidence photos, and generate your evidence dossier.",
      backBtn: "Dashboard",
      resetBtn: "Reset Form",
      mapSectionTitle: "Incident Location Map",
      mapSectionSubtitle: "Click or drag the pin to set the exact coordinates of the damage.",
      deviceGpsBtn: "Use Device GPS",
      latitude: "Latitude",
      longitude: "Longitude",
      notSet: "Not set",
      sourceDevice: "Device GPS",
      sourcePin: "Map Pinpoint",
      accuracy: "Accuracy",
      locationNameLabel: "Farm / Land Name",
      locationNamePlaceholder: "e.g., Valparai West Estate - Plot 4",
      descriptionLabel: "Incident Description & Farmer Statement",
      descriptionPlaceholder: "Describe what happened, or use the voice recording below...",
      voiceSectionTitle: "Voice Statement Recording",
      voiceBadge: "GNANI PRISMA STT",
      scenariosTitle: "1-Click Incident Scenarios for Instant Testing",
      scenariosSubtitle: "Select a realistic scenario to immediately test Prisma STT & Timbre Voice synthesis:",
      scenario1Title: "Elephant Raid (Valparai)",
      scenario1Text: "Last night an elephant herd entered the Valparai estate and broke down 15 mature banana trees.",
      scenario2Title: "Wild Boar Intrusion (Pollachi)",
      scenario2Text: "Night before last, 6 wild boars uprooted half an acre of groundnut crop in Pollachi.",
      scenario3Title: "Gaur Herd Attack (Nilgiris)",
      scenario3Text: "A herd of gaur pushed through the perimeter fence and destroyed 25 tea bushes in Nilgiris.",
      transcriptLabel: "Transcribed Statement",
      audioResponseLabel: "Voice Assistant Response (Gnani Timbre)",
      clarificationTitle: "Review & Clarification Note",
      extractedSectionTitle: "AI Extracted Incident Details",
      wildlifeSpecies: "Wildlife Species",
      cropDamaged: "Damaged Crop",
      damageQuantity: "Damage Quantity",
      incidentTime: "Incident Time",
      photosSectionTitle: "Damage Evidence Photographs",
      photosSubtitle: "Attach two clear photographs: a wide overview and a close-up spoor/damage photo.",
      widePhotoTitle: "1. Wide Field Overview",
      spoorPhotoTitle: "2. Animal Spoor / Close-up",
      notUploaded: "No photograph attached",
      chooseImage: "Upload Image",
      samplePhoto: "Simulate Photo",
      checklistTitle: "Available Farmer Documents",
      checklistSubtitle: "Select only the documents you currently hold:",
      checklistPatta: "Land Patta Copy",
      checklistAdangal: "VAO Adangal Certificate",
      checklistBank: "Bank Passbook Copy",
      checklistAadhaar: "Aadhaar Card",
      checklistWitness: "Neighboring Witnesses",
      submitReportBtn: "Submit Field Report & Generate Dossier",
      submitting: "Generating Official Dossier..."
    },
    dossier: {
      readyTitle: "Self-Declaration Dossier Generated",
      readySubtitle: "Your structured evidence dossier has been generated with verified GPS metadata and attached photos.",
      dossierId: "Dossier Identifier",
      farmerName: "Farmer Name & Location",
      damageSummary: "Crop Damage Summary",
      gpsCoordinates: "Consent GPS Coordinates",
      noGpsRecorded: "No GPS coordinates recorded",
      viewInAppBtn: "View Dossier In-App",
      downloadPdfBtn: "Download PDF Dossier",
      shareWhatsAppBtn: "Share via WhatsApp",
      backToDashboard: "Return to Dashboard",
      previewTitle: "Dossier PDF Live Preview",
      openInNewTab: "Open in New Tab",
      close: "Close"
    },
    profileModal: {
      title: "Edit Farmer Profile",
      name: "Farmer Name",
      phone: "Mobile Number",
      village: "Village / Town",
      taluk: "Taluk",
      patta: "Patta Number",
      acres: "Total Area (Acres)",
      survey: "Survey Number",
      cancel: "Cancel",
      save: "Save Profile"
    },
    mobileModal: {
      title: "Open on Mobile Device",
      instructions: "Connect your smartphone to the same Wi-Fi network and open the address below:",
      networkUrlLabel: "Local Wi-Fi Network Address:",
      copyLink: "Copy Link",
      copied: "Copied!",
      bullet1: "Use smartphone microphone for natural Tamil/English voice input",
      bullet2: "Capture field photos directly from mobile camera with live GPS",
      bullet3: "Instantly view and download the official PDF dossier on your phone",
      done: "Close"
    }
  },
  ta: {
    nav: {
      brand: "RaidProof AI",
      tagline: "விவசாயிகள் பயிர்ச்சேத சான்றாவண உதவியாளர்",
      mobileShare: "மொபைல் இணைப்பு",
      diagnostics: "கணினி ஆய்வு",
      realMode: "ரியல் ஞானி AI",
      mockMode: "மாக் பயன்முறை"
    },
    disclaimer: {
      banner: "சுய அறிவிப்பு சான்றாவணம்: இது அதிகாரப்பூர்வ அரசு இழப்பீட்டு ஒப்புதல் அல்ல. வனத்துறையின் கள ஆய்வுக்கு சமர்ப்பிக்க விவசாயி தயாரிக்கும் சுய சான்றாவணம் மட்டுமே.",
      legalNote: "விதிமுறை அறிவிப்பு: செயற்கை நுண்ணறிவு விவசாயிக்கு சான்றுகளை தொகுக்க மட்டுமே உதவுகிறது; இழப்பீட்டு முடிவுகளை எடுப்பதில்லை."
    },
    dashboard: {
      farmerProfile: "விவசாயி சுயவிவரம்",
      village: "கிராமம்",
      patta: "பட்டா எண்",
      surveyNo: "சர்வே எண்",
      acres: "ஏக்கர்",
      phone: "தொலைபேசி",
      edit: "விவரம் திருத்த",
      createReportTitle: "வனவிலங்கு பயிர்ச்சேதம் ஏற்பட்டதா?",
      createReportDesc: "தமிழில் அல்லது ஆங்கிலத்தில் பேசி, உங்கள் தோட்டத்தை வரைபடத்தில் குறித்து, புகைப்படங்களை இணைத்து 3 நிமிடத்தில் முழுமையான சுய சான்றாவணம் தயார் செய்யவும்.",
      createReportBtn: "புதிய கள அறிக்கை பதிவு",
      guidedStepsBtn: "படிப் படியான பதிவு",
      connectionTitle: "ஞானி AI குரல் சேவை நிலை",
      realConnDesc: "ஞானி பிரிஸ்மா STT மற்றும் டிம்ப்ரே TTS இணைப்பில் உள்ளது.",
      mockConnDesc: "உள்ளூர் மாதிரி அமைப்பில் இயங்குகிறது.",
      diagnosticsBtn: "இணைப்பு ஆய்வு",
      sampleDossierTitle: "மாதிரி சான்றாவணம்",
      sampleDossierDesc: "சுய அறிவிப்பு சான்றாவணத்தின் மாதிரி பிடிஎஃப் ஆவணத்தை பார்க்கவும்.",
      viewSampleBtn: "மாதிரி PDF பார்க்க",
      recentClaimsTitle: "முந்தைய பதிவு விபரங்கள்",
      noClaims: "முந்தைய பதிவுகள் ஏதுமில்லை. மேலே உள்ள பொத்தானை அழுத்தி புதிய அறிக்கை உருவாக்கவும்.",
      statusReady: "சான்றாவணம் தயார்"
    },
    fieldReport: {
      title: "கள அறிக்கை பதிவு",
      subtitle: "தோட்டத்தை வரைபடத்தில் குறித்து, குரல் வழி விபரம் கூறி, புகைப்படங்களை இணைத்து சுய சான்றாவணம் தயார் செய்யவும்.",
      backBtn: "முகப்பு",
      resetBtn: "மீட்டமைக்க",
      mapSectionTitle: "கள வரைபடம்",
      mapSectionSubtitle: "வரைபடத்தில் தட்டி சேதமடைந்த இடத்தின் துல்லியமான அட்சரேகை மற்றும் தீர்க்கரேகையைக் குறிக்கவும்.",
      deviceGpsBtn: "சாதன ஜிபிஎஸ் பெற",
      latitude: "அட்சரேகை",
      longitude: "தீர்க்கரேகை",
      notSet: "குறிக்கப்படவில்லை",
      sourceDevice: "மொபைல் ஜிபிஎஸ்",
      sourcePin: "வரைபடக் குறியீடு",
      accuracy: "துல்லியம்",
      locationNameLabel: "தோட்டம் / நிலத்தின் பெயர்",
      locationNamePlaceholder: "எ.கா: வால்பாறை மேற்கு தோட்டம் - பகுதி 4",
      descriptionLabel: "சேத விவர விளக்கம் மற்றும் விவசாயி வாக்குமூலம்",
      descriptionPlaceholder: "நடந்த விபரங்களை எழுதவும் அல்லது கீழேயுள்ள குரல் பதிவைப் பயன்படுத்தவும்...",
      voiceSectionTitle: "குரல் வழி சேதப் பதிவு",
      voiceBadge: "ஞானி பிரிஸ்மா STT",
      scenariosTitle: "உடனடி சோதனைக்கான மாதிரி விவசாயி சூழல்கள்",
      scenariosSubtitle: "நேரடியாக பேச முடியாத போது, கீழேயுள்ள நிஜ சூழலைத் தேர்ந்தெடுத்து ஞானி AI சோதனையை காணலாம்:",
      scenario1Title: "யானை சேதம் (வால்பாறை)",
      scenario1Text: "நேத்து ராத்திரி வால்பாறை தோட்டத்தில் ஒரு காட்டு யானை உள்ளே நுழைந்து 15 வாழை மரங்களை வேரோடு சாய்த்து தின்றுவிட்டது.",
      scenario2Title: "காட்டுப்பன்றி சேதம் (பொள்ளாச்சி)",
      scenario2Text: "பொள்ளாச்சி தோட்டத்தில் முந்தாநாள் இரவு 6 காட்டுப்பன்றிகள் வந்து அரை ஏக்கர் நிலக்கடலை பயிரை கிளறி நாசம் செய்துவிட்டது.",
      scenario3Title: "காட்டெருமை சேதம் (நீலகிரி)",
      scenario3Text: "நீலகிரி மலையடிவாரத்தில் காட்டெருமை கூட்டம் வந்து 25 தேயிலை செடிகளையும் வேலியையும் முட்டி உடைத்துவிட்டது.",
      transcriptLabel: "நீங்கள் பேசிய குரல் வடிவம்",
      audioResponseLabel: "கணினியின் குரல் பதில் (ஞானி டிம்ப்ரே லட்சுமி குரல்)",
      clarificationTitle: "விவர சரிபார்ப்பு குறிப்பு",
      extractedSectionTitle: "AI பிரித்தெடுத்த விபரங்கள்",
      wildlifeSpecies: "தாக்கிய விலங்கு",
      cropDamaged: "சேதமான பயிர்",
      damageQuantity: "சேத அளவு",
      incidentTime: "சம்பவ நேரம்",
      photosSectionTitle: "சேத சான்று புகைப்படங்கள்",
      photosSubtitle: "தோட்டத்தின் முழுத்தோற்றம் மற்றும் விலங்கு தடம் ஆகிய இரண்டு படங்களை இணைக்கவும்.",
      widePhotoTitle: "1. முழுத்தோற்ற படம்",
      spoorPhotoTitle: "2. விலங்கு தடம் / சேத அடையாளம்",
      notUploaded: "படம் இணைக்கப்படவில்லை",
      chooseImage: "படம் பதிவேற்ற",
      samplePhoto: "மாதிரி படம்",
      checklistTitle: "உங்களிடம் உள்ள ஆவணங்கள்",
      checklistSubtitle: "உங்களிடம் தற்போது தயாராக உள்ள ஆவணங்களை மட்டும் தேர்ந்தெடுக்கவும்:",
      checklistPatta: "பட்டா / சிட்டா நகல்",
      checklistAdangal: "VAO அடங்கல் சான்று",
      checklistBank: "வங்கி கணக்கு புத்தகம்",
      checklistAadhaar: "ஆதார் அட்டை",
      checklistWitness: "அண்டை நில சாட்சிகள்",
      submitReportBtn: "சுய சான்றாவணம் உருவாக்குக",
      submitting: "சான்றாவணம் தயாராகிறது..."
    },
    dossier: {
      readyTitle: "சுய சான்றாவணம் தயாரானது!",
      readySubtitle: "புகைப்படங்கள் மற்றும் ஜிபிஎஸ் இருப்பிடத் தகவல்களுடன் கூடிய சுய அறிவிப்பு சான்றாவணம் வெற்றிகரமாக உருவாக்கப்பட்டது.",
      dossierId: "சான்றாவண எண்",
      farmerName: "விவசாயி மற்றும் இருப்பிடம்",
      damageSummary: "பயிர்ச்சேத விபரம்",
      gpsCoordinates: "ஒப்புதல் இருப்பிட தகவல் (GPS)",
      noGpsRecorded: "இருப்பிடம் பதிவு செய்யப்படவில்லை",
      viewInAppBtn: "சான்றாவணத்தை நேரடியாக பார்",
      downloadPdfBtn: "PDF சான்றிதழ் பதிவிறக்கம்",
      shareWhatsAppBtn: "WhatsApp வழியாக பகிரவும்",
      backToDashboard: "முகப்புக்கு செல்ல",
      previewTitle: "சான்றாவண நேரடி முன்னோட்டம்",
      openInNewTab: "புதிய பக்கத்தில் திற",
      close: "மூடு"
    },
    profileModal: {
      title: "விவசாயி விபரங்கள் திருத்தம்",
      name: "விவசாயி பெயர்",
      phone: "தொலைபேசி எண்",
      village: "கிராமம்",
      taluk: "வட்டம் (தாலுகா)",
      patta: "பட்டா எண்",
      acres: "நிலப்பரப்பு (ஏக்கர்)",
      survey: "சர்வே எண்",
      cancel: "ரத்து செய்",
      save: "விவரங்களை சேமி"
    },
    mobileModal: {
      title: "மொபைல் போனில் இயக்க",
      instructions: "உங்கள் மொபைல் போனை இதே வைஃபை நெட்வொர்க்கில் இணைத்து, கீழேயுள்ள இணைப்பை பிரவுசரில் திறக்கவும்:",
      networkUrlLabel: "வைஃபை உள்ளூர் முகவரி:",
      copyLink: "இணைப்பை நகலெடு",
      copied: "நகலெடுக்கப்பட்டது!",
      bullet1: "மொபைல் மைக்ரோஃபோன் வழியாக நேரடியாக தமிழில்/ஆங்கிலத்தில் பேசலாம்",
      bullet2: "மொபைல் கேமரா மூலம் நேரடி ஜிபிஎஸ் துல்லியத்துடன் படம் எடுக்கலாம்",
      bullet3: "உருவான சான்றாவண PDF-ஐ உடனே மொபைலில் பதிவிறக்கம் செய்யலாம்",
      done: "சரி"
    }
  }
};

