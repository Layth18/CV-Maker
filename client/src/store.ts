// Editor state: the CV configuration and profile being edited, save status,
// and the generate -> compile -> preview pipeline.
//
// Edits are applied locally at once, saved after a short debounce, and (when
// auto-compile is on) followed by a debounced build. The preview always shows
// the last *successful* build; a failed build never replaces it.
//
// Once the preview is up to date, the other format/language variants are
// built in the background so the quick switcher can show them instantly
// (the server reuses any build whose LaTeX source is unchanged).

import { create } from 'zustand';
import { switchFormat } from '../../shared/catalog';
import type { BuildResult, CVConfig, Lang, Profile, SourceResult } from '../../shared/types';
import { api } from './api';

export type SaveState = 'saved' | 'pending' | 'saving' | 'error';
export type DocPhase = 'idle' | 'generating' | 'compiling';
export type VariantState = 'building' | 'ready' | 'failed';

const SAVE_DEBOUNCE_MS = 600;
const BUILD_DEBOUNCE_MS = 1200;
const PREFETCH_DELAY_MS = 1500;

export const variantKey = (templateId: string, language: Lang) => `${templateId}:${language}`;

interface EditorState {
  cvId: string | null;
  cv: CVConfig | null;
  profile: Profile | null;
  loadError: string | null;

  cvSave: SaveState;
  profileSave: SaveState;
  saveError: string | null;

  phase: DocPhase;
  /** Last successful build: what the viewer shows and what exports download. */
  preview: BuildResult | null;
  /** Most recent failed build (cleared by the next success). */
  failure: BuildResult | null;
  /** Network / server error while building (not a LaTeX error). */
  pipelineError: string | null;
  /** Local edits not yet reflected in the preview. */
  outdated: boolean;
  source: (SourceResult & { notes: string[] }) | null;
  autoCompile: boolean;

  /** The toolbox on screen: 'personal', a section key, or 'design:<panel>'. */
  selected: string;
  /** Background builds of the other variants, by variantKey(). */
  variants: Record<string, VariantState>;

