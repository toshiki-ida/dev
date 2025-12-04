'use client';

import React, { useRef, useEffect, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Environment,
  PerspectiveCamera,
} from '@react-three/drei';
import * as THREE from 'three';
import { Camera } from '@/types/camera';
import { useModelStore } from '@/lib/store/useModelStore';
import { useViewerStore } from '@/lib/store/useViewerStore';
import { useCameraStore } from '@/lib/store/useCameraStore';
import { ViewportOverlay } from './ViewportOverlay';
import { GaussianSplatViewer } from './GaussianSplatViewer';

interface ViewportProps {
  viewportId: string;
  camera: Camera | null;
  isActive: boolean;
  onActivate: () => void;
  onDoubleClick: () => void;
}

// Convert pan/tilt/roll (degrees) to Euler rotation (radians)
function panTiltRollToEuler(pan: number, tilt: number, roll: number): THREE.Euler {
  // Pan = Y軸回転 (Yaw), Tilt = X軸回転 (Pitch), Roll = Z軸回転
  const panRad = THREE.MathUtils.degToRad(pan);
  const tiltRad = THREE.MathUtils.degToRad(tilt);
  const rollRad = THREE.MathUtils.degToRad(roll);
  return new THREE.Euler(tiltRad, panRad, rollRad, 'YXZ');
}

// Convert Euler rotation to pan/tilt/roll (degrees)
function eulerToPanTiltRoll(euler: THREE.Euler): { pan: number; tilt: number; roll: number } {
  // Convert to YXZ order for proper extraction
  const yxzEuler = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromEuler(euler),
    'YXZ'
  );
  return {
    pan: THREE.MathUtils.radToDeg(yxzEuler.y),
    tilt: THREE.MathUtils.radToDeg(yxzEuler.x),
    roll: THREE.MathUtils.radToDeg(yxzEuler.z),
  };
}

function CameraSync({ cameraData }: { cameraData: Camera }) {
  const { camera, gl } = useThree();
  const dragMode = useRef<'none' | 'rotate' | 'truck' | 'dolly'>('none');
  const lastMouse = useRef({ x: 0, y: 0 });
  const setCameraPanTiltRoll = useCameraStore((state) => state.setCameraPanTiltRoll);
  const setCameraPosition = useCameraStore((state) => state.setCameraPosition);

  // Apply camera position and rotation from pan/tilt/roll
  useEffect(() => {
    if (camera && cameraData) {
      camera.position.set(
        cameraData.position.x,
        cameraData.position.y,
        cameraData.position.z
      );

      // Apply pan/tilt/roll rotation
      const euler = panTiltRollToEuler(cameraData.pan, cameraData.tilt, cameraData.roll);
      camera.rotation.copy(euler);

      (camera as THREE.PerspectiveCamera).fov = cameraData.fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, cameraData]);

  // Mouse controls (UE/Unity style)
  // Left click: Rotate (Pan/Tilt)
  // Right click: Truck/Pedestal (left-right/up-down movement)
  // Middle click: Dolly (forward-backward movement)
  // Wheel: Dolly (forward-backward movement)
  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      lastMouse.current = { x: e.clientX, y: e.clientY };

      if (e.button === 0) {
        // Left click: Rotate
        dragMode.current = 'rotate';
      } else if (e.button === 2) {
        // Right click: Truck/Pedestal
        dragMode.current = 'truck';
        e.preventDefault();
      } else if (e.button === 1) {
        // Middle click: Dolly
        dragMode.current = 'dolly';
        e.preventDefault();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (dragMode.current === 'none') return;

      const deltaX = e.clientX - lastMouse.current.x;
      const deltaY = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      const euler = panTiltRollToEuler(cameraData.pan, cameraData.tilt, cameraData.roll);

      if (dragMode.current === 'rotate') {
        // Rotate: Pan/Tilt
        const sensitivity = 0.3;
        const newPan = cameraData.pan - deltaX * sensitivity;
        const newTilt = Math.max(-89, Math.min(89, cameraData.tilt - deltaY * sensitivity));
        setCameraPanTiltRoll(cameraData.id, newPan, newTilt, cameraData.roll);

      } else if (dragMode.current === 'truck') {
        // Truck/Pedestal: Move camera left-right and up-down perpendicular to view
        const sensitivity = 0.01;

        // Get right and up vectors from camera orientation
        const right = new THREE.Vector3(1, 0, 0).applyEuler(euler);
        const up = new THREE.Vector3(0, 1, 0).applyEuler(euler);

        const newPosition = {
          x: cameraData.position.x - right.x * deltaX * sensitivity + up.x * deltaY * sensitivity,
          y: cameraData.position.y - right.y * deltaX * sensitivity + up.y * deltaY * sensitivity,
          z: cameraData.position.z - right.z * deltaX * sensitivity + up.z * deltaY * sensitivity,
        };
        setCameraPosition(cameraData.id, newPosition);

      } else if (dragMode.current === 'dolly') {
        // Dolly: Move camera forward-backward along view direction
        const sensitivity = 0.02;
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);

        const newPosition = {
          x: cameraData.position.x + forward.x * deltaY * sensitivity,
          y: cameraData.position.y + forward.y * deltaY * sensitivity,
          z: cameraData.position.z + forward.z * deltaY * sensitivity,
        };
        setCameraPosition(cameraData.id, newPosition);
      }
    };

    const onMouseUp = () => {
      dragMode.current = 'none';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Dolly: Move camera forward-backward
      const euler = panTiltRollToEuler(cameraData.pan, cameraData.tilt, cameraData.roll);
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);

      const speed = e.deltaY * 0.01;
      const newPosition = {
        x: cameraData.position.x + forward.x * speed,
        y: cameraData.position.y + forward.y * speed,
        z: cameraData.position.z + forward.z * speed,
      };

      setCameraPosition(cameraData.id, newPosition);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl, cameraData, setCameraPanTiltRoll, setCameraPosition]);

  return null; // No OrbitControls needed
}

