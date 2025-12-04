declare module '@mkkellogg/gaussian-splats-3d' {
  import * as THREE from 'three';

  export enum LogLevel {
    None = 0,
    Error = 1,
    Warning = 2,
    Info = 3,
    Debug = 4,
  }

  export const SceneFormat: {
    Splat: 0;
    KSplat: 1;
    Ply: 2;
    Spz: 3;
  };

  export interface ViewerOptions {
    renderer?: THREE.WebGLRenderer;
    camera?: THREE.PerspectiveCamera;
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
    sharedMemoryForWorkers?: boolean;
    dynamicScene?: boolean;
    antialiased?: boolean;
    sphericalHarmonicsDegree?: number;
    logLevel?: LogLevel;
    splatSortDistanceMapPrecision?: number;
    integerBasedSort?: boolean;
    halfPrecisionCovariancesOnGPU?: boolean;
    devicePixelRatio?: number;
    gpuAcceleratedSort?: boolean;
    dropInMode?: boolean;
    rootElement?: HTMLElement;
    ignoreDevicePixelRatio?: boolean;
    threeScene?: THREE.Scene;
    freeIntermediateSplatData?: boolean;
  }

  export interface SplatSceneOptions {
    showLoadingUI?: boolean;
    progressiveLoad?: boolean;
    position?: [number, number, number];
    rotation?: THREE.Euler | [number, number, number, number]; // Euler or quaternion
    scale?: [number, number, number];
    splatAlphaRemovalThreshold?: number;
    onProgress?: (percent: number) => void;
    format?: 0 | 1 | 2 | 3; // SceneFormat: Splat=0, KSplat=1, Ply=2, Spz=3
  }

  export interface SplatBufferOptions {
    splatAlphaRemovalThreshold?: number;
    halfPrecisionCovariancesOnGPU?: boolean;
  }

  export class Viewer {
    constructor(options?: ViewerOptions);

    addSplatScene(
      url: string,
      options?: SplatSceneOptions
    ): Promise<void>;

    addSplatScenes(
      scenes: Array<{ path: string; options?: SplatSceneOptions }>
    ): Promise<void>;

    addSplatBuffers(
      splatBuffers: SplatBuffer[],
      splatBufferOptions?: SplatBufferOptions[],
      finalBuild?: boolean
    ): Promise<void>;

    removeSplatScene(index: number): void;

    update(): void;
    render(): void;
    dispose(): void;

    getSplatMesh(): THREE.Mesh | null;
    getCamera(): THREE.PerspectiveCamera;
    getRenderer(): THREE.WebGLRenderer;

    setSize(width: number, height: number): void;
    setCameraFocalLengthFromFOV(fov: number): void;

    sortSplatMesh(): void;
    updateSplatMesh(): void;

    saveToFile(filename: string): void;
  }

  export class DropInViewer extends Viewer {
    constructor(options?: ViewerOptions);
  }

  export class SplatBuffer {
    static readonly RowSizeBytes: number;
    static readonly CenterSizeBytes: number;
    static readonly ScaleSizeBytes: number;
    static readonly RotationSizeBytes: number;
    static readonly ColorSizeBytes: number;
  }

  export class SplatLoader {
    static loadFromURL(
      url: string,
      onProgress?: (percent: number) => void,
      progressiveLoad?: boolean,
      onProgressiveLoadSectionProgress?: (progress: number) => void,
      format?: 0 | 1 | 2 | 3
    ): Promise<SplatBuffer>;
  }

  export class PlyLoader {
    static loadFromURL(
      url: string,
      onProgress?: (percent: number) => void,
      progressiveLoad?: boolean,
      onProgressiveLoadSectionProgress?: (progress: number) => void
    ): Promise<SplatBuffer>;

    static loadFromFileData(
      plyFileData: ArrayBuffer,
      onProgress?: (percent: number) => void
    ): Promise<SplatBuffer>;
  }

  export class SpzLoader {
    static loadFromURL(
      url: string,
      onProgress?: (percent: number) => void
    ): Promise<SplatBuffer>;

    static loadFromFileData(
      spzFileData: ArrayBuffer,
      onProgress?: (percent: number) => void
    ): Promise<SplatBuffer>;
  }

  export class KSplatLoader {
    static loadFromURL(
      url: string,
      onProgress?: (percent: number) => void
    ): Promise<SplatBuffer>;

    static loadFromFileData(
      ksplatFileData: ArrayBuffer,
      onProgress?: (percent: number) => void
    ): Promise<SplatBuffer>;
  }

  export class AbortablePromise<T> extends Promise<T> {
    abort(): void;
  }
}
