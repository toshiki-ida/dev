import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { ModelFileType } from '@/types/model';
import { getFileType } from '@/lib/utils/fileUtils';

export interface LoadResult {
  object: THREE.Object3D;
  boundingBox: THREE.Box3;
  center: THREE.Vector3;
  size: THREE.Vector3;
}

export type ProgressCallback = (progress: number) => void;

export class ModelLoader {
  private gltfLoader: GLTFLoader;
  private fbxLoader: FBXLoader;
  private objLoader: OBJLoader;
  private mtlLoader: MTLLoader;

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();
    this.objLoader = new OBJLoader();
    this.mtlLoader = new MTLLoader();
  }

  async load(
    url: string,
    fileName: string,
    onProgress?: ProgressCallback
  ): Promise<LoadResult> {
    const fileType = getFileType(fileName);

    if (!fileType) {
      throw new Error(`Unsupported file type: ${fileName}`);
    }

    let object: THREE.Object3D;

    switch (fileType) {
      case 'gltf':
      case 'glb':
        object = await this.loadGLTF(url, onProgress);
        break;
      case 'fbx':
        object = await this.loadFBX(url, onProgress);
        break;
      case 'obj':
        object = await this.loadOBJ(url, onProgress);
        break;
      case 'ply':
      case 'splat':
        // 3DGS handled separately
        throw new Error('3D Gaussian Splatting files should use GaussianSplatLoader');
      default:
        throw new Error(`Loader not implemented for: ${fileType}`);
    }

    // Calculate bounding box
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    return {
      object,
      boundingBox,
      center,
      size,
    };
  }

  private async loadGLTF(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf: GLTF) => {
          const scene = gltf.scene;

          // Apply shadows
          scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          resolve(scene);
        },
        (event: ProgressEvent) => {
          if (onProgress && event.lengthComputable) {
            onProgress(event.loaded / event.total);
          }
        },
        (error: unknown) => {
          reject(new Error(`Failed to load GLTF: ${error}`));
        }
      );
    });
  }

  private async loadFBX(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        url,
        (object: THREE.Group) => {
          // Apply shadows
          object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          resolve(object);
        },
        (event: ProgressEvent) => {
          if (onProgress && event.lengthComputable) {
            onProgress(event.loaded / event.total);
          }
        },
        (error: unknown) => {
          reject(new Error(`Failed to load FBX: ${error}`));
        }
      );
    });
  }

  private async loadOBJ(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
      this.objLoader.load(
        url,
        (object: THREE.Group) => {
          // Apply default material and shadows
          object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              if (!mesh.material || (mesh.material as THREE.Material).type === 'MeshBasicMaterial') {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0x808080,
                  roughness: 0.5,
                  metalness: 0.1,
                });
              }
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });

          resolve(object);
        },
        (event: ProgressEvent) => {
          if (onProgress && event.lengthComputable) {
            onProgress(event.loaded / event.total);
          }
        },
        (error: unknown) => {
          reject(new Error(`Failed to load OBJ: ${error}`));
        }
      );
    });
  }

  /**
   * Load OBJ with MTL materials
   */
  async loadOBJWithMTL(
    objUrl: string,
    mtlUrl: string,
    onProgress?: ProgressCallback
  ): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
      this.mtlLoader.load(
        mtlUrl,
        (materials) => {
          materials.preload();
          this.objLoader.setMaterials(materials);

          this.objLoader.load(
            objUrl,
            (object) => {
              object.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              });
              resolve(object);
            },
            (event) => {
              if (onProgress && event.lengthComputable) {
                onProgress(event.loaded / event.total);
              }
            },
            (error) => {
              reject(new Error(`Failed to load OBJ: ${error}`));
            }
          );
        },
        undefined,
        (error) => {
          reject(new Error(`Failed to load MTL: ${error}`));
        }
      );
    });
  }

  /**
   * Auto-center and scale model to fit within a target size
   */
  static normalizeModel(
    object: THREE.Object3D,
    targetSize: number = 10
  ): void {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Center the model
    object.position.sub(center);

    // Scale to target size
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = targetSize / maxDim;
      object.scale.multiplyScalar(scale);
    }
  }

  /**
   * Dispose of all resources in an object
   */
  static disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material) => {
              ModelLoader.disposeMaterial(material);
            });
          } else {
            ModelLoader.disposeMaterial(mesh.material);
          }
        }
      }
    });
  }

  private static disposeMaterial(material: THREE.Material): void {
    material.dispose();

    // Dispose textures
    const materialWithMaps = material as THREE.MeshStandardMaterial;
    if (materialWithMaps.map) materialWithMaps.map.dispose();
    if (materialWithMaps.normalMap) materialWithMaps.normalMap.dispose();
    if (materialWithMaps.roughnessMap) materialWithMaps.roughnessMap.dispose();
    if (materialWithMaps.metalnessMap) materialWithMaps.metalnessMap.dispose();
    if (materialWithMaps.aoMap) materialWithMaps.aoMap.dispose();
    if (materialWithMaps.emissiveMap) materialWithMaps.emissiveMap.dispose();
  }
}

export const modelLoader = new ModelLoader();
