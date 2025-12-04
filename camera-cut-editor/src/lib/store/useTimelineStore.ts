import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Cut, Marker, TransitionType } from '@/types/timeline';

interface TimelineState {
  cuts: Cut[];
  markers: Marker[];
  selectedCutId: string | null;

  // Playback
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  frameRate: number;
  loop: boolean;

  // UI
  zoom: number;
  scrollPosition: number;

  // Cut Actions
  addCut: (cut: Partial<Cut>) => string;
  removeCut: (id: string) => void;
  updateCut: (id: string, updates: Partial<Cut>) => void;
  selectCut: (id: string | null) => void;
  reorderCuts: (fromIndex: number, toIndex: number) => void;
  duplicateCut: (id: string) => void;

  // Marker Actions
  addMarker: (marker: Partial<Marker>) => string;
  removeMarker: (id: string) => void;
  updateMarker: (id: string, updates: Partial<Marker>) => void;

  // Playback Actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  togglePlayback: () => void;
  setCurrentTime: (time: number) => void;
  seekToStart: () => void;
  seekToEnd: () => void;
  seekToCut: (cutId: string) => void;
  nextFrame: () => void;
  prevFrame: () => void;

  // Settings
  setFrameRate: (frameRate: number) => void;
  setZoom: (zoom: number) => void;
  setScrollPosition: (position: number) => void;
  setLoop: (loop: boolean) => void;

  // Utility
  recalculateDuration: () => void;
  getCutAtTime: (time: number) => Cut | null;
}

