'use client';

import { useEffect, useCallback } from 'react';
import { useSocketStore } from '@/lib/store/useSocketStore';
import { useCameraStore } from '@/lib/store/useCameraStore';
import { useModelStore } from '@/lib/store/useModelStore';
import { useCameraSync } from '@/hooks/useCameraSync';
import { useModelSync } from '@/hooks/useModelSync';
import type { CameraUpdate, CameraData, ModelData, ModelUpdate } from '@/lib/socket/types';
import type { ModelReference, ModelFileType } from '@/types/model';
import { modelLoader } from '@/lib/three/loaders/ModelLoader';

interface SocketProviderProps {
  children: React.ReactNode;
  projectId?: string;
}

// Convert CameraData (socket format) to local Camera format
function cameraDataToLocal(data: CameraData) {
  return {
    id: data.id,
    name: data.name,
    position: { x: data.positionX, y: data.positionY, z: data.positionZ },
    pan: data.pan,
    tilt: data.tilt,
    roll: data.roll,
    fov: data.fov,
    focalLength: data.focalLength,
    sensorPreset: data.sensorPreset,
    sensorWidth: data.sensorWidth,
    sensorHeight: data.sensorHeight,
    color: data.color,
    enabled: data.enabled,
    aperture: 2.8,
    focusDistance: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Convert ModelData (socket format) to local ModelReference format
function modelDataToLocal(data: ModelData): ModelReference {
  return {
    id: data.id,
    name: data.name,
    fileName: data.fileName,
    fileType: data.fileType as ModelFileType,
    fileSize: data.fileSize,
    url: data.url,
    transform: {
      position: { x: data.positionX, y: data.positionY, z: data.positionZ },
      rotation: { x: data.rotationX, y: data.rotationY, z: data.rotationZ },
      scale: { x: data.scaleX, y: data.scaleY, z: data.scaleZ },
    },
    visible: data.visible,
    createdAt: new Date(),
  };
}

export function SocketProvider({ children, projectId }: SocketProviderProps) {
  const socket = useSocketStore((state) => state.socket);
  const connect = useSocketStore((state) => state.connect);
  const disconnect = useSocketStore((state) => state.disconnect);
  const addCamera = useCameraStore((state) => state.addCamera);
  const removeCamera = useCameraStore((state) => state.removeCamera);
  const updateCamera = useCameraStore((state) => state.updateCamera);
  const setProgramCamera = useCameraStore((state) => state.setProgramCamera);
  const replaceAllCameras = useCameraStore((state) => state.replaceAllCameras);
  const cameras = useCameraStore((state) => state.cameras);

  const addModel = useModelStore((state) => state.addModel);
  const removeModel = useModelStore((state) => state.removeModel);
  const updateModel = useModelStore((state) => state.updateModel);
  const replaceAllModels = useModelStore((state) => state.replaceAllModels);
  const setSplatUrl = useModelStore((state) => state.setSplatUrl);
  const setModelLoading = useModelStore((state) => state.setModelLoading);
  const setModelObject = useModelStore((state) => state.setModelObject);
  const setModelError = useModelStore((state) => state.setModelError);

  // Enable camera sync to emit local changes to other users
  useCameraSync();
  // Enable model sync to emit local changes (delete, transform) to other users
  useModelSync();

  // Helper function to load a model from server URL
  const loadModelFromUrl = useCallback(
    async (modelData: ModelData) => {
      const fileType = modelData.fileType;
      const is3DGS = fileType === 'ply' || fileType === 'splat' || fileType === 'spz' || fileType === 'ksplat';

      if (is3DGS) {
        // 3DGS models just need the URL set
        setSplatUrl(modelData.id, modelData.url);
        setModelLoading(modelData.id, false);
        console.log('[Socket] 3DGS model URL set:', modelData.name);
      } else {
        // Standard 3D models need to be loaded via modelLoader
        try {
          console.log('[Socket] Loading model from server:', modelData.name, modelData.url);
          const result = await modelLoader.load(modelData.url, modelData.fileName);
          setModelObject(modelData.id, result.object);
          console.log('[Socket] Model loaded successfully:', modelData.name);
        } catch (error) {
          console.error('[Socket] Failed to load model:', modelData.name, error);
          setModelError(modelData.id, error instanceof Error ? error.message : 'Failed to load model');
        }
      }
    },
    [setSplatUrl, setModelLoading, setModelObject, setModelError]
  );

  // Handle project data (initial sync)
  const handleProjectData = useCallback(
    ({ cameras: camerasData, models: modelsData, programCameraId }: { cameras: CameraData[]; models: ModelData[]; programCameraId: string | null }) => {
      console.log('[Socket] Received project data:', camerasData.length, 'cameras,', modelsData?.length || 0, 'models');

      // Replace all cameras at once (this sets _isSyncingFromServer flag)
      const localCameras = camerasData.map(cameraDataToLocal);
      replaceAllCameras(localCameras);

      // Replace all models at once
      if (modelsData && modelsData.length > 0) {
        const localModels = modelsData.map(modelDataToLocal);
        replaceAllModels(localModels);

        // Load each model from the server
        modelsData.forEach((modelData) => {
          loadModelFromUrl(modelData);
        });
      }

      // Set program camera
      if (programCameraId) {
        setProgramCamera(programCameraId, true);
      }
    },
    [replaceAllCameras, replaceAllModels, loadModelFromUrl, setProgramCamera]
  );

  // Handle camera created by other users
  const handleCameraCreated = useCallback(
    (cameraData: CameraData) => {
      // Check if camera already exists (to prevent duplicates)
      const exists = useCameraStore.getState().cameras.some(c => c.id === cameraData.id);
      if (exists) {
        console.log('[Socket] Camera already exists, skipping:', cameraData.name);
        return;
      }
      console.log('[Socket] Camera created by other user:', cameraData.name);
      addCamera(cameraDataToLocal(cameraData), true);
    },
    [addCamera]
  );

  // Handle camera deleted by other users
  const handleCameraDeleted = useCallback(
    ({ cameraId }: { cameraId: string }) => {
      console.log('[Socket] Camera deleted by other user:', cameraId);
      removeCamera(cameraId, true);
    },
    [removeCamera]
  );

  // Handle camera updates from other users
  const handleCameraUpdated = useCallback(
    ({ cameraId, update }: { cameraId: string; update: Partial<CameraUpdate>; userId: string }) => {
      // Convert socket update format to local camera format
      const localUpdate: Record<string, unknown> = {};

      if (update.positionX !== undefined || update.positionY !== undefined || update.positionZ !== undefined) {
        const camera = cameras.find((c) => c.id === cameraId);
        if (camera) {
          localUpdate.position = {
            x: update.positionX ?? camera.position.x,
            y: update.positionY ?? camera.position.y,
            z: update.positionZ ?? camera.position.z,
          };
        }
      }

      if (update.pan !== undefined) localUpdate.pan = update.pan;
      if (update.tilt !== undefined) localUpdate.tilt = update.tilt;
      if (update.roll !== undefined) localUpdate.roll = update.roll;
      if (update.fov !== undefined) localUpdate.fov = update.fov;
      if (update.focalLength !== undefined) localUpdate.focalLength = update.focalLength;
      if (update.name !== undefined) localUpdate.name = update.name;

      if (Object.keys(localUpdate).length > 0) {
        // Mark as remote update to prevent re-emitting
        updateCamera(cameraId, localUpdate, true);
      }
    },
    [cameras, updateCamera]
  );

  // Handle camera live status changes
  const handleCameraLive = useCallback(
    ({ cameraId, isLive }: { cameraId: string; isLive: boolean }) => {
      if (isLive) {
        // Mark as remote update
        setProgramCamera(cameraId, true);
      } else {
        // If this camera was the program camera and is now not live, clear it
        const currentProgramId = useCameraStore.getState().programCameraId;
        if (currentProgramId === cameraId) {
          setProgramCamera(null, true);
        }
      }
    },
    [setProgramCamera]
  );

  // Handle model added by other users
  const handleModelAdded = useCallback(
    (modelData: ModelData) => {
      // Check if model already exists
      const exists = useModelStore.getState().models.some(m => m.id === modelData.id);
      if (exists) {
        console.log('[Socket] Model already exists, skipping:', modelData.name);
        return;
      }
      console.log('[Socket] Model added by other user:', modelData.name);
      const localModel = modelDataToLocal(modelData);
      addModel(localModel, true);

      // Load the model from server URL
      loadModelFromUrl(modelData);
    },
    [addModel, loadModelFromUrl]
  );

  // Handle model deleted by other users
  const handleModelDeleted = useCallback(
    ({ modelId }: { modelId: string }) => {
      console.log('[Socket] Model deleted by other user:', modelId);
      removeModel(modelId, true);
    },
    [removeModel]
  );

  // Handle model updates from other users
  const handleModelUpdated = useCallback(
    ({ modelId, update }: { modelId: string; update: Partial<ModelUpdate> }) => {
      const localUpdate: Partial<ModelReference> = {};

      if (update.name !== undefined) localUpdate.name = update.name;
      if (update.visible !== undefined) localUpdate.visible = update.visible;

      // Handle transform updates
      if (update.positionX !== undefined || update.positionY !== undefined || update.positionZ !== undefined) {
        const model = useModelStore.getState().models.find(m => m.id === modelId);
        if (model) {
          localUpdate.transform = {
            ...model.reference.transform,
            position: {
              x: update.positionX ?? model.reference.transform.position.x,
              y: update.positionY ?? model.reference.transform.position.y,
              z: update.positionZ ?? model.reference.transform.position.z,
            },
          };
        }
      }

      if (update.rotationX !== undefined || update.rotationY !== undefined || update.rotationZ !== undefined) {
        const model = useModelStore.getState().models.find(m => m.id === modelId);
        if (model) {
          localUpdate.transform = {
            ...model.reference.transform,
            ...localUpdate.transform,
            rotation: {
              x: update.rotationX ?? model.reference.transform.rotation.x,
              y: update.rotationY ?? model.reference.transform.rotation.y,
              z: update.rotationZ ?? model.reference.transform.rotation.z,
            },
          };
        }
      }

      if (update.scaleX !== undefined || update.scaleY !== undefined || update.scaleZ !== undefined) {
        const model = useModelStore.getState().models.find(m => m.id === modelId);
        if (model) {
          localUpdate.transform = {
            ...model.reference.transform,
            ...localUpdate.transform,
            scale: {
              x: update.scaleX ?? model.reference.transform.scale.x,
              y: update.scaleY ?? model.reference.transform.scale.y,
              z: update.scaleZ ?? model.reference.transform.scale.z,
            },
          };
        }
      }

      if (Object.keys(localUpdate).length > 0) {
        updateModel(modelId, localUpdate, true);
      }
    },
    [updateModel]
  );

  // Connect to project on mount
  useEffect(() => {
    if (projectId) {
      connect(projectId);
    }

    return () => {
      disconnect();
    };
  }, [projectId, connect, disconnect]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('project:data', handleProjectData);
    socket.on('camera:created', handleCameraCreated);
    socket.on('camera:updated', handleCameraUpdated);
    socket.on('camera:deleted', handleCameraDeleted);
    socket.on('camera:live', handleCameraLive);
    socket.on('model:added', handleModelAdded);
    socket.on('model:updated', handleModelUpdated);
    socket.on('model:deleted', handleModelDeleted);

    return () => {
      socket.off('project:data', handleProjectData);
      socket.off('camera:created', handleCameraCreated);
      socket.off('camera:updated', handleCameraUpdated);
      socket.off('camera:deleted', handleCameraDeleted);
      socket.off('camera:live', handleCameraLive);
      socket.off('model:added', handleModelAdded);
      socket.off('model:updated', handleModelUpdated);
      socket.off('model:deleted', handleModelDeleted);
    };
  }, [socket, handleProjectData, handleCameraCreated, handleCameraUpdated, handleCameraDeleted, handleCameraLive, handleModelAdded, handleModelUpdated, handleModelDeleted]);

  return <>{children}</>;
}
