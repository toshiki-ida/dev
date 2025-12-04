import * as THREE from 'three';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ModelReference, LoadedModel, ModelLoadProgress, ModelFileType } from '@/types/model';
import { Vector3 } from '@/types/camera';

interface ModelState {
  models: LoadedModel[];
  selectedModelId: string | null;
  loadProgress: Record<string, ModelLoadProgress>;

  // Sync flags
  _isRemoteUpdate: boolean;
  _isSyncingFromServer: boolean;

  // Actions
  addModel: (reference: ModelReference, isRemote?: boolean) => void;
  removeModel: (id: string, isRemote?: boolean) => void;
  updateModel: (id: string, updates: Partial<ModelReference>, isRemote?: boolean) => void;
  replaceAllModels: (models: ModelReference[]) => void;
  selectModel: (id: string | null) => void;

  // Transform
  setModelPosition: (id: string, position: Vector3) => void;
  setModelRotation: (id: string, rotation: Vector3) => void;
  setModelScale: (id: string, scale: Vector3) => void;
  setModelTransform: (id: string, transform: { position?: Vector3; rotation?: Vector3; scale?: Vector3 }) => void;

  // Visibility
  toggleModelVisibility: (id: string) => void;
  showAllModels: () => void;
  hideAllModels: () => void;

  // Loading
  setModelObject: (id: string, object: THREE.Object3D) => void;
  setModelLoading: (id: string, isLoading: boolean) => void;
  setModelError: (id: string, error: string | undefined) => void;
  setLoadProgress: (id: string, progress: ModelLoadProgress) => void;
  clearLoadProgress: (id: string) => void;

  // 3D Gaussian Splatting
  setSplatUrl: (id: string, url: string) => void;
}

