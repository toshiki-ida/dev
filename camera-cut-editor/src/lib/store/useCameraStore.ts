import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Camera, Vector3 } from '@/types/camera';
import { calculateVerticalFOV } from '@/lib/utils/mathUtils';
import { CAMERA_COLORS } from '@/lib/constants';
import { getSensorPreset } from '@/lib/constants/sensorPresets';

interface CameraState {
  cameras: Camera[];
  selectedCameraId: string | null;
  programCameraId: string | null; // Camera currently "on air"

  // Sync flag to prevent re-emitting received updates
  _isRemoteUpdate: boolean;
  // Flag to indicate initial sync from server is in progress
  _isSyncingFromServer: boolean;

  // Actions
  addCamera: (partial?: Partial<Camera>, isRemote?: boolean) => string;
  removeCamera: (id: string, isRemote?: boolean) => void;
  // Batch replace all cameras (used during initial sync)
  replaceAllCameras: (cameras: Camera[]) => void;
  updateCamera: (id: string, updates: Partial<Camera>, isRemote?: boolean) => void;
  selectCamera: (id: string | null) => void;
  setProgramCamera: (id: string | null, isRemote?: boolean) => void;
  duplicateCamera: (id: string) => void;
  reorderCameras: (fromIndex: number, toIndex: number) => void;

  // Lens/Sensor helpers
  setFocalLength: (id: string, focalLength: number) => void;
  setSensorPreset: (id: string, presetId: string) => void;
  setCameraPosition: (id: string, position: Vector3, isRemote?: boolean) => void;
  setCameraPanTiltRoll: (id: string, pan: number, tilt: number, roll: number, isRemote?: boolean) => void;

  // Batch operations
  enableAllCameras: () => void;
  disableAllCameras: () => void;
  resetCamera: (id: string) => void;
}

const getNextCameraColor = (cameras: Camera[]): string => {
  const usedColors = new Set(cameras.map(c => c.color));
  const availableColor = CAMERA_COLORS.find(c => !usedColors.has(c));
  return availableColor || CAMERA_COLORS[cameras.length % CAMERA_COLORS.length];
};

