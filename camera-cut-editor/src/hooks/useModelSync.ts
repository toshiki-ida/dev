'use client';

import { useEffect, useRef } from 'react';
import { useModelStore } from '@/lib/store/useModelStore';
import { useSocketStore } from '@/lib/store/useSocketStore';
import type { ModelUpdate } from '@/lib/socket/types';

/**
 * Hook that syncs model changes (delete, transform updates) to other users via Socket.io
 * Model add is handled in useModelLoader since it requires file upload
 */
export function useModelSync() {
  const models = useModelStore((state) => state.models);
  const isRemoteUpdate = useModelStore((state) => state._isRemoteUpdate);
  const isSyncingFromServer = useModelStore((state) => state._isSyncingFromServer);
  const emitModelDelete = useSocketStore((state) => state.emitModelDelete);
  const emitModelUpdate = useSocketStore((state) => state.emitModelUpdate);
  const isConnected = useSocketStore((state) => state.isConnected);

  // Track previous values for comparison
  const prevModelIdsRef = useRef<Set<string>>(new Set());
  const prevModelsRef = useRef<Map<string, string>>(new Map());
  const isInitializedRef = useRef(false);

  // Sync model delete and updates
  useEffect(() => {
    // Skip if remote update or syncing from server
    if (!isConnected || isRemoteUpdate || isSyncingFromServer) {
      // If syncing from server, just update the refs without emitting
      if (isSyncingFromServer) {
        const currentIds = new Set(models.map(m => m.id));
        prevModelIdsRef.current = currentIds;
        models.forEach((model) => {
          const modelKey = JSON.stringify({
            transform: model.reference.transform,
            visible: model.reference.visible,
            name: model.reference.name,
          });
          prevModelsRef.current.set(model.id, modelKey);
        });
        // Clean up old refs
        prevModelsRef.current.forEach((_, id) => {
          if (!currentIds.has(id)) {
            prevModelsRef.current.delete(id);
          }
        });
        isInitializedRef.current = true;
      }
      return;
    }

    // Skip first render to avoid emitting on initial load
    if (!isInitializedRef.current) {
      const currentIds = new Set(models.map(m => m.id));
      prevModelIdsRef.current = currentIds;
      models.forEach((model) => {
        const modelKey = JSON.stringify({
          transform: model.reference.transform,
          visible: model.reference.visible,
          name: model.reference.name,
        });
        prevModelsRef.current.set(model.id, modelKey);
      });
      isInitializedRef.current = true;
      return;
    }

    const currentIds = new Set(models.map(m => m.id));

    // Detect removed models (deleted locally) - model add is handled in useModelLoader
    prevModelIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        // Model removed - emit delete
        emitModelDelete(id);
        console.log('[ModelSync] Emitting model:delete', id);
      }
    });

    // Update tracking
    prevModelIdsRef.current = currentIds;

    // Check for model property changes
    models.forEach((model) => {
      const modelKey = JSON.stringify({
        transform: model.reference.transform,
        visible: model.reference.visible,
        name: model.reference.name,
      });

      const prevKey = prevModelsRef.current.get(model.id);

      if (prevKey && prevKey !== modelKey) {
        // Model has changed, emit update
        const update: Partial<ModelUpdate> = {
          positionX: model.reference.transform.position.x,
          positionY: model.reference.transform.position.y,
          positionZ: model.reference.transform.position.z,
          rotationX: model.reference.transform.rotation.x,
          rotationY: model.reference.transform.rotation.y,
          rotationZ: model.reference.transform.rotation.z,
          scaleX: model.reference.transform.scale.x,
          scaleY: model.reference.transform.scale.y,
          scaleZ: model.reference.transform.scale.z,
          visible: model.reference.visible,
          name: model.reference.name,
        };

        emitModelUpdate(model.id, update);
        console.log('[ModelSync] Emitting model:update', model.id);
      }

      prevModelsRef.current.set(model.id, modelKey);
    });

    // Clean up removed models from tracking
    prevModelsRef.current.forEach((_, id) => {
      if (!currentIds.has(id)) {
        prevModelsRef.current.delete(id);
      }
    });
  }, [models, isConnected, isRemoteUpdate, isSyncingFromServer, emitModelDelete, emitModelUpdate]);
}
