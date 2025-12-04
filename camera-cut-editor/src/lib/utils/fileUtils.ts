import { ModelFileType } from '@/types/model';

export const SUPPORTED_MODEL_EXTENSIONS = [
  '.gltf',
  '.glb',
  '.fbx',
  '.obj',
  '.usd',
  '.usdz',
  '.ply',
  '.splat',
  '.spz',
  '.ksplat',
];

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot).toLowerCase();
}

export function getFileType(fileName: string): ModelFileType | null {
  const ext = getFileExtension(fileName);
  switch (ext) {
    case '.gltf':
      return 'gltf';
    case '.glb':
      return 'glb';
    case '.fbx':
      return 'fbx';
    case '.obj':
      return 'obj';
    case '.usd':
      return 'usd';
    case '.usdz':
      return 'usdz';
    case '.ply':
      return 'ply';
    case '.splat':
      return 'splat';
    case '.spz':
      return 'spz';
    case '.ksplat':
      return 'ksplat';
    default:
      return null;
  }
}

export function isSupported3DFile(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return SUPPORTED_MODEL_EXTENSIONS.includes(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`,
    };
  }

  // Check file type
  if (!isSupported3DFile(file.name)) {
    return {
      valid: false,
      error: `Unsupported file format. Supported formats: ${SUPPORTED_MODEL_EXTENSIONS.join(', ')}`,
    };
  }

  return { valid: true };
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJSON(data: unknown, fileName: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, fileName);
}

export function downloadText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  downloadBlob(blob, fileName);
}

// Create object URL from file and manage cleanup
export class ObjectURLManager {
  private urls: Map<string, string> = new Map();

  create(file: File, id: string): string {
    // Revoke old URL if exists
    this.revoke(id);

    const url = URL.createObjectURL(file);
    this.urls.set(id, url);
    return url;
  }

  get(id: string): string | undefined {
    return this.urls.get(id);
  }

  revoke(id: string): void {
    const url = this.urls.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this.urls.delete(id);
    }
  }

  revokeAll(): void {
    this.urls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.urls.clear();
  }
}

export const objectURLManager = new ObjectURLManager();
