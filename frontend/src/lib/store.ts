import { create } from 'zustand';

export type BoothMode = 'single' | 'strip' | 'gif' | 'boomerang' | 'burst' | 'aistudio';
export type BoothScreen = 'idle' | 'countdown' | 'capture' | 'preview' | 'ai' | 'aistudio' | 'airesult' | 'share' | 'print';

export interface Photo {
  id: string;
  url: string;
  thumbUrl?: string;
  galleryUrl: string;
  qrCode: string;
  whatsappUrl: string;
  downloadUrl: string;
  mode: BoothMode;
  isAI?: boolean;
  style?: string;
}

export interface Event {
  id: string;
  name: string;
  slug: string;
  date?: string;
  venue?: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    eventName: string;
    footerText: string;
    overlayText: string;
    showDate: boolean;
    template: string;
    logoUrl: string | null;
    idleMediaUrl?: string | null;
    frameUrl?: string | null;
  };
  settings: {
    countdownSeconds: number;
    photosPerSession: number;
    allowRetakes: boolean;
    allowAI: boolean;
    allowGIF: boolean;
    allowBoomerang: boolean;
    allowPrint: boolean;
    printCopies: number;
    aiStyles: string[];
    sessionTimeout: number;
    operatorPin: string;
    // New fields
    boothStart:    string | null;
    boothEnd:      string | null;
    photoLimit:    number | null;
    leadCapture:   boolean;
    leadRequired:  boolean;
    // Share channel toggles
    allowEmailShare?: boolean;
    allowSMSShare?:   boolean;
    emailFromName?:   string;
    emailReplyTo?:    string;
    // New sharing features
    shareScreenTimeout?:   number;
    whatsappCountryCode?:  string;
    emailSubject?:         string;
    smsMessage?:           string;
    // Print settings
    maxPrints?:    number | null;
    printScale?:   number;
    autoPrint?:    boolean;
    kioskMode?:    boolean;
    countdownSound?: boolean;
    roamingMode?:   boolean;
    beautyLevel?:   number;
    paperSize?:     string;
    disabledAIStyles?: string[];
  };
}

interface BoothStore {
  screen: BoothScreen;
  mode: BoothMode;
  event: Event | null;
  currentPhoto: Photo | null;
  capturedFrames: string[];
  isCapturing: boolean;
  isProcessing: boolean;
  aiGenerating: boolean;
  aiProgress: string;
  selectedAIStyle: string;
  sessionId: string;
  flashActive: boolean;

  setScreen: (screen: BoothScreen) => void;
  setMode: (mode: BoothMode) => void;
  setEvent: (event: Event) => void;
  setCurrentPhoto: (photo: Photo | null) => void;
  addFrame: (frame: string) => void;
  clearFrames: () => void;
  setCapturing: (v: boolean) => void;
  setProcessing: (v: boolean) => void;
  setAIGenerating: (v: boolean) => void;
  setAIProgress: (msg: string) => void;
  setSelectedAIStyle: (style: string) => void;
  triggerFlash: () => void;
  resetSession: () => void;
  newSessionId: () => string;
}

export const useBoothStore = create<BoothStore>((set, get) => ({
  screen: 'idle',
  mode: 'single',
  event: null,
  currentPhoto: null,
  capturedFrames: [],
  isCapturing: false,
  isProcessing: false,
  aiGenerating: false,
  aiProgress: '',
  selectedAIStyle: 'anime',
  sessionId: generateSessionId(),
  flashActive: false,

  setScreen: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
  setEvent: (event) => set({ event }),
  setCurrentPhoto: (currentPhoto) => set({ currentPhoto }),
  addFrame: (frame) => set((s) => ({ capturedFrames: [...s.capturedFrames, frame] })),
  clearFrames: () => set({ capturedFrames: [] }),
  setCapturing: (isCapturing) => set({ isCapturing }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setAIGenerating: (aiGenerating) => set({ aiGenerating }),
  setAIProgress: (aiProgress) => set({ aiProgress }),
  setSelectedAIStyle: (selectedAIStyle) => set({ selectedAIStyle }),
  triggerFlash: () => {
    set({ flashActive: true });
    setTimeout(() => set({ flashActive: false }), 600);
  },
  resetSession: () =>
    set({
      screen: 'idle',
      currentPhoto: null,
      capturedFrames: [],
      isCapturing: false,
      isProcessing: false,
      aiGenerating: false,
      aiProgress: '',
      sessionId: generateSessionId(),
    }),
  newSessionId: () => {
    const id = generateSessionId();
    set({ sessionId: id });
    return id;
  },
}));

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
