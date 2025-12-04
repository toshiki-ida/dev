'use client';

import { useEffect, useRef } from 'react';
import { useCameraStore } from '@/lib/store/useCameraStore';
import { useSocketStore } from '@/lib/store/useSocketStore';
import type { CameraUpdate, CameraData } from '@/lib/socket/types';
import type { Camera } from '@/types/camera';

// Convert local Camera to CameraData (socket format)
function cameraToSocketData(camera: Camera, projectId: string): CameraData {
  return {
    id: camera.id,
    name: camera.name,
    order: 0,
    positionX: camera.position.x,
    positionY: camera.position.y,
    positionZ: camera.position.z,
    pan: camera.pan,
    tilt: camera.tilt,
    roll: camera.roll,
    fov: camera.fov,
    focalLength: camera.focalLength,
    sensorPreset: camera.sensorPreset,
    sensorWidth: camera.sensorWidth,
    sensorHeight: camera.sensorHeight,
    color: camera.color,
    enabled: camera.enabled,
    isLive: false,
    projectId,
  };
}

/**
 * Hook that syncs camera changes to other users via Socket.io
 * This should be mounted once at the app level
 */
export function useCameraSync() {
  const cameras = useCameraStore((state) => state.cameras);
  const programCameraId = useCameraStore((state) => state.programCameraId);
  const isRemoteUpdate = useCameraStore((state) => state._isRemoteUpdate);
  const isSyncingFromServer = useCameraStore((state) => state._isSyncingFromServer);
  const emitCameraCreate = useSocketStore((state) => state.emitCameraCreate);
  const emitCameraUpdate = useSocketStore((state) => state.emitCameraUpdate);
  const emitCameraDelete = useSocketStore((state) => state.emitCameraDelete);
  const emitCameraLive = useSocketStore((state) => state.emitCameraLive);
  const isConnected = useSocketStore((state) => state.isConnected);
  const projectId = useSocketStore((state) => state.projectId);

  // Track previous values for comparison
  const prevCameraIdsRef = useRef<Set<string>>(new Set());
  const prevCamerasRef = useRef<Map<string, string>>(new Map());
  const prevProgramCameraIdRef = useRef<string | null>(null);
  // Track if we've initialized (to skip first render)
  const isInitializedRef = useRef(false);

  // Sync camera add/remove/update
  useEffect(() => {
    // Skip if remote update or syncing from server
    if (!isConnected || isRemoteUpdate || isSyncingFromServer || !projectId) {
      // If syncing from server, just update the refs without emitting
      if (isSyncingFromServer) {
        const currentIds = new Set(cameras.map(c => c.id));
        prevCameraIdsRef.current = currentIds;
        cameras.forEach((camera) => {
          const cameraKey = JSON.stringify({
            position: camera.position,
            pan: camera.pan,
            tilt: camera.tilt,
            roll: camera.roll,
            fov: camera.fov,
            focalLength: camera.focalLength,
            name: camera.name,
          });
          prevCamerasRef.current.set(camera.id, cameraKey);
        });
        // Clean up old refs
        prevCamerasRef.current.forEach((_, id) => {
          if (!currentIds.has(id)) {
            prevCamerasRef.current.delete(id);
          }
        });
        isInitializedRef.current = true;
      }
      return;
    }

    // Skip first render to avoid emitting on initial load
    if (!isInitializedRef.current) {
      const currentIds = new Set(cameras.map(c => c.id));
      prevCameraIdsRef.current = currentIds;
      cameras.forEach((camera) => {
        const cameraKey = JSON.stringify({
          position: camera.position,
          pan: camera.pan,
          tilt: camera.tilt,
          roll: camera.roll,
          fov: camera.fov,
          focalLength: camera.focalLength,
          name: camera.name,
        });
        prevCamerasRef.current.set(camera.id, cameraKey);
      });
      isInitializedRef.current = true;
      return;
    }

    const currentIds = new Set(cameras.map(c => c.id));

    // Detect new cameras (added locally)
    cameras.forEach((camera) => {
      if (!prevCameraIdsRef.current.has(camera.id)) {
        // New camera - emit create
        emitCameraCreate(cameraToSocketData(camera, projectId));
        console.log('[CameraSync] Emitting camera:create', camera.name);
      }
    });

    // Detect removed cameras (deleted locally)
    prevCameraIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        // Camera removed - emit delete
        emitCameraDelete(id);
        console.log('[CameraSync] Emitting camera:delete', id);
      }
    });

    // Update tracking
    prevCameraIdsRef.current = currentIds;

    // Check for camera property changes
    cameras.forEach((camera) => {
      const cameraKey = JSON.stringify({
        position: camera.position,
        pan: camera.pan,
        tilt: camera.tilt,
        roll: camera.roll,
        fov: camera.fov,
        focalLength: camera.focalLength,
        name: camera.name,
      });

      const prevKey = prevCamerasRef.current.get(camera.id);

      if (prevKey && prevKey !== cameraKey) {
        // Camera has changed, emit update
        const update: Partial<CameraUpdate> = {
          positionX: camera.position.x,
          positionY: camera.position.y,
          positionZ: camera.position.z,
          pan: camera.pan,
          tilt: camera.tilt,
          roll: camera.roll,
          fov: camera.fov,
          focalLength: camera.focalLength,
          name: camera.name,
        };

        emitCameraUpdate(camera.id, update);
      }

      prevCamerasRef.current.set(camera.id, cameraKey);
    });

    // Clean up removed cameras from tracking
    prevCamerasRef.current.forEach((_, id) => {
      if (!currentIds.has(id)) {
        prevCamerasRef.current.delete(id);
      }
    });
  }, [cameras, isConnected, isRemoteUpdate, isSyncingFromServer, projectId, emitCameraCreate, emitCameraUpdate, emitCameraDelete]);

  // Sync program camera changes
  useEffect(() => {
    if (!isConnected || isRemoteUpdate || isSyncingFromServer) return;

    if (prevProgramCameraIdRef.current !== programCameraId) {
      // Program camera changed
      if (prevProgramCameraIdRef.current) {
        emitCameraLive(prevProgramCameraIdRef.current, false);
      }
      if (programCameraId) {
        emitCameraLive(programCameraId, true);
      }
      prevProgramCameraIdRef.current = programCameraId;
    }
  }, [programCameraId, isConnected, isRemoteUpdate, isSyncingFromServer, emitCameraLive]);
}
