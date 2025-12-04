import { SensorPreset } from '@/types/camera';

export const SENSOR_PRESETS: SensorPreset[] = [
  // Full Frame
  {
    id: 'full-frame',
    name: 'Full Frame',
    width: 36,
    height: 24,
    manufacturer: 'Standard',
  },

  // Super 35mm Variants
  {
    id: 'super35-4perf',
    name: 'Super 35mm (4 perf)',
    width: 24.89,
    height: 18.66,
    manufacturer: 'Standard',
  },
  {
    id: 'super35-3perf',
    name: 'Super 35mm (3 perf)',
    width: 24.89,
    height: 14.0,
    manufacturer: 'Standard',
  },

  // RED Cinema Cameras
  {
    id: 'red-monstro-8k-vv',
    name: 'RED Monstro 8K VV',
    width: 40.96,
    height: 21.6,
    manufacturer: 'RED',
  },
  {
    id: 'red-komodo',
    name: 'RED KOMODO 6K',
    width: 27.03,
    height: 14.26,
    manufacturer: 'RED',
  },

  // ARRI Cameras
  {
    id: 'arri-alexa-35',
    name: 'ARRI Alexa 35',
    width: 27.99,
    height: 19.22,
    manufacturer: 'ARRI',
  },
  {
    id: 'arri-alexa-lf',
    name: 'ARRI Alexa LF',
    width: 36.7,
    height: 25.54,
    manufacturer: 'ARRI',
  },
  {
    id: 'arri-alexa-mini',
    name: 'ARRI Alexa Mini',
    width: 28.25,
    height: 18.17,
    manufacturer: 'ARRI',
  },

  // Sony Cinema
  {
    id: 'sony-venice',
    name: 'Sony VENICE',
    width: 36.2,
    height: 24.1,
    manufacturer: 'Sony',
  },
  {
    id: 'sony-venice-2',
    name: 'Sony VENICE 2',
    width: 36.2,
    height: 24.1,
    manufacturer: 'Sony',
  },
  {
    id: 'sony-fx6',
    name: 'Sony FX6',
    width: 35.6,
    height: 23.8,
    manufacturer: 'Sony',
  },

  // Blackmagic
  {
    id: 'bmpcc-6k',
    name: 'Blackmagic 6K',
    width: 23.1,
    height: 12.99,
    manufacturer: 'Blackmagic',
  },
  {
    id: 'bmpcc-6k-pro',
    name: 'Blackmagic 6K Pro',
    width: 23.1,
    height: 12.99,
    manufacturer: 'Blackmagic',
  },
  {
    id: 'bmpcc-4k',
    name: 'Blackmagic 4K',
    width: 18.96,
    height: 10.0,
    manufacturer: 'Blackmagic',
  },

  // Canon
  {
    id: 'canon-c70',
    name: 'Canon C70',
    width: 26.2,
    height: 13.8,
    manufacturer: 'Canon',
  },
  {
    id: 'canon-apsc',
    name: 'APS-C (Canon)',
    width: 22.3,
    height: 14.9,
    manufacturer: 'Canon',
  },

  // Sony
  {
    id: 'sony-apsc',
    name: 'APS-C (Sony)',
    width: 23.5,
    height: 15.6,
    manufacturer: 'Sony',
  },

  // Micro Four Thirds
  {
    id: 'mft',
    name: 'Micro Four Thirds',
    width: 17.3,
    height: 13.0,
    manufacturer: 'Standard',
  },

  // iPhone / Mobile
  {
    id: 'iphone-15-pro-main',
    name: 'iPhone 15 Pro Main',
    width: 9.8,
    height: 7.3,
    manufacturer: 'Apple',
  },
  {
    id: 'iphone-15-pro-ultrawide',
    name: 'iPhone 15 Pro Ultra Wide',
    width: 7.6,
    height: 5.7,
    manufacturer: 'Apple',
  },
];

export function getSensorPreset(id: string): SensorPreset | undefined {
  return SENSOR_PRESETS.find(preset => preset.id === id);
}

export function getSensorsByManufacturer(manufacturer: string): SensorPreset[] {
  return SENSOR_PRESETS.filter(preset => preset.manufacturer === manufacturer);
}

export function getManufacturers(): string[] {
  const manufacturers = new Set(SENSOR_PRESETS.map(p => p.manufacturer).filter(Boolean));
  return Array.from(manufacturers) as string[];
}