  load: (cvId: string) => Promise<void>;
  unload: () => void;
  updateCV: (fn: (cv: CVConfig) => void) => void;
  updateProfile: (fn: (p: Profile) => void) => void;
  replaceCV: (cv: CVConfig) => void;
  setAutoCompile: (on: boolean) => void;
  generate: () => Promise<void>;
  flush: () => Promise<void>;
  select: (id: string) => void;
  /** Switch format and/or language and rebuild immediately. */
  switchVariant: (v: { templateId?: string; language?: Lang }) => void;
  removeFormat: (templateId: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

let cvTimer: ReturnType<typeof setTimeout> | undefined;
let profileTimer: ReturnType<typeof setTimeout> | undefined;
let buildTimer: ReturnType<typeof setTimeout> | undefined;
let prefetchTimer: ReturnType<typeof setTimeout> | undefined;
let cvSaving: Promise<void> | null = null;
let profileSaving: Promise<void> | null = null;
let buildSeq = 0;
let prefetchSeq = 0;
let editVersion = 0;

// Undo history of (cv, profile) snapshots. Edits less than HISTORY_GAP_MS apart
// (e.g. typing) are grouped into one step.
type Snapshot = { cv: CVConfig; profile: Profile };
const HISTORY_GAP_MS = 800;
const HISTORY_LIMIT = 100;
let past: Snapshot[] = [];
let future: Snapshot[] = [];
let lastRecord = 0;

function readStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export const useEditor = create<EditorState>((set, get) => {
  const scheduleBuild = () => {
    clearTimeout(buildTimer);
    if (!get().autoCompile) return;
    buildTimer = setTimeout(() => void get().generate(), BUILD_DEBOUNCE_MS);
  };

  const cancelPrefetch = () => {
    prefetchSeq++;
    clearTimeout(prefetchTimer);
  };

  /** Build the other variants one at a time, stopping as soon as anything changes. */
  const schedulePrefetch = () => {
    cancelPrefetch();
    const seq = prefetchSeq;
    prefetchTimer = setTimeout(async () => {
      const { cv, cvId } = get();
      if (!cv || !cvId) return;
      const targets = cv.formats
        .flatMap((templateId) => (['en', 'fr'] as Lang[]).map((language) => ({ templateId, language })))
        .filter((v) => !(v.templateId === cv.templateId && v.language === cv.language));
      for (const v of targets) {
        const key = variantKey(v.templateId, v.language);
        if (seq !== prefetchSeq || get().phase !== 'idle') return;
        if (get().variants[key] === 'ready') continue;
        set((s) => ({ variants: { ...s.variants, [key]: 'building' } }));
        try {
          const r = await api.build(cvId, v);
          if (seq !== prefetchSeq) return;
          set((s) => ({ variants: { ...s.variants, [key]: r.status === 'success' ? 'ready' : 'failed' } }));
        } catch {
          if (seq === prefetchSeq) set((s) => ({ variants: { ...s.variants, [key]: 'failed' } }));
          return;
        }
      }
    }, PREFETCH_DELAY_MS);
  };

  const saveCVNow = async () => {
    const { cv } = get();
    if (!cv) return;
    set({ cvSave: 'saving' });
    const sentVersion = editVersion;
    try {
      const saved = await api.saveCV(cv);
      // Keep server-owned fields without overwriting edits made during the request.
      set((s) => ({
        cvSave: s.cvSave === 'saving' ? 'saved' : s.cvSave,
        saveError: null,
        cv: s.cv && editVersion === sentVersion ? { ...s.cv, updatedAt: saved.updatedAt } : s.cv,
      }));
    } catch (err) {
      set({ cvSave: 'error', saveError: (err as Error).message });
    }
  };

  const saveProfileNow = async () => {
    const { profile } = get();
    if (!profile) return;
    set({ profileSave: 'saving' });
    try {
      await api.saveProfile(profile);
      set((s) => ({ profileSave: s.profileSave === 'saving' ? 'saved' : s.profileSave, saveError: null }));
    } catch (err) {
      set({ profileSave: 'error', saveError: (err as Error).message });
    }
  };

  /** Record an edit. Content edits invalidate the background variant builds. */
  const touched = (contentChanged = true) => {
    editVersion++;
    cancelPrefetch();
    set(contentChanged ? { outdated: true, variants: {} } : { outdated: true });
  };

  /** Remember the state before an edit, so it can be undone. */
  const record = () => {
    const { cv, profile } = get();
    if (!cv || !profile) return;
    const now = Date.now();
    if (now - lastRecord > HISTORY_GAP_MS || !past.length) {
      past.push({ cv, profile });
      if (past.length > HISTORY_LIMIT) past.shift();
    }
    lastRecord = now;
    future = [];
    set({ canUndo: true, canRedo: false });
  };

  const setProfile = (next: Profile) => {
    set({ profile: next, profileSave: 'pending' });
    touched();
    clearTimeout(profileTimer);
    profileTimer = setTimeout(() => {
      profileSaving = saveProfileNow().finally(() => (profileSaving = null));
      void profileSaving.then(scheduleBuild);
    }, SAVE_DEBOUNCE_MS);
  };

  /** Restore a snapshot; only the parts that differ are saved again. */
  const restore = (snap: Snapshot) => {
    const { cv, profile } = get();
    lastRecord = 0;
    if (snap.cv !== cv) setCV(snap.cv, true);
    if (snap.profile !== profile) setProfile(snap.profile);
  };

  const setCV = (next: CVConfig, contentChanged: boolean) => {
    set({ cv: next, cvSave: 'pending' });
    touched(contentChanged);
    clearTimeout(cvTimer);
    cvTimer = setTimeout(() => {
      cvSaving = saveCVNow().finally(() => (cvSaving = null));
      void cvSaving.then(scheduleBuild);
    }, SAVE_DEBOUNCE_MS);
  };

  const activeKey = () => {
    const cv = get().cv;
    return cv ? variantKey(cv.templateId, cv.language) : '';
  };

  return {
    cvId: null,
    cv: null,
    profile: null,
    loadError: null,
    cvSave: 'saved',
    profileSave: 'saved',
    saveError: null,
    phase: 'idle',
    preview: null,
    failure: null,
    pipelineError: null,
    outdated: false,
    source: null,
    autoCompile: readStored('cvstudio.autoCompile', 'true') !== 'false',
    selected: readStored('cvstudio.selected', 'personal'),
    variants: {},
    canUndo: false,
    canRedo: false,

    async load(cvId) {
      buildSeq++;
      cancelPrefetch();
      past = [];
      future = [];
      set({ canUndo: false, canRedo: false });
      set({ cvId, cv: null, profile: null, preview: null, failure: null, source: null, loadError: null, outdated: false, phase: 'idle', variants: {} });
      try {
        const [cv, profile] = await Promise.all([api.getCV(cvId), api.profile()]);
        if (get().cvId !== cvId) return;
        set({ cv, profile, cvSave: 'saved', profileSave: 'saved' });
        // Restore the last successful preview, then check whether it is still current.
        const preview = cv.lastSuccessfulBuildId ? await api.getBuild(cv.lastSuccessfulBuildId).catch(() => null) : null;
        if (get().cvId !== cvId) return;
        set({ preview: preview?.status === 'success' ? preview : null });
        const source = await api.source(cvId);
        if (get().cvId !== cvId) return;
        const upToDate = Boolean(preview && preview.sourceHash === source.sourceHash);
        set({ source, outdated: !upToDate });
        if (upToDate) {
          set((s) => ({ variants: { ...s.variants, [activeKey()]: 'ready' } }));
          schedulePrefetch();
        } else if (get().autoCompile) void get().generate();
      } catch (err) {
        set({ loadError: (err as Error).message });
      }
    },

    unload() {
      void get().flush();
      buildSeq++;
      cancelPrefetch();
      clearTimeout(buildTimer);
      set({ cvId: null, cv: null, preview: null, failure: null, source: null, variants: {} });
    },

    updateCV(fn) {
      const cv = get().cv;
      if (!cv) return;
      record();
      const next = structuredClone(cv);
      fn(next);
      setCV(next, true);
    },

    updateProfile(fn) {
      const p = get().profile;
      if (!p) return;
      record();
      const next = structuredClone(p);
      fn(next);
      setProfile(next);
    },

    /** Replace the CV with a server-side result (e.g. template applied). */
    replaceCV(cv) {
      record();
      set({ cv, cvSave: 'saved' });
      touched();
      scheduleBuild();
    },

    setAutoCompile(on) {
      store('cvstudio.autoCompile', String(on));
      set({ autoCompile: on });
      if (on && get().outdated) scheduleBuild();
    },

    select(id) {
      store('cvstudio.selected', id);
      set({ selected: id });
    },

    switchVariant({ templateId, language }) {
      const cv = get().cv;
      if (!cv) return;
      const target = templateId ?? cv.templateId;
      const lang = language ?? cv.language;
      if (target === cv.templateId && lang === cv.language) return;
      record();
      // Switching only moves designs around: the other variants' builds stay valid.
      setCV({ ...switchFormat(structuredClone(cv), target), language: lang }, false);
      void get().generate();
    },

    removeFormat(templateId) {
      const cv = get().cv;
      if (!cv || templateId === cv.templateId || cv.formats.length < 2) return;
      record();
      const next = structuredClone(cv);
      next.formats = next.formats.filter((f) => f !== templateId);
      delete next.designs[templateId];
      setCV(next, false);
    },

    undo() {
      const snap = past.pop();
      const { cv, profile } = get();
      if (!snap || !cv || !profile) return;
      future.push({ cv, profile });
      restore(snap);
      set({ canUndo: past.length > 0, canRedo: true });
    },

    redo() {
      const snap = future.pop();
      const { cv, profile } = get();
      if (!snap || !cv || !profile) return;
      past.push({ cv, profile });
      restore(snap);
      set({ canUndo: true, canRedo: future.length > 0 });
    },

    async flush() {
      if (get().cvSave === 'pending') {
        clearTimeout(cvTimer);
        cvSaving = saveCVNow().finally(() => (cvSaving = null));
      }
      if (get().profileSave === 'pending') {
        clearTimeout(profileTimer);
        profileSaving = saveProfileNow().finally(() => (profileSaving = null));
      }
      await Promise.all([cvSaving, profileSaving]);
    },

    async generate() {
      const cvId = get().cvId;
      if (!cvId) return;
      clearTimeout(buildTimer);
      cancelPrefetch();
      const seq = ++buildSeq;
      const startVersion = editVersion;
      set({ phase: 'generating', pipelineError: null });
      try {
        await get().flush();
        if (seq !== buildSeq) return;
        const source = await api.source(cvId);
        if (seq !== buildSeq) return;
        set({ source });
        const { preview } = get();
        let result: BuildResult;
        if (preview && preview.sourceHash === source.sourceHash) {
          result = preview;
        } else {
          set({ phase: 'compiling' });
          result = await api.build(cvId);
          if (seq !== buildSeq) return;
        }
        if (result.status === 'success') {
          const outdated = editVersion !== startVersion || result.sourceHash !== source.sourceHash;
          set((s) => ({
            preview: result,
            failure: null,
            phase: 'idle',
            outdated,
            variants: outdated ? s.variants : { ...s.variants, [activeKey()]: 'ready' },
          }));
          if (!outdated) schedulePrefetch();
        } else {
          set({ failure: result, phase: 'idle', outdated: true });
        }
      } catch (err) {
        if (seq !== buildSeq) return;
        set({ phase: 'idle', pipelineError: (err as Error).message });
      }
    },
  };
});

export type DocStatus = 'not-generated' | 'generating' | 'compiling' | 'ready' | 'failed' | 'unsaved' | 'outdated';

export function docStatus(s: Pick<EditorState, 'phase' | 'preview' | 'failure' | 'outdated' | 'cvSave' | 'profileSave' | 'pipelineError'>): DocStatus {
  if (s.phase === 'generating') return 'generating';
  if (s.phase === 'compiling') return 'compiling';
  if (s.cvSave === 'pending' || s.cvSave === 'saving' || s.profileSave === 'pending' || s.profileSave === 'saving') return 'unsaved';
  if (s.failure || s.pipelineError) return 'failed';
  if (!s.preview) return 'not-generated';
  if (s.outdated) return 'outdated';
  return 'ready';
}

let idCounter = 0;
export function uid(prefix: string): string {
  idCounter = (idCounter + 1) % 1296;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 5)}`;
}
