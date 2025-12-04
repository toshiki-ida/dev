import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ViewerLayout } from '@/types/camera';

interface ViewportConfig {
  id: string;
  cameraId: string | null;
  showOverlay: boolean;
  showSafeFrames: boolean;
  showGrid: boolean;
}

interface ViewerState {
  layout: ViewerLayout;
  viewports: ViewportConfig[];
  activeViewportId: string | null;
  fullscreenViewportId: string | null;

  // Display settings
  showCameraGizmos: boolean;
  showGrid: boolean;
  showSafeFrames: boolean;
  backgroundColor: string;

  // Actions
  setLayout: (layout: ViewerLayout) => void;
  setViewportCamera: (viewportId: string, cameraId: string | null) => void;
  setActiveViewport: (viewportId: string | null) => void;
  toggleFullscreen: (viewportId: string | null) => void;
  updateViewportSettings: (viewportId: string, settings: Partial<ViewportConfig>) => void;

  // Global display toggles
  toggleCameraGizmos: () => void;
  toggleGrid: () => void;
  toggleSafeFrames: () => void;
  setBackgroundColor: (color: string) => void;
}

const createViewports = (layout: ViewerLayout): ViewportConfig[] => {
  let count = 1;

  if (layout === 'single') count = 1;
  else if (layout === 'dual-h' || layout === 'dual-v') count = 2;
  else if (layout === 'triple') count = 3;
  else if (layout === 'quad') count = 4;
  else if (layout === 'six') count = 6;
  else if (layout === 'nine') count = 9;
  else if (typeof layout === 'object' && layout.type === 'custom') {
    count = layout.cols * layout.rows;
  }

  return Array.from({ length: count }, (_, i) => ({
    id: `viewport-${i}`,
    cameraId: null,
    showOverlay: true,
    showSafeFrames: true,
    showGrid: false,
  }));
};

export const useViewerStore = create<ViewerState>()(
  immer((set) => ({
    layout: 'quad',
    viewports: createViewports('quad'),
    activeViewportId: null,
    fullscreenViewportId: null,

    showCameraGizmos: true,
    showGrid: true,
    showSafeFrames: true,
    backgroundColor: '#1a1a2e',

    setLayout: (layout) => {
      set((state) => {
        const oldViewports = state.viewports;
        const newViewports = createViewports(layout);

        // Preserve camera assignments where possible
        newViewports.forEach((viewport, i) => {
          if (oldViewports[i]) {
            viewport.cameraId = oldViewports[i].cameraId;
          }
        });

        state.layout = layout;
        state.viewports = newViewports;
        state.fullscreenViewportId = null;
      });
    },

    setViewportCamera: (viewportId, cameraId) => {
      set((state) => {
        const viewport = state.viewports.find(v => v.id === viewportId);
        if (viewport) {
          viewport.cameraId = cameraId;
        }
      });
    },

    setActiveViewport: (viewportId) => {
      set((state) => {
        state.activeViewportId = viewportId;
      });
    },

    toggleFullscreen: (viewportId) => {
      set((state) => {
        if (state.fullscreenViewportId === viewportId) {
          state.fullscreenViewportId = null;
        } else {
          state.fullscreenViewportId = viewportId;
        }
      });
    },

    updateViewportSettings: (viewportId, settings) => {
      set((state) => {
        const viewport = state.viewports.find(v => v.id === viewportId);
        if (viewport) {
          Object.assign(viewport, settings);
        }
      });
    },

    toggleCameraGizmos: () => {
      set((state) => {
        state.showCameraGizmos = !state.showCameraGizmos;
      });
    },

    toggleGrid: () => {
      set((state) => {
        state.showGrid = !state.showGrid;
      });
    },

    toggleSafeFrames: () => {
      set((state) => {
        state.showSafeFrames = !state.showSafeFrames;
      });
    },

    setBackgroundColor: (color) => {
      set((state) => {
        state.backgroundColor = color;
      });
    },
  }))
);

// Layout helpers
export const getLayoutDimensions = (layout: ViewerLayout): { cols: number; rows: number } => {
  if (layout === 'single') return { cols: 1, rows: 1 };
  if (layout === 'dual-h') return { cols: 2, rows: 1 };
  if (layout === 'dual-v') return { cols: 1, rows: 2 };
  if (layout === 'triple') return { cols: 3, rows: 1 };
  if (layout === 'quad') return { cols: 2, rows: 2 };
  if (layout === 'six') return { cols: 2, rows: 3 };
  if (layout === 'nine') return { cols: 3, rows: 3 };
  if (typeof layout === 'object' && layout.type === 'custom') {
    return { cols: layout.cols, rows: layout.rows };
  }
  return { cols: 2, rows: 2 };
};
