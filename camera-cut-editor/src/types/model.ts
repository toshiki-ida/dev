import * as THREE from 'three';
import { Vector3 } from './camera';

export type ModelFileType = 'gltf' | 'glb' | 'fbx' | 'obj' | 'usd' | 'usdz' | 'ply' | 'splat' | 'spz' | 'ksplat';

export interface ModelTransform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface ModelReference {
  id: string;
  name: string;
  fileName: string;
  fileType: ModelFileType;
  fileSize: number;
  url?: string;  // Server URL for synced models
  transform: ModelTransform;
  visible: boolean;
  createdAt: Date;
}

export interface LoadedModel {
  id: string;
  reference: ModelReference;
  object: THREE.Object3D | null;
  boundingBox?: {
    min: Vector3;
    max: Vector3;
    center: Vector3;
    size: Vector3;
  };
  isLoading: boolean;
  error?: string;
  // For 3D Gaussian Splatting - URL to the .ply/.splat/.spz/.ksplat file
  splatUrl?: string;
}

export interface ModelLoadProgress {
  modelId: string;
  progress: number;
  status: 'loading' | 'processing' | 'complete' | 'error';
  message?: string;
}

// 3D Gaussian Splatting specific types
export interface GaussianSplatData {
  positions: Float32Array;
  colors: Float32Array;
  covariances: Float32Array;
  count: number;
}

export interface GaussianSplatMesh extends THREE.Mesh {
  splatData?: GaussianSplatData;
  updateSort?: (camera: THREE.Camera) => void;
}