export const useModelStore = create<ModelState>()(
  immer((set) => ({
    models: [],
    selectedModelId: null,
    loadProgress: {},
    _isRemoteUpdate: false,
    _isSyncingFromServer: false,

    addModel: (reference, isRemote = false) => {
      set((state) => {
        state._isRemoteUpdate = isRemote;
        const loadedModel: LoadedModel = {
          id: reference.id,
          reference,
          object: null,
          isLoading: true,
        };
        state.models.push(loadedModel);
        if (!isRemote) {
          state.selectedModelId = reference.id;
        }
      });
    },

    removeModel: (id, isRemote = false) => {
      set((state) => {
        state._isRemoteUpdate = isRemote;
        const index = state.models.findIndex(m => m.id === id);
        if (index !== -1) {
          // Dispose Three.js object if exists
          const model = state.models[index];
          if (model.object) {
            model.object.traverse((child: THREE.Object3D) => {
              if ((child as THREE.Mesh).geometry) {
                (child as THREE.Mesh).geometry.dispose();
              }
              if ((child as THREE.Mesh).material) {
                const material = (child as THREE.Mesh).material;
                if (Array.isArray(material)) {
                  material.forEach(m => m.dispose());
                } else {
                  material.dispose();
                }
              }
            });
          }

          state.models.splice(index, 1);
          if (state.selectedModelId === id) {
            state.selectedModelId = state.models.length > 0 ? state.models[0].id : null;
          }
        }
      });
    },

    replaceAllModels: (models) => {
      set((state) => {
        state._isSyncingFromServer = true;
        state._isRemoteUpdate = true;
        // Clear existing models
        state.models = models.map(reference => ({
          id: reference.id,
          reference,
          object: null,
          isLoading: true,
        }));
        state.selectedModelId = models.length > 0 ? models[0].id : null;
      });
      // Reset flag after a microtask
      setTimeout(() => {
        set((state) => {
          state._isSyncingFromServer = false;
        });
      }, 0);
    },

    updateModel: (id, updates, isRemote = false) => {
      set((state) => {
        state._isRemoteUpdate = isRemote;
        const model = state.models.find(m => m.id === id);
        if (model) {
          Object.assign(model.reference, updates);
        }
      });
    },

    selectModel: (id) => {
      set((state) => {
        state.selectedModelId = id;
      });
    },

    setModelPosition: (id, position) => {
      set((state) => {
        const model = state.models.find(m => m.id === id);
        if (model) {
          model.reference.transform.position = position;
          if (model.object) {
            model.object.position.set(position.x, position.y, position.z);
          }
        }
      });
    },

    setModelRotation: (id, rotation) => {
      set((state) => {
        const model = state.models.find(m => m.id === id);
        if (model) {
          model.reference.transform.rotation = rotation;
          if (model.object) {
            model.object.rotation.set(
              rotation.x * (Math.PI / 180),
              rotation.y * (Math.PI / 180),
              rotation.z * (Math.PI / 180)
            );
          }
        }
      });
    },

    setModelScale: (id, scale) => {
      set((state) => {
        const model = state.models.find(m => m.id === id);
        if (model) {
          model.reference.transform.scale = scale;
          if (model.object) {
            model.object.scale.set(scale.x, scale.y, scale.z);
          }
        }
      });
    },

    setModelTransform: (id, transform) => {
      set((state) => {
        const model = state.models.find(m => m.id === id);
        if (!model) return;

        if (transform.position) {
          model.reference.transform.position = transform.position;
          if (model.object) {
            model.object.position.set(transform.position.x, transform.position.y, transform.position.z);
          }
        }
        if (transform.rotation) {
          model.reference.transform.rotation = transform.rotation;
          if (model.object) {
            model.object.rotation.set(
              transform.rotation.x * (Math.PI / 180),
              transform.rotation.y * (Math.PI / 180),
              transform.rotation.z * (Math.PI / 180)
            );
          }
        }
        if (transform.scale) {
          model.reference.transform.scale = transform.scale;
          if (model.object) {
            model.object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
          }
        }
      });
    },

    toggleModelVisibility: (id) => {
      set((state) => {
        const model = state.models.find(m => m.id === id);
        if (model) {
          model.reference.visible = !model.reference.visible;
          if (model.object) {
            model.object.visible = model.reference.visible;
          }
        }
      });
    },

    showAllModels: () => {
      set((state) => {
        state.models.forEach(model => {
          model.reference.visible = true;
          if (model.object) {
            model.object.visible = true;
          }
        });
      });
    },

    hideAllModels: () => {
      set((state) => {
        state.models.forEach(model => {
          model.reference.visible = false;
          if (model.object) {
            model.object.visible = false;
          }
        });
      });
    },

    setModelObject: (id, object) => {
      set((state) => {
        const model = state.models.find(m => m.id === id);
        if (model) {
          model.object = object;
          model.isLoading = false;

          // Apply transform
          const { position, rotation, scale } = model.reference.transform;
          object.position.set(position.x, position.y, position.z);
          object.rotation.set(
            rotation.x * (Math.PI / 180),
            rotation.y * (Math.PI / 180),
            rotation.z * (Math.PI / 180)
          );
          object.scale.set(scale.x, scale.y, scale.z);
          object.visible = model.reference.visible;
        }
      });
    },

    setModelLoading: (id, isLoading) => {
      set((state) => {
        const model = state.models.find(m => m.id === id);
        if (model) {
          model.isLoading = isLoading;
        }
      });
    },

    setModelError: (id, error) => {
      set((state) => {
        const model = state.models.find(m => m.id === id);
        if (model) {
          model.error = error;
          model.isLoading = false;
        }
      });
    },

    setLoadProgress: (id, progress) => {
      set((state) => {
        state.loadProgress[id] = progress;
      });
    },

    clearLoadProgress: (id) => {
      set((state) => {
        delete state.loadProgress[id];
      });
    },

    setSplatUrl: (id, url) => {
      set((state) => {
        const model = state.models.find(m => m.id === id);
        if (model) {
          model.splatUrl = url;
        }
      });
    },
  }))
);

// Utility function to detect file type
export function detectFileType(fileName: string): ModelFileType | null {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'gltf':
      return 'gltf';
    case 'glb':
      return 'glb';
    case 'fbx':
      return 'fbx';
    case 'obj':
      return 'obj';
    case 'usd':
      return 'usd';
    case 'usdz':
      return 'usdz';
    case 'ply':
      return 'ply';
    case 'splat':
      return 'splat';
    case 'spz':
      return 'spz';
    case 'ksplat':
      return 'ksplat';
    default:
      return null;
  }
}

// Selectors
export const useSelectedModel = () => {
  return useModelStore((state) => {
    if (!state.selectedModelId) return null;
    return state.models.find(m => m.id === state.selectedModelId) ?? null;
  });
};

export const useVisibleModels = () => {
  return useModelStore((state) => state.models.filter(m => m.reference.visible));
};