function CameraUpdater({ cameraId }: { cameraId: string }) {
  // CameraUpdater is no longer needed since pan/tilt/roll is directly updated
  // via mouse events in CameraSync
  return null;
}

// Component to render a cloned model in this viewport's scene
function ClonedModel({ model }: { model: { id: string; object: THREE.Object3D; reference: { visible: boolean; transform: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } } } } }) {
  const clonedObject = React.useMemo(() => {
    // Clone the object so each Canvas has its own instance
    return model.object.clone();
  }, [model.object]);

  // Update clone when transform changes
  React.useEffect(() => {
    if (clonedObject) {
      clonedObject.position.set(
        model.reference.transform.position.x,
        model.reference.transform.position.y,
        model.reference.transform.position.z
      );
      clonedObject.rotation.set(
        model.reference.transform.rotation.x * (Math.PI / 180),
        model.reference.transform.rotation.y * (Math.PI / 180),
        model.reference.transform.rotation.z * (Math.PI / 180)
      );
      clonedObject.scale.set(
        model.reference.transform.scale.x,
        model.reference.transform.scale.y,
        model.reference.transform.scale.z
      );
    }
  }, [clonedObject, model.reference.transform]);

  if (!model.reference.visible) return null;

  return <primitive object={clonedObject} />;
}

