import * as THREE from 'three';
import { Camera as CameraData, Vector3 } from '@/types/camera';
import { calculateVerticalFOV } from '@/lib/utils/mathUtils';

/**
 * Convert pan/tilt/roll (degrees) to Euler rotation (radians)
 */
function panTiltRollToEuler(pan: number, tilt: number, roll: number): THREE.Euler {
  const panRad = THREE.MathUtils.degToRad(pan);
  const tiltRad = THREE.MathUtils.degToRad(tilt);
  const rollRad = THREE.MathUtils.degToRad(roll);
  return new THREE.Euler(tiltRad, panRad, rollRad, 'YXZ');
}

/**
 * Convert Euler rotation to pan/tilt/roll (degrees)
 */
function eulerToPanTiltRoll(euler: THREE.Euler): { pan: number; tilt: number; roll: number } {
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

/**
 * Creates and manages Three.js PerspectiveCamera from camera data
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private cameraData: CameraData;

  constructor(cameraData: CameraData, aspect: number = 16 / 9) {
    this.cameraData = cameraData;
    this.camera = new THREE.PerspectiveCamera(
      cameraData.fov,
      aspect,
      0.1,
      10000
    );
    this.updateFromData();
  }

  /**
   * Update Three.js camera from camera data
   */
  updateFromData(): void {
    const { position, pan, tilt, roll, fov } = this.cameraData;

    // Set position
    this.camera.position.set(position.x, position.y, position.z);

    // Set FOV
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    // Apply pan/tilt/roll rotation
    const euler = panTiltRollToEuler(pan, tilt, roll);
    this.camera.rotation.copy(euler);
  }

  /**
   * Update camera data from current Three.js camera state
   */
  syncToData(): Partial<CameraData> {
    const position = this.camera.position;
    const { pan, tilt, roll } = eulerToPanTiltRoll(this.camera.rotation);

    return {
      position: { x: position.x, y: position.y, z: position.z },
      pan,
      tilt,
      roll,
      fov: this.camera.fov,
    };
  }

  /**
   * Set camera position
   */
  setPosition(position: Vector3): void {
    this.cameraData.position = position;
    this.camera.position.set(position.x, position.y, position.z);
  }

  /**
   * Set camera pan/tilt/roll
   */
  setPanTiltRoll(pan: number, tilt: number, roll: number): void {
    this.cameraData.pan = pan;
    this.cameraData.tilt = tilt;
    this.cameraData.roll = roll;
    const euler = panTiltRollToEuler(pan, tilt, roll);
    this.camera.rotation.copy(euler);
  }

  /**
   * Set focal length and update FOV
   */
  setFocalLength(focalLength: number): void {
    this.cameraData.focalLength = focalLength;
    this.cameraData.fov = calculateVerticalFOV(focalLength, this.cameraData.sensorHeight);
    this.camera.fov = this.cameraData.fov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Set aspect ratio
   */
  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Get Three.js camera
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get camera data
   */
  getData(): CameraData {
    return this.cameraData;
  }

  /**
   * Rotate camera (change pan/tilt)
   */
  rotate(deltaPan: number, deltaTilt: number): void {
    const newPan = this.cameraData.pan + deltaPan;
    const newTilt = Math.max(-89, Math.min(89, this.cameraData.tilt + deltaTilt));
    this.setPanTiltRoll(newPan, newTilt, this.cameraData.roll);
  }

  /**
   * Truck camera (move left/right perpendicular to view direction)
   */
  truck(deltaX: number, deltaY: number): void {
    const offset = new THREE.Vector3(deltaX, deltaY, 0);
    offset.applyQuaternion(this.camera.quaternion);

    const newPos = {
      x: this.cameraData.position.x + offset.x,
      y: this.cameraData.position.y + offset.y,
      z: this.cameraData.position.z + offset.z,
    };

    this.setPosition(newPos);
  }

  /**
   * Dolly camera (move forward/backward along view direction)
   */
  dolly(delta: number): void {
    const euler = panTiltRollToEuler(this.cameraData.pan, this.cameraData.tilt, this.cameraData.roll);
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(euler);

    const newPos = {
      x: this.cameraData.position.x + forward.x * delta,
      y: this.cameraData.position.y + forward.y * delta,
      z: this.cameraData.position.z + forward.z * delta,
    };

    this.setPosition(newPos);
  }

  /**
   * Zoom (change focal length)
   */
  zoom(factor: number): void {
    const newFocalLength = Math.max(10, Math.min(300, this.cameraData.focalLength * factor));
    this.setFocalLength(newFocalLength);
  }

  /**
   * Reset camera to default position
   */
  reset(): void {
    this.cameraData.position = { x: 5, y: 2, z: 5 };
    this.cameraData.pan = -45;
    this.cameraData.tilt = -10;
    this.cameraData.roll = 0;
    this.cameraData.focalLength = 35;
    this.cameraData.fov = calculateVerticalFOV(35, this.cameraData.sensorHeight);
    this.updateFromData();
  }
}

/**
 * Create camera frustum helper for visualization
 */
export function createCameraFrustum(
  camera: THREE.PerspectiveCamera,
  color: string | number = 0x00ff88
): THREE.LineSegments {
  const helper = new THREE.CameraHelper(camera);

  // Create a simpler frustum visualization
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    color,
    opacity: 0.7,
    transparent: true,
  });

  // Get frustum corners
  const near = camera.near;
  const far = Math.min(camera.far, 10); // Limit far plane for visualization
  const aspect = camera.aspect;
  const fov = camera.fov * (Math.PI / 180);

  const nearHeight = 2 * Math.tan(fov / 2) * near;
  const nearWidth = nearHeight * aspect;
  const farHeight = 2 * Math.tan(fov / 2) * far;
  const farWidth = farHeight * aspect;

  const vertices = new Float32Array([
    // Near plane
    -nearWidth / 2, -nearHeight / 2, -near,
    nearWidth / 2, -nearHeight / 2, -near,
    nearWidth / 2, -nearHeight / 2, -near,
    nearWidth / 2, nearHeight / 2, -near,
    nearWidth / 2, nearHeight / 2, -near,
    -nearWidth / 2, nearHeight / 2, -near,
    -nearWidth / 2, nearHeight / 2, -near,
    -nearWidth / 2, -nearHeight / 2, -near,

    // Far plane
    -farWidth / 2, -farHeight / 2, -far,
    farWidth / 2, -farHeight / 2, -far,
    farWidth / 2, -farHeight / 2, -far,
    farWidth / 2, farHeight / 2, -far,
    farWidth / 2, farHeight / 2, -far,
    -farWidth / 2, farHeight / 2, -far,
    -farWidth / 2, farHeight / 2, -far,
    -farWidth / 2, -farHeight / 2, -far,

    // Connecting lines
    -nearWidth / 2, -nearHeight / 2, -near,
    -farWidth / 2, -farHeight / 2, -far,
    nearWidth / 2, -nearHeight / 2, -near,
    farWidth / 2, -farHeight / 2, -far,
    nearWidth / 2, nearHeight / 2, -near,
    farWidth / 2, farHeight / 2, -far,
    -nearWidth / 2, nearHeight / 2, -near,
    -farWidth / 2, farHeight / 2, -far,
  ]);

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  return new THREE.LineSegments(geometry, material);
}
