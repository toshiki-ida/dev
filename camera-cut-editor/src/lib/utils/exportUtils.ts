import { Camera } from '@/types/camera';
import { Cut } from '@/types/timeline';
import { secondsToTimecodeString } from '@/types/timeline';
import { downloadBlob, downloadText } from './fileUtils';

/**
 * Export cameras as JSON
 */
export function exportCamerasAsJSON(cameras: Camera[]): string {
  return JSON.stringify(cameras, null, 2);
}

/**
 * Export cameras as CSV
 */
export function exportCamerasAsCSV(cameras: Camera[]): string {
  const headers = [
    'Name',
    'Position X',
    'Position Y',
    'Position Z',
    'Pan (degrees)',
    'Tilt (degrees)',
    'Roll (degrees)',
    'Sensor Preset',
    'Sensor Width (mm)',
    'Sensor Height (mm)',
    'Focal Length (mm)',
    'FOV (degrees)',
    'Aperture (f-stop)',
    'Focus Distance (m)',
    'Enabled',
    'Color',
  ];

  const rows = cameras.map(camera => [
    camera.name,
    camera.position.x.toFixed(3),
    camera.position.y.toFixed(3),
    camera.position.z.toFixed(3),
    camera.pan.toFixed(2),
    camera.tilt.toFixed(2),
    camera.roll.toFixed(2),
    camera.sensorPreset,
    camera.sensorWidth.toFixed(2),
    camera.sensorHeight.toFixed(2),
    camera.focalLength.toFixed(2),
    camera.fov.toFixed(2),
    camera.aperture.toFixed(1),
    camera.focusDistance.toFixed(2),
    camera.enabled ? 'Yes' : 'No',
    camera.color,
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Export cut list as EDL (Edit Decision List)
 * CMX 3600 format
 */
export function exportCutListAsEDL(
  cuts: Cut[],
  cameras: Camera[],
  projectName: string,
  frameRate: number
): string {
  const lines: string[] = [];

  lines.push(`TITLE: ${projectName}`);
  lines.push(`FCM: NON-DROP FRAME`);
  lines.push('');

  let editNumber = 1;
  let recordIn = 0;

  cuts.forEach(cut => {
    const camera = cameras.find(c => c.id === cut.cameraId);
    const cameraName = camera?.name ?? 'Unknown Camera';

    const sourceIn = '01:00:00:00';
    const sourceOut = secondsToTimecodeString(cut.duration, frameRate).replace(
      /^(\d{2}:\d{2}:\d{2}:\d{2})$/,
      '01:$1'.slice(-11)
    );

    const recordInTC = secondsToTimecodeString(recordIn, frameRate);
    const recordOutTC = secondsToTimecodeString(recordIn + cut.duration, frameRate);

    const editType = cut.transition === 'dissolve' ? 'D' : 'C';
    const transitionDuration = cut.transition === 'dissolve'
      ? Math.round(cut.transitionDuration * frameRate).toString().padStart(3, '0')
      : '';

    lines.push(
      `${editNumber.toString().padStart(3, '0')}  ${cameraName.padEnd(8).slice(0, 8)} V     ${editType}${transitionDuration.padStart(4)}    ${sourceIn} ${sourceOut} ${recordInTC} ${recordOutTC}`
    );

    if (cut.notes) {
      lines.push(`* ${cut.notes}`);
    }

    editNumber++;
    recordIn += cut.duration;
  });

  return lines.join('\n');
}

/**
 * Export camera data for Unreal Engine
 */
export function exportCamerasForUnreal(cameras: Camera[]): string {
  const unrealCameras = cameras.map(camera => ({
    name: camera.name,
    // Convert coordinate system (Three.js Y-up to Unreal Z-up)
    location: {
      x: camera.position.x * 100, // Unreal uses centimeters
      y: -camera.position.z * 100,
      z: camera.position.y * 100,
    },
    // Convert pan/tilt/roll to Unreal rotation
    // Unreal uses pitch (Y), yaw (Z), roll (X)
    rotation: {
      pitch: camera.tilt,
      yaw: camera.pan,
      roll: camera.roll,
    },
    filmback: {
      sensorWidth: camera.sensorWidth,
      sensorHeight: camera.sensorHeight,
    },
    currentFocalLength: camera.focalLength,
    currentAperture: camera.aperture,
    focusSettings: {
      manualFocusDistance: camera.focusDistance * 100,
    },
  }));

  return JSON.stringify(unrealCameras, null, 2);
}

/**
 * Export camera data for Unity
 */
export function exportCamerasForUnity(cameras: Camera[]): string {
  const unityCameras = cameras.map(camera => ({
    name: camera.name,
    // Unity uses left-handed coordinate system
    position: {
      x: camera.position.x,
      y: camera.position.y,
      z: -camera.position.z,
    },
    // Euler angles in degrees
    rotation: {
      x: camera.tilt,     // Pitch
      y: -camera.pan,     // Yaw (inverted for left-handed)
      z: camera.roll,     // Roll
    },
    fieldOfView: camera.fov,
    sensorSize: {
      x: camera.sensorWidth,
      y: camera.sensorHeight,
    },
    focalLength: camera.focalLength,
    aperture: camera.aperture,
    focusDistance: camera.focusDistance,
  }));

  return JSON.stringify(unityCameras, null, 2);
}


/**
 * Capture screenshot from canvas
 */
export async function captureScreenshot(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg' = 'png',
  quality: number = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to capture screenshot'));
        }
      },
      `image/${format}`,
      quality
    );
  });
}

/**
 * Download screenshot
 */
export async function downloadScreenshot(
  canvas: HTMLCanvasElement,
  fileName: string = 'screenshot',
  format: 'png' | 'jpeg' = 'png'
): Promise<void> {
  const blob = await captureScreenshot(canvas, format);
  downloadBlob(blob, `${fileName}.${format}`);
}

/**
 * Export all camera data
 */
export function exportAllCameraData(
  cameras: Camera[],
  projectName: string
): void {
  // JSON
  const json = exportCamerasAsJSON(cameras);
  downloadText(json, `${projectName}_cameras.json`);

  // CSV
  const csv = exportCamerasAsCSV(cameras);
  downloadText(csv, `${projectName}_cameras.csv`);

  // Unreal
  const unreal = exportCamerasForUnreal(cameras);
  downloadText(unreal, `${projectName}_cameras_unreal.json`);

  // Unity
  const unity = exportCamerasForUnity(cameras);
  downloadText(unity, `${projectName}_cameras_unity.json`);
}