function SceneContent({ showGrid }: { showGrid: boolean }) {
  const models = useModelStore((state) => state.models);

  // Separate standard models and 3DGS models
  const standardModels = models.filter(m => !m.splatUrl && m.object);
  const splatModels = models.filter(m => m.splatUrl);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-10, 5, -5]} intensity={0.3} />

      {showGrid && (
        <Grid
          args={[100, 100]}
          position={[0, 0, 0]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#444"
          sectionSize={10}
          sectionThickness={1}
          sectionColor="#666"
          fadeDistance={50}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      )}

      <Environment preset="studio" background={false} />

      {/* Render standard 3D models (cloned for this viewport) */}
      {standardModels.map((model) => {
        if (!model.reference.visible || !model.object) return null;
        return (
          <ClonedModel
            key={model.id}
            model={model as { id: string; object: THREE.Object3D; reference: { visible: boolean; transform: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } } } }}
          />
        );
      })}

      {/* Render 3D Gaussian Splats */}
      {splatModels.map((model) => {
        if (!model.reference.visible || !model.splatUrl) return null;
        return (
          <GaussianSplatViewer
            key={model.id}
            url={model.splatUrl}
            modelId={model.id}
            fileName={model.reference.fileName}
            position={[
              model.reference.transform.position.x,
              model.reference.transform.position.y,
              model.reference.transform.position.z,
            ]}
            rotation={[
              model.reference.transform.rotation.x,
              model.reference.transform.rotation.y,
              model.reference.transform.rotation.z,
            ]}
            scale={[
              model.reference.transform.scale.x,
              model.reference.transform.scale.y,
              model.reference.transform.scale.z,
            ]}
            visible={model.reference.visible}
            onLoad={() => {
              console.log(`[Viewport] Gaussian Splat loaded: ${model.id}`);
            }}
            onProgress={(progress) => {
              console.log(`[Viewport] Gaussian Splat progress: ${model.id} - ${(progress * 100).toFixed(1)}%`);
            }}
            onError={(error) => {
              console.error(`[Viewport] Gaussian Splat error: ${model.id} - ${error}`);
            }}
          />
        );
      })}

      {models.length === 0 && (
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#666" />
        </mesh>
      )}
    </>
  );
}

function CameraGizmos({ currentCameraId }: { currentCameraId: string | null }) {
  const cameras = useCameraStore((state) => state.cameras);
  const showGizmos = useViewerStore((state) => state.showCameraGizmos);

  if (!showGizmos) return null;

  return (
    <>
      {cameras
        .filter((cam) => cam.id !== currentCameraId && cam.enabled)
        .map((cam) => {
          const euler = panTiltRollToEuler(cam.pan, cam.tilt, cam.roll);
          return (
            <group
              key={cam.id}
              position={[cam.position.x, cam.position.y, cam.position.z]}
              rotation={euler}
            >
              <mesh>
                <boxGeometry args={[0.3, 0.2, 0.4]} />
                <meshBasicMaterial color={cam.color} opacity={0.5} transparent />
              </mesh>
              <mesh position={[0, 0, -0.25]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.1, 0.15, 16]} />
                <meshBasicMaterial color={cam.color} />
              </mesh>
              <mesh position={[0, 0, -0.5]}>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshBasicMaterial color={cam.color} />
              </mesh>
            </group>
          );
        })}
    </>
  );
}

export function Viewport({
  viewportId,
  camera,
  isActive,
  onActivate,
  onDoubleClick,
}: ViewportProps) {
  const showGrid = useViewerStore((state) => state.showGrid);
  const showSafeFrames = useViewerStore((state) => state.showSafeFrames);
  const backgroundColor = useViewerStore((state) => state.backgroundColor);
  const programCameraId = useCameraStore((state) => state.programCameraId);
  const isProgram = camera?.id === programCameraId;

  return (
    <div className="relative w-full h-full bg-zinc-950 rounded overflow-hidden" onClick={onActivate}>
      <Canvas shadows dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }} style={{ background: backgroundColor }}>
        <Suspense fallback={null}>
          {camera ? (
            <>
              <PerspectiveCamera
                makeDefault
                fov={camera.fov}
                position={[camera.position.x, camera.position.y, camera.position.z]}
                near={0.1}
                far={1000}
              />
              <CameraSync cameraData={camera} />
              <CameraUpdater cameraId={camera.id} />
            </>
          ) : (
            <>
              <PerspectiveCamera
                makeDefault
                fov={60}
                position={[5, 5, 5]}
                near={0.1}
                far={1000}
              />
              <OrbitControls makeDefault target={[0, 0, 0]} />
            </>
          )}
          <SceneContent showGrid={showGrid} />
          <CameraGizmos currentCameraId={camera?.id || null} />
          <GizmoHelper alignment="bottom-right" margin={[50, 50]}>
            <GizmoViewport labelColor="white" axisHeadScale={0.8} />
          </GizmoHelper>
        </Suspense>
      </Canvas>
      <ViewportOverlay
        camera={camera}
        isActive={isActive}
        isProgram={isProgram}
        showSafeFrames={showSafeFrames}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}