export const useCameraStore = create<CameraState>()(
  immer((set, get) => ({
    cameras: [],
    selectedCameraId: null,
    programCameraId: null,
    _isRemoteUpdate: false,
    _isSyncingFromServer: false,

    addCamera: (partial, isRemote = false) => {
      const id = crypto.randomUUID();
      const state = get();
      const cameraNumber = state.cameras.length + 1;

      const defaultSensor = getSensorPreset('super35-4perf');
      const sensorWidth = defaultSensor?.width ?? 24.89;
      const sensorHeight = defaultSensor?.height ?? 18.66;
      const focalLength = 35;

      const defaultCamera: Camera = {
        id,
        name: `Camera ${cameraNumber}`,
        position: { x: 5, y: 2, z: 5 },
        pan: -45,             // degrees
        tilt: -10,            // degrees
        roll: 0,
        sensorPreset: 'super35-4perf',
        sensorWidth,
        sensorHeight,
        focalLength,
        fov: calculateVerticalFOV(focalLength, sensorHeight),
        aperture: 2.8,
        focusDistance: 5,
        enabled: true,
        color: getNextCameraColor(state.cameras),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...partial,
      };

      set((state) => {
        state._isRemoteUpdate = isRemote;
        state.cameras.push(defaultCamera);
        if (!isRemote) {
          state.selectedCameraId = id;
        }
      });

      return id;
    },

    removeCamera: (id, isRemote = false) => {
      set((state) => {
        state._isRemoteUpdate = isRemote;
        const index = state.cameras.findIndex(c => c.id === id);
        if (index !== -1) {
          state.cameras.splice(index, 1);
          if (state.selectedCameraId === id) {
            state.selectedCameraId = state.cameras.length > 0 ? state.cameras[0].id : null;
          }
          if (state.programCameraId === id) {
            state.programCameraId = null;
          }
        }
      });
    },

    replaceAllCameras: (cameras) => {
      set((state) => {
        state._isSyncingFromServer = true;
        state._isRemoteUpdate = true;
        state.cameras = cameras;
        state.selectedCameraId = cameras.length > 0 ? cameras[0].id : null;
      });
      // Reset flag after a microtask to allow sync hook to see it
      setTimeout(() => {
        set((state) => {
          state._isSyncingFromServer = false;
        });
      }, 0);
    },

    updateCamera: (id, updates, isRemote = false) => {
      set((state) => {
        state._isRemoteUpdate = isRemote;
        const camera = state.cameras.find(c => c.id === id);
        if (!camera) return;

        Object.assign(camera, updates);
        camera.updatedAt = new Date();

        // Recalculate FOV if focal length or sensor changes
        if (updates.focalLength !== undefined || updates.sensorHeight !== undefined) {
          camera.fov = calculateVerticalFOV(camera.focalLength, camera.sensorHeight);
        }
      });
    },

    selectCamera: (id) => {
      set((state) => {
        state.selectedCameraId = id;
      });
    },

    setProgramCamera: (id, isRemote = false) => {
      set((state) => {
        state._isRemoteUpdate = isRemote;
        state.programCameraId = id;
      });
    },

    duplicateCamera: (id) => {
      const state = get();
      const camera = state.cameras.find(c => c.id === id);
      if (!camera) return;

      const newId = crypto.randomUUID();
      set((state) => {
        const newCamera: Camera = {
          ...camera,
          id: newId,
          name: `${camera.name} Copy`,
          position: {
            x: camera.position.x + 1,
            y: camera.position.y,
            z: camera.position.z + 1,
          },
          color: getNextCameraColor(state.cameras),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.cameras.push(newCamera);
        state.selectedCameraId = newId;
      });
    },

    reorderCameras: (fromIndex, toIndex) => {
      set((state) => {
        const [removed] = state.cameras.splice(fromIndex, 1);
        state.cameras.splice(toIndex, 0, removed);
      });
    },

    setFocalLength: (id, focalLength) => {
      set((state) => {
        const camera = state.cameras.find(c => c.id === id);
        if (!camera) return;

        camera.focalLength = focalLength;
        camera.fov = calculateVerticalFOV(focalLength, camera.sensorHeight);
        camera.updatedAt = new Date();
      });
    },

    setSensorPreset: (id, presetId) => {
      set((state) => {
        const camera = state.cameras.find(c => c.id === id);
        if (!camera) return;

        const preset = getSensorPreset(presetId);
        if (!preset) return;

        camera.sensorPreset = presetId;
        camera.sensorWidth = preset.width;
        camera.sensorHeight = preset.height;
        camera.fov = calculateVerticalFOV(camera.focalLength, camera.sensorHeight);
        camera.updatedAt = new Date();
      });
    },

    setCameraPosition: (id, position, isRemote = false) => {
      set((state) => {
        state._isRemoteUpdate = isRemote;
        const camera = state.cameras.find(c => c.id === id);
        if (!camera) return;

        camera.position = position;
        camera.updatedAt = new Date();
      });
    },

    setCameraPanTiltRoll: (id, pan, tilt, roll, isRemote = false) => {
      set((state) => {
        state._isRemoteUpdate = isRemote;
        const camera = state.cameras.find(c => c.id === id);
        if (!camera) return;

        camera.pan = pan;
        camera.tilt = tilt;
        camera.roll = roll;
        camera.updatedAt = new Date();
      });
    },

    enableAllCameras: () => {
      set((state) => {
        state.cameras.forEach(camera => {
          camera.enabled = true;
          camera.updatedAt = new Date();
        });
      });
    },

    disableAllCameras: () => {
      set((state) => {
        state.cameras.forEach(camera => {
          camera.enabled = false;
          camera.updatedAt = new Date();
        });
      });
    },

    resetCamera: (id) => {
      set((state) => {
        const camera = state.cameras.find(c => c.id === id);
        if (!camera) return;

        camera.position = { x: 5, y: 2, z: 5 };
        camera.pan = -45;
        camera.tilt = -10;
        camera.roll = 0;
        camera.focalLength = 35;
        camera.fov = calculateVerticalFOV(35, camera.sensorHeight);
        camera.updatedAt = new Date();
      });
    },
  }))
);

// Selectors
export const useSelectedCamera = () => {
  return useCameraStore((state) => {
    if (!state.selectedCameraId) return null;
    return state.cameras.find(c => c.id === state.selectedCameraId) ?? null;
  });
};

export const useProgramCamera = () => {
  return useCameraStore((state) => {
    if (!state.programCameraId) return null;
    return state.cameras.find(c => c.id === state.programCameraId) ?? null;
  });
};

export const useEnabledCameras = () => {
  return useCameraStore((state) => state.cameras.filter(c => c.enabled));
};
