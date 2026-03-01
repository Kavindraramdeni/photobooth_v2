import { create } from 'zustand';

export type BoothMode = 'single' | 'strip' | 'gif' | 'boomerang';
export type BoothScreen = 'idle' | 'countdown' | 'capture' | 'preview' | 'ai' | 'share' | 'print';

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
