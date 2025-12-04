'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import * as THREE from 'three';

interface GaussianSplatViewerProps {
  url: string;
  modelId: string;
  fileName?: string; // Original filename to determine format
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  visible?: boolean;
  onLoad?: () => void;
  onProgress?: (progress: number) => void;
  onError?: (error: string) => void;
}

/**
 * React Three Fiber component for rendering 3D Gaussian Splatting
 * Uses @mkkellogg/gaussian-splats-3d for high-quality rendering
 */
export function GaussianSplatViewer({
  url,
  modelId,
  fileName = 'model.ply',
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  visible = true,
  onLoad,
  onProgress,
  onError,
}: GaussianSplatViewerProps) {
  const { gl, scene, camera } = useThree();
  const viewerRef = useRef<GaussianSplats3D.Viewer | null>(null);
  const containerRef = useRef<THREE.Group>(new THREE.Group());
  const initializingRef = useRef(false);
  const disposedRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize and load the splat viewer
  useEffect(() => {
    if (!url || !gl || !scene) return;

    // Prevent double initialization from React Strict Mode
    if (initializingRef.current) {
      console.log('[GaussianSplatViewer] Already initializing, skipping...');
      return;
    }

    initializingRef.current = true;
    disposedRef.current = false;

    let viewer: GaussianSplats3D.Viewer | null = null;

    const initViewer = async () => {
      try {
        // Check if already disposed before starting
        if (disposedRef.current) {
          console.log('[GaussianSplatViewer] Already disposed, aborting init');
          return;
        }

        console.log('[GaussianSplatViewer] Starting to load:', url, 'fileName:', fileName);

        // Determine file format from fileName
        const ext = fileName.toLowerCase().split('.').pop() || 'ply';
        console.log('[GaussianSplatViewer] Detected format:', ext);

        // Map extension to SceneFormat
        // SceneFormat: Splat=0, KSplat=1, Ply=2, Spz=3
        const getSceneFormat = (extension: string) => {
          switch (extension) {
            case 'splat': return GaussianSplats3D.SceneFormat.Splat;
            case 'ksplat': return GaussianSplats3D.SceneFormat.KSplat;
            case 'ply': return GaussianSplats3D.SceneFormat.Ply;
            case 'spz': return GaussianSplats3D.SceneFormat.Spz;
            default: return GaussianSplats3D.SceneFormat.Ply;
          }
        };

        const sceneFormat = getSceneFormat(ext);
        const isPly = ext === 'ply';
        const isOptimizedFormat = ext === 'spz' || ext === 'ksplat';

        console.log('[GaussianSplatViewer] SceneFormat:', sceneFormat, 'isOptimized:', isOptimizedFormat);

        // Fetch the blob data directly to bypass URL extension issues
        console.log('[GaussianSplatViewer] Fetching file data...');
        onProgress?.(0.1);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log('[GaussianSplatViewer] File data loaded, size:', arrayBuffer.byteLength);

        // Check if disposed during fetch
        if (disposedRef.current) {
          console.log('[GaussianSplatViewer] Disposed during fetch');
          return;
        }

        onProgress?.(0.3);

        // Create viewer with existing renderer
        viewer = new GaussianSplats3D.Viewer({
          renderer: gl,
          camera: camera as THREE.PerspectiveCamera,
          selfDrivenMode: false,
          useBuiltInControls: false,
          sharedMemoryForWorkers: false,
          dynamicScene: false,
          antialiased: true,
          sphericalHarmonicsDegree: 0,
          logLevel: GaussianSplats3D.LogLevel.Debug,
        });

        // Check if disposed during viewer creation
        if (disposedRef.current) {
          console.log('[GaussianSplatViewer] Disposed during creation, cleaning up');
          viewer.dispose();
          return;
        }

        viewerRef.current = viewer;

        console.log('[GaussianSplatViewer] Viewer created, loading splat data...');
        onProgress?.(0.5);

        // Load based on format - use direct file data loading to bypass URL extension issues
        let splatBuffer: GaussianSplats3D.SplatBuffer | null = null;

        const progressCallback = (percent: number) => {
          console.log('[GaussianSplatViewer] Parse progress:', percent);
          if (!disposedRef.current && onProgress) {
            onProgress(0.5 + percent * 0.4);
          }
        };

        if (isPly) {
          // Use PlyLoader.loadFromFileData for PLY files
          console.log('[GaussianSplatViewer] Loading PLY from file data...');
          splatBuffer = await GaussianSplats3D.PlyLoader.loadFromFileData(
            arrayBuffer,
            progressCallback
          );
        } else {
          // For SPZ, KSplat, and Splat formats, use URL-based loading
          // Create a File object with proper extension to help the library detect format
          console.log('[GaussianSplatViewer] Loading', ext, 'format via File URL...');

          // Create a File with proper name and extension
          const file = new File([arrayBuffer], `model.${ext}`, { type: 'application/octet-stream' });
          const tempUrl = URL.createObjectURL(file);

          console.log('[GaussianSplatViewer] Created temp URL:', tempUrl, 'for format:', ext, 'sceneFormat:', sceneFormat);

          try {
            await viewer.addSplatScene(tempUrl, {
              showLoadingUI: false,
              progressiveLoad: false,
              position: position,
              rotation: new THREE.Euler(
                rotation[0] * (Math.PI / 180),
                rotation[1] * (Math.PI / 180),
                rotation[2] * (Math.PI / 180)
              ),
              scale: scale,
              format: sceneFormat,
              onProgress: progressCallback,
            });
          } finally {
            URL.revokeObjectURL(tempUrl);
          }
          splatBuffer = null; // Already added via addSplatScene
        }

        // Check if disposed during parsing
        if (disposedRef.current) {
          console.log('[GaussianSplatViewer] Disposed during parsing');
          return;
        }

        // Add splatBuffer if we have one (PLY direct loading)
        if (splatBuffer) {
          console.log('[GaussianSplatViewer] SplatBuffer created, adding to viewer...');
          await viewer.addSplatBuffers([splatBuffer], [{
            splatAlphaRemovalThreshold: 1,
          }], true);
        }

        // Check if disposed during loading
        if (disposedRef.current) {
          console.log('[GaussianSplatViewer] Disposed during loading');
          return;
        }

        console.log('[GaussianSplatViewer] Splat data added');
        onProgress?.(0.95);

        // Get the splat mesh and add to container
        const splatMesh = viewer.getSplatMesh();
        console.log('[GaussianSplatViewer] Splat mesh:', splatMesh);

        if (splatMesh) {
          // Apply transform to container
          containerRef.current.position.set(position[0], position[1], position[2]);
          containerRef.current.rotation.set(
            rotation[0] * (Math.PI / 180),
            rotation[1] * (Math.PI / 180),
            rotation[2] * (Math.PI / 180)
          );
          containerRef.current.scale.set(scale[0], scale[1], scale[2]);

          containerRef.current.add(splatMesh);
          scene.add(containerRef.current);
          console.log('[GaussianSplatViewer] Mesh added to scene');
        } else {
          console.warn('[GaussianSplatViewer] No splat mesh returned');
        }

        if (!disposedRef.current) {
          setIsLoaded(true);
          setError(null);
          onLoad?.();
          onProgress?.(1);
          console.log('[GaussianSplatViewer] Load complete');
        }
      } catch (err) {
        // Ignore "Scene disposed" errors from cleanup
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('disposed') || disposedRef.current) {
          console.log('[GaussianSplatViewer] Ignoring disposal error:', errorMessage);
          return;
        }

        console.error('[GaussianSplatViewer] Failed to load splat:', err);
        console.error('[GaussianSplatViewer] Error details:', {
          name: err instanceof Error ? err.name : 'Unknown',
          message: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
        });
        if (!disposedRef.current) {
          setError(errorMessage);
          onError?.(errorMessage);
        }
      }
    };

    initViewer();

    return () => {
      console.log('[GaussianSplatViewer] Cleanup called');
      disposedRef.current = true;
      initializingRef.current = false;

      if (viewerRef.current) {
        try {
          // Remove from scene
          if (containerRef.current.parent) {
            containerRef.current.parent.remove(containerRef.current);
          }
          // Dispose viewer
          viewerRef.current.dispose();
        } catch (e) {
          console.warn('[GaussianSplatViewer] Error during cleanup:', e);
        }
        viewerRef.current = null;
      }
    };
  }, [url, fileName, gl, scene, camera]);

  // Update visibility
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.visible = visible;
    }
  }, [visible]);

  // Update transform
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.position.set(position[0], position[1], position[2]);
      containerRef.current.rotation.set(
        rotation[0] * (Math.PI / 180),
        rotation[1] * (Math.PI / 180),
        rotation[2] * (Math.PI / 180)
      );
      containerRef.current.scale.set(scale[0], scale[1], scale[2]);
    }
  }, [position, rotation, scale]);

  // Render loop - update splat sorting based on camera
  useFrame(() => {
    if (viewerRef.current && isLoaded) {
      try {
        viewerRef.current.update();
        viewerRef.current.render();
      } catch (e) {
        // Silently ignore render errors
      }
    }
  });

  // This component doesn't render anything directly in React
  // The splat is added directly to the Three.js scene
  return null;
}

