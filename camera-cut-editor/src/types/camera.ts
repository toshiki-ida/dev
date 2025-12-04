export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface SensorPreset {
  id: string;
  name: string;
  width: number;  // mm
  height: number; // mm
  manufacturer?: string;
}

export interface LensPreset {
  id: string;
  name: string;
  focalLength: number;  // mm
  type: 'prime' | 'zoom';
  minFocalLength?: number;
  maxFocalLength?: number;
}

export interface Camera {
  id: string;
  name: string;
  position: Vector3;
  pan: number;            // degrees (horizontal rotation, yaw)
  tilt: number;           // degrees (vertical rotation, pitch)
  roll: number;           // degrees (rotation around view axis)

  // Sensor
  sensorPreset: string;
  sensorWidth: number;    // mm
  sensorHeight: number;   // mm

  // Lens
  focalLength: number;    // mm
  fov: number;            // degrees (calculated)
  aperture: number;       // f-stop
  focusDistance: number;  // meters

  // Display
  enabled: boolean;
  color: string;          // hex color for gizmo

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface CameraKeyframe {
  time: number;           // 0-1 normalized
  position: Vector3;
  pan: number;
  tilt: number;
  roll: number;
  focalLength?: number;
  easing?: string;
}

export interface CameraAnimation {
  keyframes: CameraKeyframe[];
  interpolation: 'linear' | 'bezier' | 'catmullrom';
}

export type ViewerLayout =
  | 'single'
  | 'dual-h'
  | 'dual-v'
  | 'quad'
  | 'triple'
  | 'six'
  | 'nine'
  | { type: 'custom'; cols: number; rows: number };
