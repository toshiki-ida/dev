'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Grid,
  Environment,
  PerspectiveCamera,
} from '@react-three/drei';
import * as THREE from 'three';
import { useModelStore } from '@/lib/store/useModelStore';
import { useCameraStore, useProgramCamera } from '@/lib/store/useCameraStore';
import { useViewerStore } from '@/lib/store/useViewerStore';
import { GaussianSplatViewer } from './GaussianSplatViewer';

interface ProgramOutputProps {
  className?: string;
  showTally?: boolean;
}

// Convert pan/tilt/roll (degrees) to Euler rotation (radians)
function panTiltRollToEuler(pan: number, tilt: number, roll: number): THREE.Euler {
  const panRad = THREE.MathUtils.degToRad(pan);
  const tiltRad = THREE.MathUtils.degToRad(tilt);
  const rollRad = THREE.MathUtils.degToRad(roll);
  return new THREE.Euler(tiltRad, panRad, rollRad, 'YXZ');
}

function ProgramCameraSync({ cameraData }: { cameraData: { pan: number; tilt: number; roll: number; position: { x: number; y: number; z: number }; fov: number } }) {
  const threeCamera = React.useRef<THREE.PerspectiveCamera>(null);

  React.useEffect(() => {
    if (threeCamera.current && cameraData) {
      threeCamera.current.position.set(
        cameraData.position.x,
        cameraData.position.y,
        cameraData.position.z
      );
      const euler = panTiltRollToEuler(cameraData.pan, cameraData.tilt, cameraData.roll);
      threeCamera.current.rotation.copy(euler);
      threeCamera.current.fov = cameraData.fov;
      threeCamera.current.updateProjectionMatrix();
    }
  }, [cameraData]);

  return (
    <PerspectiveCamera
      ref={threeCamera}
      makeDefault
      fov={cameraData.fov}
      position={[cameraData.position.x, cameraData.position.y, cameraData.position.z]}
      near={0.1}
      far={1000}
    />
  );
}

function ProgramSceneContent() {
  const models = useModelStore((state) => state.models);
  const showGrid = useViewerStore((state) => state.showGrid);

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

      {/* Render standard 3D models */}
      {standardModels.map((model) => {
        if (!model.reference.visible || !model.object) return null;
        return (
          <primitive
            key={model.id}
            object={model.object!}
            position={[
              model.reference.transform.position.x,
              model.reference.transform.position.y,
              model.reference.transform.position.z,
            ]}
            rotation={[
              model.reference.transform.rotation.x * (Math.PI / 180),
              model.reference.transform.rotation.y * (Math.PI / 180),
              model.reference.transform.rotation.z * (Math.PI / 180),
            ]}
            scale={[
              model.reference.transform.scale.x,
              model.reference.transform.scale.y,
              model.reference.transform.scale.z,
            ]}
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
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#666" />
        </mesh>
      )}
    </>
  );
}

/**
 * Program Output (PGM) - The "on air" output
 * Displays the view from the currently selected program camera
 * Shows red LIVE tally when active
 */
export function ProgramOutput({ className, showTally = true }: ProgramOutputProps) {
  const programCamera = useProgramCamera();
  const backgroundColor = useViewerStore((state) => state.backgroundColor);

  // No program camera selected
  if (!programCamera) {
    return (
      <div className={`relative w-full h-full bg-black flex items-center justify-center ${className || ''}`}>
        <div className="text-center text-zinc-500">
          <div className="text-lg font-bold mb-2">NO PROGRAM</div>
          <div className="text-sm">Select a camera to put on air</div>
        </div>
        {showTally && (
          <div className="absolute top-2 left-2 px-3 py-1 bg-zinc-800 text-zinc-500 text-sm font-bold rounded">
            PGM
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full bg-black rounded overflow-hidden ${className || ''}`}>
      {/* Red PGM/LIVE tally */}
      {showTally && (
        <div className="absolute top-2 left-2 z-10 flex gap-2">
          <div className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded animate-pulse">
            LIVE
          </div>
          <div className="px-2 py-1 bg-zinc-800 text-white text-xs rounded">
            {programCamera.name}
          </div>
        </div>
      )}

      {/* Safe frame indicators */}
      <div className="absolute inset-0 pointer-events-none z-5">
        {/* 16:9 safe area */}
        <div className="absolute inset-[5%] border border-white/20 pointer-events-none" />
        {/* Title safe */}
        <div className="absolute inset-[10%] border border-white/10 pointer-events-none" />
      </div>

      <Canvas shadows dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }} style={{ background: backgroundColor }}>
        <Suspense fallback={null}>
          <ProgramCameraSync cameraData={programCamera} />
          <ProgramSceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default ProgramOutput;
