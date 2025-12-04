import { LensPreset } from '@/types/camera';

export const PRIME_FOCAL_LENGTHS = [
  14, 18, 21, 24, 28, 35, 40, 50, 65, 75, 85, 100, 135, 150, 200, 300
];

export const LENS_PRESETS: LensPreset[] = [
  // Ultra Wide Primes
  { id: 'prime-14', name: '14mm Prime', focalLength: 14, type: 'prime' },
  { id: 'prime-18', name: '18mm Prime', focalLength: 18, type: 'prime' },
  { id: 'prime-21', name: '21mm Prime', focalLength: 21, type: 'prime' },

  // Wide Primes
  { id: 'prime-24', name: '24mm Prime', focalLength: 24, type: 'prime' },
  { id: 'prime-28', name: '28mm Prime', focalLength: 28, type: 'prime' },
  { id: 'prime-35', name: '35mm Prime', focalLength: 35, type: 'prime' },

  // Normal Primes
  { id: 'prime-40', name: '40mm Prime', focalLength: 40, type: 'prime' },
  { id: 'prime-50', name: '50mm Prime', focalLength: 50, type: 'prime' },

  // Portrait Primes
  { id: 'prime-65', name: '65mm Prime', focalLength: 65, type: 'prime' },
  { id: 'prime-75', name: '75mm Prime', focalLength: 75, type: 'prime' },
  { id: 'prime-85', name: '85mm Prime', focalLength: 85, type: 'prime' },
  { id: 'prime-100', name: '100mm Prime', focalLength: 100, type: 'prime' },

  // Telephoto Primes
  { id: 'prime-135', name: '135mm Prime', focalLength: 135, type: 'prime' },
  { id: 'prime-150', name: '150mm Prime', focalLength: 150, type: 'prime' },
  { id: 'prime-200', name: '200mm Prime', focalLength: 200, type: 'prime' },
  { id: 'prime-300', name: '300mm Prime', focalLength: 300, type: 'prime' },

  // Standard Zooms
  {
    id: 'zoom-16-35',
    name: '16-35mm Zoom',
    focalLength: 24,
    type: 'zoom',
    minFocalLength: 16,
    maxFocalLength: 35,
  },
  {
    id: 'zoom-24-70',
    name: '24-70mm Zoom',
    focalLength: 35,
    type: 'zoom',
    minFocalLength: 24,
    maxFocalLength: 70,
  },
  {
    id: 'zoom-24-105',
    name: '24-105mm Zoom',
    focalLength: 50,
    type: 'zoom',
    minFocalLength: 24,
    maxFocalLength: 105,
  },

  // Telephoto Zooms
  {
    id: 'zoom-70-200',
    name: '70-200mm Zoom',
    focalLength: 100,
    type: 'zoom',
    minFocalLength: 70,
    maxFocalLength: 200,
  },
  {
    id: 'zoom-100-400',
    name: '100-400mm Zoom',
    focalLength: 200,
    type: 'zoom',
    minFocalLength: 100,
    maxFocalLength: 400,
  },

  // Cinema Zooms
  {
    id: 'cinema-18-35',
    name: 'Cinema 18-35mm',
    focalLength: 24,
    type: 'zoom',
    minFocalLength: 18,
    maxFocalLength: 35,
  },
  {
    id: 'cinema-28-80',
    name: 'Cinema 28-80mm',
    focalLength: 50,
    type: 'zoom',
    minFocalLength: 28,
    maxFocalLength: 80,
  },
  {
    id: 'cinema-70-200',
    name: 'Cinema 70-200mm',
    focalLength: 100,
    type: 'zoom',
    minFocalLength: 70,
    maxFocalLength: 200,
  },
];

export const APERTURE_STOPS = [
  1.0, 1.2, 1.4, 1.8, 2.0, 2.8, 4.0, 5.6, 8.0, 11, 16, 22
];

export function getLensPreset(id: string): LensPreset | undefined {
  return LENS_PRESETS.find(preset => preset.id === id);
}

export function getPrimeLenses(): LensPreset[] {
  return LENS_PRESETS.filter(lens => lens.type === 'prime');
}

export function getZoomLenses(): LensPreset[] {
  return LENS_PRESETS.filter(lens => lens.type === 'zoom');
}