/**
 * Hook to manage multiple Gaussian Splat scenes
 */
export function useGaussianSplatManager() {
  const splatsRef = useRef<Map<string, GaussianSplats3D.Viewer>>(new Map());

  const addSplat = useCallback(
    (id: string, viewer: GaussianSplats3D.Viewer) => {
      splatsRef.current.set(id, viewer);
    },
    []
  );

  const removeSplat = useCallback((id: string) => {
    const viewer = splatsRef.current.get(id);
    if (viewer) {
      viewer.dispose();
      splatsRef.current.delete(id);
    }
  }, []);

  const getSplat = useCallback((id: string) => {
    return splatsRef.current.get(id);
  }, []);

  const updateAll = useCallback(() => {
    splatsRef.current.forEach((viewer) => {
      try {
        viewer.update();
        viewer.render();
      } catch (e) {
        // Ignore errors
      }
    });
  }, []);

  const disposeAll = useCallback(() => {
    splatsRef.current.forEach((viewer) => {
      try {
        viewer.dispose();
      } catch (e) {
        // Ignore errors
      }
    });
    splatsRef.current.clear();
  }, []);

  return {
    addSplat,
    removeSplat,
    getSplat,
    updateAll,
    disposeAll,
    count: splatsRef.current.size,
  };
}

export default GaussianSplatViewer;
