'use client';

import { useCallback, useState } from 'react';
import { useModelStore } from '@/lib/store/useModelStore';
import { useSocketStore } from '@/lib/store/useSocketStore';
import { modelLoader } from '@/lib/three/loaders/ModelLoader';
import { objectURLManager, validateFile, getFileType } from '@/lib/utils/fileUtils';
import { ModelReference } from '@/types/model';
import type { ModelData } from '@/lib/socket/types';

interface UseModelLoaderReturn {
  loadModel: (file: File) => Promise<string | null>;
  loadModels: (files: File[]) => Promise<string[]>;
  isLoading: boolean;
  error: string | null;
}

// Convert local ModelReference to socket ModelData format
function modelToSocketData(reference: ModelReference, projectId: string): ModelData {
  return {
    id: reference.id,
    name: reference.name,
    fileName: reference.fileName,
    fileType: reference.fileType,
    fileSize: reference.fileSize,
    url: reference.url || '',
    positionX: reference.transform.position.x,
    positionY: reference.transform.position.y,
    positionZ: reference.transform.position.z,
    rotationX: reference.transform.rotation.x,
    rotationY: reference.transform.rotation.y,
    rotationZ: reference.transform.rotation.z,
    scaleX: reference.transform.scale.x,
    scaleY: reference.transform.scale.y,
    scaleZ: reference.transform.scale.z,
    visible: reference.visible,
    projectId,
  };
}

export function useModelLoader(): UseModelLoaderReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelStore = useModelStore();
  const emitModelAdd = useSocketStore((state) => state.emitModelAdd);

  const loadModel = useCallback(async (file: File): Promise<string | null> => {
    console.log('[useModelLoader] loadModel called:', { fileName: file.name, size: file.size });

    // Validate file
    const validation = validateFile(file);
    console.log('[useModelLoader] validation result:', validation);
    if (!validation.valid) {
      console.error('[useModelLoader] validation failed:', validation.error);
      setError(validation.error || 'Invalid file');
      return null;
    }

    const fileType = getFileType(file.name);
    console.log('[useModelLoader] fileType:', fileType);
    if (!fileType) {
      console.error('[useModelLoader] unsupported file type');
      setError('Unsupported file type');
      return null;
    }

    const modelId = crypto.randomUUID();
    console.log('[useModelLoader] generated modelId:', modelId);

    try {
      setIsLoading(true);
      setError(null);

      // Upload file to server if connected
      // Get latest socket state directly from store to avoid stale closure
      const socketState = useSocketStore.getState();
      const isConnected = socketState.isConnected;
      const currentProjectId = socketState.projectId || 'default-project';
      let serverUrl: string | undefined;

      console.log('[useModelLoader] socket state:', { isConnected, currentProjectId });

      if (isConnected) {
        console.log('[useModelLoader] uploading to server...');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', currentProjectId);
        formData.append('modelId', modelId);

        const uploadResponse = await fetch('/api/models', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          serverUrl = uploadResult.url;
          console.log('[useModelLoader] uploaded to server:', serverUrl);
        } else {
          console.warn('[useModelLoader] failed to upload to server, using local URL');
        }
      }

      // Create model reference
      const reference: ModelReference = {
        id: modelId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        fileType,
        fileSize: file.size,
        url: serverUrl,
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        createdAt: new Date(),
      };

      // Add model to store (loading state)
      modelStore.addModel(reference);

      // Emit to other users via socket
      if (isConnected && serverUrl) {
        console.log('[useModelLoader] emitting model:add to other users');
        emitModelAdd(modelToSocketData(reference, currentProjectId));
      }

      // Use server URL if available, otherwise create object URL
      const url = serverUrl || objectURLManager.create(file, modelId);
      console.log('[useModelLoader] using URL:', url);

      // Update progress
      modelStore.setLoadProgress(modelId, {
        modelId,
        progress: 0,
        status: 'loading',
        message: 'Loading file...',
      });

      if (fileType === 'ply' || fileType === 'splat' || fileType === 'spz' || fileType === 'ksplat') {
        // Load 3D Gaussian Splatting
        // For 3DGS, we store the URL and let GaussianSplatViewer handle the loading
        console.log('[useModelLoader] setting up Gaussian Splat for rendering');

        modelStore.setLoadProgress(modelId, {
          modelId,
          progress: 0.5,
          status: 'processing',
          message: 'Preparing Gaussian Splat...',
        });

        // Store the URL for 3DGS rendering
        modelStore.setSplatUrl(modelId, url);
        modelStore.setModelLoading(modelId, false);
        console.log('[useModelLoader] Gaussian Splat URL set:', url);
      } else {
        // Load standard 3D model
        console.log('[useModelLoader] loading as standard 3D model');
        const result = await modelLoader.load(url, file.name, (progress) => {
          console.log('[useModelLoader] load progress:', progress);
          modelStore.setLoadProgress(modelId, {
            modelId,
            progress,
            status: 'loading',
            message: 'Loading model...',
          });
        });

        const object = result.object;
        console.log('[useModelLoader] model loaded successfully:', object);

        // Set model object in store
        modelStore.setModelObject(modelId, object);
        console.log('[useModelLoader] model added to store');
      }

      // Clear progress
      modelStore.setLoadProgress(modelId, {
        modelId,
        progress: 1,
        status: 'complete',
        message: 'Complete',
      });

      setTimeout(() => {
        modelStore.clearLoadProgress(modelId);
      }, 1000);

      return modelId;
    } catch (err) {
      console.error('[useModelLoader] error loading model:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load model';
      setError(errorMessage);
      modelStore.setModelError(modelId, errorMessage);
      modelStore.setLoadProgress(modelId, {
        modelId,
        progress: 0,
        status: 'error',
        message: errorMessage,
      });

      // Clean up
      objectURLManager.revoke(modelId);

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [modelStore, emitModelAdd]);

  const loadModels = useCallback(async (files: File[]): Promise<string[]> => {
    const modelIds: string[] = [];

    for (const file of files) {
      const modelId = await loadModel(file);
      if (modelId) {
        modelIds.push(modelId);
      }
    }

    return modelIds;
  }, [loadModel]);

  return {
    loadModel,
    loadModels,
    isLoading,
    error,
  };
}
