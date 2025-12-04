import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Project, ProjectSettings, DEFAULT_PROJECT_SETTINGS, createNewProject } from '@/types/project';
import { useCameraStore } from './useCameraStore';
import { useModelStore } from './useModelStore';
import { useTimelineStore } from './useTimelineStore';
import { useViewerStore } from './useViewerStore';

interface ProjectState {
  project: Project | null;
  isDirty: boolean;
  lastSaved: Date | null;

  // Actions
  newProject: (name?: string) => void;
  setProjectName: (name: string) => void;
  updateSettings: (settings: Partial<ProjectSettings>) => void;
  markDirty: () => void;
  markClean: () => void;

  // Save/Load
  saveProject: () => string; // Returns JSON string
  loadProject: (json: string) => void;
  exportProject: () => Blob;
}

export const useProjectStore = create<ProjectState>()(
  immer((set, get) => ({
    project: null,
    isDirty: false,
    lastSaved: null,

    newProject: (name = 'Untitled Project') => {
      // Reset all stores
      useCameraStore.setState({ cameras: [], selectedCameraId: null, programCameraId: null });
      useModelStore.setState({ models: [], selectedModelId: null, loadProgress: {} });
      useTimelineStore.setState({
        cuts: [],
        markers: [],
        selectedCutId: null,
        currentTime: 0,
        duration: 0,
        isPlaying: false,
      });
      useViewerStore.getState().setLayout('quad');

      const project = createNewProject(name);

      set((state) => {
        state.project = project;
        state.isDirty = false;
        state.lastSaved = null;
      });
    },

    setProjectName: (name) => {
      set((state) => {
        if (state.project) {
          state.project.name = name;
          state.project.updatedAt = new Date();
          state.isDirty = true;
        }
      });
    },

    updateSettings: (settings) => {
      set((state) => {
        if (state.project) {
          Object.assign(state.project.settings, settings);
          state.project.updatedAt = new Date();
          state.isDirty = true;
        }
      });

      // Apply settings to viewer store
      const viewerStore = useViewerStore.getState();
      if (settings.viewerLayout) {
        viewerStore.setLayout(settings.viewerLayout);
      }
      if (settings.gridVisible !== undefined) {
        if (settings.gridVisible !== viewerStore.showGrid) {
          viewerStore.toggleGrid();
        }
      }
      if (settings.cameraGizmosVisible !== undefined) {
        if (settings.cameraGizmosVisible !== viewerStore.showCameraGizmos) {
          viewerStore.toggleCameraGizmos();
        }
      }
      if (settings.backgroundColor) {
        viewerStore.setBackgroundColor(settings.backgroundColor);
      }
    },

    markDirty: () => {
      set((state) => {
        state.isDirty = true;
        if (state.project) {
          state.project.updatedAt = new Date();
        }
      });
    },

    markClean: () => {
      set((state) => {
        state.isDirty = false;
        state.lastSaved = new Date();
      });
    },

    saveProject: () => {
      const state = get();
      if (!state.project) {
        throw new Error('No project to save');
      }

      // Gather data from all stores
      const cameraState = useCameraStore.getState();
      const modelState = useModelStore.getState();
      const timelineState = useTimelineStore.getState();
      const viewerState = useViewerStore.getState();

      const projectData = {
        ...state.project,
        cameras: cameraState.cameras,
        models: modelState.models.map(m => m.reference),
        cutList: timelineState.cuts,
        markers: timelineState.markers,
        settings: {
          ...state.project.settings,
          viewerLayout: viewerState.layout,
          gridVisible: viewerState.showGrid,
          cameraGizmosVisible: viewerState.showCameraGizmos,
          backgroundColor: viewerState.backgroundColor,
          frameRate: timelineState.frameRate,
        },
        updatedAt: new Date(),
      };

      set((state) => {
        state.isDirty = false;
        state.lastSaved = new Date();
      });

      return JSON.stringify(projectData, null, 2);
    },

    loadProject: (json) => {
      try {
        const data = JSON.parse(json) as Project;

        // Restore all stores
        useCameraStore.setState({
          cameras: data.cameras.map(c => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          })),
          selectedCameraId: data.cameras.length > 0 ? data.cameras[0].id : null,
          programCameraId: null,
        });

        // Models need to be reloaded, we just restore references
        useModelStore.setState({
          models: data.models.map(ref => ({
            id: ref.id,
            reference: {
              ...ref,
              createdAt: new Date(ref.createdAt),
            },
            object: null,
            isLoading: false, // Will be loaded when files are dropped again
          })),
          selectedModelId: data.models.length > 0 ? data.models[0].id : null,
          loadProgress: {},
        });

        useTimelineStore.setState({
          cuts: data.cutList,
          markers: data.markers || [],
          selectedCutId: data.cutList.length > 0 ? data.cutList[0].id : null,
          currentTime: 0,
          duration: data.cutList.reduce((acc, cut) => Math.max(acc, cut.startTime + cut.duration), 0),
          isPlaying: false,
          frameRate: data.settings.frameRate,
        });

        const viewerStore = useViewerStore.getState();
        viewerStore.setLayout(data.settings.viewerLayout);
        if (data.settings.gridVisible !== viewerStore.showGrid) {
          viewerStore.toggleGrid();
        }
        if (data.settings.cameraGizmosVisible !== viewerStore.showCameraGizmos) {
          viewerStore.toggleCameraGizmos();
        }
        viewerStore.setBackgroundColor(data.settings.backgroundColor);

        set((state) => {
          state.project = {
            ...data,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
          };
          state.isDirty = false;
          state.lastSaved = null;
        });
      } catch (error) {
        console.error('Failed to load project:', error);
        throw new Error('Invalid project file');
      }
    },

    exportProject: () => {
      const json = get().saveProject();
      return new Blob([json], { type: 'application/json' });
    },
  }))
);

// Initialize with a new project
if (typeof window !== 'undefined') {
  // Only run on client
  setTimeout(() => {
    const state = useProjectStore.getState();
    if (!state.project) {
      state.newProject();
    }
  }, 0);
}
