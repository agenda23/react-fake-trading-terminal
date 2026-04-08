import { create } from "zustand";
import type { AnimationSpeed, ThemePreset } from "../types";

const STORAGE_KEY = "novaplex-terminal-settings";

export interface UserSettings {
  initialTotalPnlSol: number;
  animationSpeed: AnimationSpeed;
  themePreset: ThemePreset;
  tokenFeedMaxPerMinute: number;
  tokenCatalogLimit: number;
}

interface SettingsState {
  saved: UserSettings;
  preview: UserSettings;
  hasHydrated: boolean;
  simulationVersion: number;
  hydrate: () => void;
  setPreviewInitialTotalPnlSol: (value: number) => void;
  setPreviewAnimationSpeed: (value: AnimationSpeed) => void;
  setPreviewThemePreset: (value: ThemePreset) => void;
  setPreviewTokenFeedMaxPerMinute: (value: number) => void;
  setPreviewTokenCatalogLimit: (value: number) => void;
  commitPreview: () => void;
  revertPreview: () => void;
  resetPreview: () => void;
  restartSimulation: () => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  initialTotalPnlSol: 12.38,
  animationSpeed: 1,
  themePreset: "emerald",
  tokenFeedMaxPerMinute: 30,
  tokenCatalogLimit: 20,
};

const clampInitialPnl = (value: number) => Math.min(30, Math.max(-5, Number(value.toFixed(2))));
const clampTokenFeedMaxPerMinute = (value: number) => Math.min(60, Math.max(5, Math.round(value)));
const clampTokenCatalogLimit = (value: number) => Math.min(50, Math.max(5, Math.round(value)));

const persist = (settings: UserSettings) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  saved: DEFAULT_SETTINGS,
  preview: DEFAULT_SETTINGS,
  hasHydrated: false,
  simulationVersion: 0,
  hydrate: () => {
    if (typeof window === "undefined" || get().hasHydrated) {
      set({ hasHydrated: true });
      return;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        set({ hasHydrated: true });
        return;
      }

      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      const hydrated: UserSettings = {
        initialTotalPnlSol: clampInitialPnl(parsed.initialTotalPnlSol ?? DEFAULT_SETTINGS.initialTotalPnlSol),
        animationSpeed:
          parsed.animationSpeed === 0.75 || parsed.animationSpeed === 1 || parsed.animationSpeed === 1.25
            ? parsed.animationSpeed
            : DEFAULT_SETTINGS.animationSpeed,
        themePreset:
          parsed.themePreset === "emerald" ||
          parsed.themePreset === "blue" ||
          parsed.themePreset === "violet" ||
          parsed.themePreset === "amber"
            ? parsed.themePreset
            : DEFAULT_SETTINGS.themePreset,
        tokenFeedMaxPerMinute: clampTokenFeedMaxPerMinute(parsed.tokenFeedMaxPerMinute ?? DEFAULT_SETTINGS.tokenFeedMaxPerMinute),
        tokenCatalogLimit: clampTokenCatalogLimit(parsed.tokenCatalogLimit ?? DEFAULT_SETTINGS.tokenCatalogLimit),
      };

      set({
        saved: hydrated,
        preview: hydrated,
        hasHydrated: true,
      });
    } catch {
      set({ hasHydrated: true });
    }
  },
  setPreviewInitialTotalPnlSol: (value) =>
    set((state) => ({
      preview: {
        ...state.preview,
        initialTotalPnlSol: clampInitialPnl(Number.isFinite(value) ? value : state.preview.initialTotalPnlSol),
      },
    })),
  setPreviewAnimationSpeed: (value) =>
    set((state) => ({
      preview: {
        ...state.preview,
        animationSpeed: value,
      },
    })),
  setPreviewThemePreset: (value) =>
    set((state) => ({
      preview: {
        ...state.preview,
        themePreset: value,
      },
    })),
  setPreviewTokenFeedMaxPerMinute: (value) =>
    set((state) => ({
      preview: {
        ...state.preview,
        tokenFeedMaxPerMinute: clampTokenFeedMaxPerMinute(Number.isFinite(value) ? value : state.preview.tokenFeedMaxPerMinute),
      },
    })),
  setPreviewTokenCatalogLimit: (value) =>
    set((state) => ({
      preview: {
        ...state.preview,
        tokenCatalogLimit: clampTokenCatalogLimit(Number.isFinite(value) ? value : state.preview.tokenCatalogLimit),
      },
    })),
  commitPreview: () => {
    const preview = get().preview;
    persist(preview);
    set({ saved: preview });
  },
  revertPreview: () => {
    set((state) => ({
      preview: state.saved,
    }));
  },
  resetPreview: () => {
    set({
      preview: DEFAULT_SETTINGS,
    });
  },
  restartSimulation: () => {
    set((state) => ({
      simulationVersion: state.simulationVersion + 1,
    }));
  },
}));
