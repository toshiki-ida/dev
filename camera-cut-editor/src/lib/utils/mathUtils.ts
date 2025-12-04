import { Vector3 } from '@/types/camera';

/**
 * Calculate Field of View from focal length and sensor dimension
 * FOV = 2 * arctan(sensorDimension / (2 * focalLength))
 */
export function calculateFOV(focalLength: number, sensorDimension: number): number {
  return 2 * Math.atan(sensorDimension / (2 * focalLength)) * (180 / Math.PI);
}

/**
 * Calculate horizontal FOV
 */
export function calculateHorizontalFOV(focalLength: number, sensorWidth: number): number {
  return calculateFOV(focalLength, sensorWidth);
}

/**
 * Calculate vertical FOV (used by Three.js PerspectiveCamera)
 */
export function calculateVerticalFOV(focalLength: number, sensorHeight: number): number {
  return calculateFOV(focalLength, sensorHeight);
}

/**
 * Calculate diagonal FOV
 */
export function calculateDiagonalFOV(
  focalLength: number,
  sensorWidth: number,
  sensorHeight: number
): number {
  const diagonal = Math.sqrt(sensorWidth ** 2 + sensorHeight ** 2);
  return calculateFOV(focalLength, diagonal);
}

/**
 * Calculate focal length from FOV and sensor dimension
 * focalLength = sensorDimension / (2 * tan(FOV / 2))
 */
export function calculateFocalLength(fov: number, sensorDimension: number): number {
  const fovRad = fov * (Math.PI / 180);
  return sensorDimension / (2 * Math.tan(fovRad / 2));
}

/**
 * Calculate the 35mm equivalent focal length
 */
export function calculate35mmEquivalent(
  focalLength: number,
  sensorWidth: number,
  sensorHeight: number
): number {
  const sensorDiagonal = Math.sqrt(sensorWidth ** 2 + sensorHeight ** 2);
  const fullFrameDiagonal = Math.sqrt(36 ** 2 + 24 ** 2); // ~43.27mm
  const cropFactor = fullFrameDiagonal / sensorDiagonal;
  return focalLength * cropFactor;
}

/**
 * Calculate crop factor relative to full frame
 */
export function calculateCropFactor(sensorWidth: number, sensorHeight: number): number {
  const sensorDiagonal = Math.sqrt(sensorWidth ** 2 + sensorHeight ** 2);
  const fullFrameDiagonal = Math.sqrt(36 ** 2 + 24 ** 2);
  return fullFrameDiagonal / sensorDiagonal;
}

/**
 * Vector3 utilities
 */
export function vector3Distance(a: Vector3, b: Vector3): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

export function vector3Add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vector3Subtract(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vector3Scale(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function vector3Normalize(v: Vector3): Vector3 {
  const length = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

export function vector3Lerp(a: Vector3, b: Vector3, t: number): Vector3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Degrees to radians
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Radians to degrees
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Round to specified decimal places
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Calculate Circle of Confusion (CoC) for depth of field
 * Standard CoC for various formats
 */
export function calculateCircleOfConfusion(sensorDiagonal: number): number {
  // CoC = sensor diagonal / 1500 (standard formula)
  return sensorDiagonal / 1500;
}

/**
 * Calculate hyperfocal distance
 * H = (f^2) / (N * c)
 * where f = focal length, N = aperture (f-number), c = circle of confusion
 */
export function calculateHyperfocalDistance(
  focalLength: number,
  aperture: number,
  circleOfConfusion: number
): number {
  return (focalLength ** 2) / (aperture * circleOfConfusion);
}

/**
 * Calculate near focus distance for given focus distance
 */
export function calculateNearFocus(
  focusDistance: number,
  hyperfocalDistance: number,
  focalLength: number
): number {
  return (hyperfocalDistance * focusDistance) / (hyperfocalDistance + (focusDistance - focalLength));
}

/**
 * Calculate far focus distance for given focus distance
 */
export function calculateFarFocus(
  focusDistance: number,
  hyperfocalDistance: number,
  focalLength: number
): number {
  if (focusDistance >= hyperfocalDistance) return Infinity;
  return (hyperfocalDistance * focusDistance) / (hyperfocalDistance - (focusDistance - focalLength));
}