export const useTimelineStore = create<TimelineState>()(
  immer((set, get) => ({
    cuts: [],
    markers: [],
    selectedCutId: null,

    currentTime: 0,
    duration: 0,
    isPlaying: false,
    frameRate: 29.97,
    loop: false,

    zoom: 1,
    scrollPosition: 0,

    addCut: (partial) => {
      const id = crypto.randomUUID();
      const state = get();

      // Calculate start time based on existing cuts
      const lastCut = state.cuts[state.cuts.length - 1];
      const startTime = lastCut ? lastCut.startTime + lastCut.duration : 0;

      const cut: Cut = {
        id,
        name: `Cut ${state.cuts.length + 1}`,
        cameraId: '',
        startTime,
        duration: 5,
        transition: 'cut',
        transitionDuration: 0,
        ...partial,
      };

      set((state) => {
        state.cuts.push(cut);
        state.selectedCutId = id;

        // Update duration
        const newDuration = cut.startTime + cut.duration;
        if (newDuration > state.duration) {
          state.duration = newDuration;
        }
      });

      return id;
    },

    removeCut: (id) => {
      set((state) => {
        const index = state.cuts.findIndex(c => c.id === id);
        if (index !== -1) {
          state.cuts.splice(index, 1);

          // Recalculate start times for remaining cuts
          let currentStart = 0;
          state.cuts.forEach(cut => {
            cut.startTime = currentStart;
            currentStart += cut.duration;
          });

          if (state.selectedCutId === id) {
            state.selectedCutId = state.cuts.length > 0 ? state.cuts[0].id : null;
          }

          // Recalculate duration
          const lastCut = state.cuts[state.cuts.length - 1];
          state.duration = lastCut ? lastCut.startTime + lastCut.duration : 0;
        }
      });
    },

    updateCut: (id, updates) => {
      set((state) => {
        const cut = state.cuts.find(c => c.id === id);
        if (cut) {
          Object.assign(cut, updates);

          // Recalculate duration if this affects it
          const lastCut = state.cuts[state.cuts.length - 1];
          if (lastCut) {
            state.duration = lastCut.startTime + lastCut.duration;
          }
        }
      });
    },

    selectCut: (id) => {
      set((state) => {
        state.selectedCutId = id;
      });
    },

    reorderCuts: (fromIndex, toIndex) => {
      set((state) => {
        const [removed] = state.cuts.splice(fromIndex, 1);
        state.cuts.splice(toIndex, 0, removed);

        // Recalculate start times
        let currentStart = 0;
        state.cuts.forEach(cut => {
          cut.startTime = currentStart;
          currentStart += cut.duration;
        });
      });
    },

    duplicateCut: (id) => {
      const state = get();
      const cut = state.cuts.find(c => c.id === id);
      if (!cut) return;

      const newId = crypto.randomUUID();
      set((state) => {
        const index = state.cuts.findIndex(c => c.id === id);
        const newCut: Cut = {
          ...cut,
          id: newId,
          name: `${cut.name} Copy`,
          startTime: cut.startTime + cut.duration,
        };

        state.cuts.splice(index + 1, 0, newCut);

        // Recalculate start times for cuts after the new one
        for (let i = index + 2; i < state.cuts.length; i++) {
          state.cuts[i].startTime = state.cuts[i - 1].startTime + state.cuts[i - 1].duration;
        }

        state.selectedCutId = newId;

        // Update duration
        const lastCut = state.cuts[state.cuts.length - 1];
        state.duration = lastCut.startTime + lastCut.duration;
      });
    },

    addMarker: (partial) => {
      const id = crypto.randomUUID();
      const marker: Marker = {
        id,
        time: get().currentTime,
        name: `Marker ${get().markers.length + 1}`,
        color: '#fbbf24',
        ...partial,
      };

      set((state) => {
        state.markers.push(marker);
        state.markers.sort((a, b) => a.time - b.time);
      });

      return id;
    },

    removeMarker: (id) => {
      set((state) => {
        const index = state.markers.findIndex(m => m.id === id);
        if (index !== -1) {
          state.markers.splice(index, 1);
        }
      });
    },

    updateMarker: (id, updates) => {
      set((state) => {
        const marker = state.markers.find(m => m.id === id);
        if (marker) {
          Object.assign(marker, updates);
          state.markers.sort((a, b) => a.time - b.time);
        }
      });
    },

    play: () => {
      set((state) => {
        state.isPlaying = true;
      });
    },

    pause: () => {
      set((state) => {
        state.isPlaying = false;
      });
    },

    stop: () => {
      set((state) => {
        state.isPlaying = false;
        state.currentTime = 0;
      });
    },

    togglePlayback: () => {
      set((state) => {
        state.isPlaying = !state.isPlaying;
      });
    },

    setCurrentTime: (time) => {
      set((state) => {
        state.currentTime = Math.max(0, Math.min(time, state.duration));
      });
    },

    seekToStart: () => {
      set((state) => {
        state.currentTime = 0;
      });
    },

    seekToEnd: () => {
      set((state) => {
        state.currentTime = state.duration;
      });
    },

    seekToCut: (cutId) => {
      set((state) => {
        const cut = state.cuts.find(c => c.id === cutId);
        if (cut) {
          state.currentTime = cut.startTime;
        }
      });
    },

    nextFrame: () => {
      set((state) => {
        const frameTime = 1 / state.frameRate;
        state.currentTime = Math.min(state.currentTime + frameTime, state.duration);
      });
    },

    prevFrame: () => {
      set((state) => {
        const frameTime = 1 / state.frameRate;
        state.currentTime = Math.max(state.currentTime - frameTime, 0);
      });
    },

    setFrameRate: (frameRate) => {
      set((state) => {
        state.frameRate = frameRate;
      });
    },

    setZoom: (zoom) => {
      set((state) => {
        state.zoom = Math.max(0.1, Math.min(zoom, 10));
      });
    },

    setScrollPosition: (position) => {
      set((state) => {
        state.scrollPosition = position;
      });
    },

    setLoop: (loop) => {
      set((state) => {
        state.loop = loop;
      });
    },

    recalculateDuration: () => {
      set((state) => {
        const lastCut = state.cuts[state.cuts.length - 1];
        state.duration = lastCut ? lastCut.startTime + lastCut.duration : 0;
      });
    },

    getCutAtTime: (time) => {
      const state = get();
      return state.cuts.find(cut =>
        time >= cut.startTime && time < cut.startTime + cut.duration
      ) ?? null;
    },
  }))
);

// Selectors
export const useSelectedCut = () => {
  return useTimelineStore((state) => {
    if (!state.selectedCutId) return null;
    return state.cuts.find(c => c.id === state.selectedCutId) ?? null;
  });
};

export const useCurrentCut = () => {
  return useTimelineStore((state) => {
    return state.cuts.find(cut =>
      state.currentTime >= cut.startTime &&
      state.currentTime < cut.startTime + cut.duration
    ) ?? null;
  });
};
