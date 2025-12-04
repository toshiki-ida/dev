export * from './sensorPresets';
export * from './lensPresets';

// Aspect Ratios
export const ASPECT_RATIOS = [
  { id: '16:9', name: '16:9 (HD)', value: 16 / 9 },
  { id: '4:3', name: '4:3 (SD)', value: 4 / 3 },
  { id: '2.39:1', name: '2.39:1 (Anamorphic)', value: 2.39 },
  { id: '2.35:1', name: '2.35:1 (CinemaScope)', value: 2.35 },
  { id: '1.85:1', name: '1.85:1 (Flat)', value: 1.85 },
  { id: '1.78:1', name: '1.78:1 (16:9)', value: 1.78 },
  { id: '1.33:1', name: '1.33:1 (4:3)', value: 1.33 },
  { id: '9:16', name: '9:16 (Vertical)', value: 9 / 16 },
  { id: '1:1', name: '1:1 (Square)', value: 1 },
];

// Frame Rates
export const FRAME_RATES = [
  { id: '23.976', name: '23.976 fps', value: 23.976 },
  { id: '24', name: '24 fps', value: 24 },
  { id: '25', name: '25 fps (PAL)', value: 25 },
  { id: '29.97', name: '29.97 fps', value: 29.97 },
  { id: '30', name: '30 fps', value: 30 },
  { id: '50', name: '50 fps', value: 50 },
  { id: '59.94', name: '59.94 fps', value: 59.94 },
  { id: '60', name: '60 fps', value: 60 },
];

// Camera Colors for Gizmos
export const CAMERA_COLORS = [
  '#00ff88', // Green
  '#ff6b6b', // Red
  '#4ecdc4', // Teal
  '#ffe66d', // Yellow
  '#ff8c42', // Orange
  '#a855f7', // Purple
  '#3b82f6', // Blue
  '#f472b6', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
];

// Viewer Layouts
export const VIEWER_LAYOUTS = [
  { id: 'single', name: 'Single', cols: 1, rows: 1 },
  { id: 'dual-h', name: 'Dual (Horizontal)', cols: 2, rows: 1 },
  { id: 'dual-v', name: 'Dual (Vertical)', cols: 1, rows: 2 },
  { id: 'quad', name: 'Quad (2x2)', cols: 2, rows: 2 },
  { id: 'triple', name: 'Triple (3+1)', cols: 3, rows: 1 },
  { id: 'six', name: 'Six (2x3)', cols: 2, rows: 3 },
  { id: 'nine', name: 'Nine (3x3)', cols: 3, rows: 3 },
];
