'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Grid,
  GizmoHelper,
  GizmoViewport,
  Environment,
  PerspectiveCamera,
  OrbitControls,
} from '@react-three/drei';
import * as THREE from 'three';
import { useModelStore } from '@/lib/store/useModelStore';
import { useCameraStore } from '@/lib/store/useCameraStore';
import { useViewerStore } from '@/lib/store/useViewerStore';
import { GaussianSplatViewer } from './GaussianSplatViewer';

interface PreviewViewportProps {
  className?: string;
}

// Convert pan/tilt/roll (degrees) to Euler rotation (radians)
function panTiltRollToEuler(pan: number, tilt: number, roll: number): THREE.Euler {
  const panRad = THREE.MathUtils.degToRad(pan);
  const tiltRad = THREE.MathUtils.degToRad(tilt);
  const rollRad = THREE.MathUtils.degToRad(roll);
  return new THREE.Euler(tiltRad, panRad, rollRad, 'YXZ');
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

function PreviewSceneContent() {
  const models = useModelStore((state) => state.models);
  const cameras = useCameraStore((state) => state.cameras);
  const showGrid = useViewerStore((state) => state.showGrid);
  const programCameraId = useCameraStore((state) => state.programCameraId);

  const standardModels = models.filter(m => !m.splatUrl && m.object);
  const splatModels = models.filter(m => m.splatUrl);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
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
          fadeDistance={100}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      )}

      <Environment preset="studio" background={false} />

      {/* Render all cameras as gizmos */}
      {cameras.map((cam) => {
        const euler = panTiltRollToEuler(cam.pan, cam.tilt, cam.roll);
        const isProgram = cam.id === programCameraId;

        return (
          <group
            key={cam.id}
            position={[cam.position.x, cam.position.y, cam.position.z]}
            rotation={euler}
          >
            {/* Camera body */}
            <mesh>
              <boxGeometry args={[0.4, 0.25, 0.5]} />
              <meshBasicMaterial
                color={isProgram ? '#ff0000' : cam.color}
                opacity={isProgram ? 0.9 : 0.6}
                transparent
              />
            </mesh>
            {/* Lens */}
            <mesh position={[0, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.12, 0.2, 16]} />
              <meshBasicMaterial color={isProgram ? '#ff0000' : cam.color} />
            </mesh>
            {/* FOV cone (frustum visualization) */}
            <mesh position={[0, 0, -1.5]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[1.5, 2.5, 4]} />
              <meshBasicMaterial
                color={isProgram ? '#ff0000' : cam.color}
                opacity={0.15}
                transparent
                wireframe
              />
            </mesh>
            {/* Program indicator (red tally light) */}
            {isProgram && (
              <mesh position={[0, 0.2, 0.2]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial color="#ff0000" />
              </mesh>
            )}
          </group>
        );
      })}

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
          />
        );
      })}

      {models.length === 0 && (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#666" />
        </mesh>
      )}
    </>
  );
}

/**
 * Preview Viewport - Bird's eye view of the entire scene
 * FOV: 90 degrees for wide angle overview
 * Shows all camera positions and frustums
 */
export function PreviewViewport({ className }: PreviewViewportProps) {
  return (
    <div className={`relative w-full h-full bg-zinc-900 rounded overflow-hidden ${className || ''}`}>
      {/* Preview label */}
      <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
        PREVIEW
      </div>

      <Canvas shadows dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
        <Suspense fallback={null}>
          {/* Bird's eye camera - high up, looking down at 45 degrees */}
          <PerspectiveCamera
            makeDefault
            fov={90}
            position={[30, 30, 30]}
            near={0.1}
            far={1000}
          />
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            enableRotate
            minDistance={5}
            maxDistance={200}
            target={[0, 0, 0]}
          />
          <PreviewSceneContent />
          <GizmoHelper alignment="bottom-right" margin={[50, 50]}>
            <GizmoViewport labelColor="white" axisHeadScale={0.8} />
          </GizmoHelper>
        </Suspense>
      </Canvas>
    </div>
  );
}

export default PreviewViewport;
