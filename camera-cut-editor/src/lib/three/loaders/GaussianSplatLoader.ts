import * as THREE from 'three';

/**
 * 3D Gaussian Splatting Loader
 *
 * Supports:
 * - .ply (3DGS standard output format)
 * - .splat (compressed binary format)
 *
 * This is a simplified implementation. For production use, consider:
 * - gsplat.js: https://github.com/dylanebert/gsplat.js
 * - antimatter15/splat: https://github.com/antimatter15/splat
 */

export interface SplatData {
  positions: Float32Array;     // xyz * N
  colors: Float32Array;        // rgba * N
  scales: Float32Array;        // scale xyz * N
  rotations: Float32Array;     // quaternion xyzw * N
  count: number;
}

export type SplatProgressCallback = (progress: number) => void;

export class GaussianSplatLoader {
  /**
   * Load a 3D Gaussian Splatting file
   */
  async load(
    url: string,
    onProgress?: SplatProgressCallback
  ): Promise<THREE.Points> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const fileName = url.split('/').pop() || '';
    const isPLY = fileName.toLowerCase().endsWith('.ply');

    let splatData: SplatData;

    if (isPLY) {
      splatData = await this.parsePLY(buffer, onProgress);
    } else {
      splatData = await this.parseSplat(buffer, onProgress);
    }

    return this.createPointCloud(splatData);
  }

  /**
   * Load from File object
   */
  async loadFromFile(
    file: File,
    onProgress?: SplatProgressCallback
  ): Promise<THREE.Points> {
    const buffer = await file.arrayBuffer();
    const isPLY = file.name.toLowerCase().endsWith('.ply');

    let splatData: SplatData;

    if (isPLY) {
      splatData = await this.parsePLY(buffer, onProgress);
    } else {
      splatData = await this.parseSplat(buffer, onProgress);
    }

    return this.createPointCloud(splatData);
  }

  /**
   * Parse PLY format (3DGS standard output)
   */
  private async parsePLY(
    buffer: ArrayBuffer,
    onProgress?: SplatProgressCallback
  ): Promise<SplatData> {
    const decoder = new TextDecoder();
    const text = decoder.decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 10000)));

    // Parse header
    const headerEnd = text.indexOf('end_header');
    if (headerEnd === -1) {
      throw new Error('Invalid PLY file: no end_header found');
    }

    const header = text.substring(0, headerEnd);
    const vertexCountMatch = header.match(/element vertex (\d+)/);
    if (!vertexCountMatch) {
      throw new Error('Invalid PLY file: no vertex count found');
    }

    const vertexCount = parseInt(vertexCountMatch[1], 10);
    const headerBytes = new TextEncoder().encode(header + 'end_header\n').length;

    // Check for binary format
    const isBinary = header.includes('format binary_little_endian');

    if (!isBinary) {
      throw new Error('Only binary PLY files are supported');
    }

    // Parse property layout from header
    const properties = this.parsePLYProperties(header);

    // Parse binary data
    const dataView = new DataView(buffer, headerBytes);
    const bytesPerVertex = this.calculateBytesPerVertex(properties);

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 4);
    const scales = new Float32Array(vertexCount * 3);
    const rotations = new Float32Array(vertexCount * 4);

    let offset = 0;
    for (let i = 0; i < vertexCount; i++) {
      // Position
      positions[i * 3] = dataView.getFloat32(offset + properties.x.offset, true);
      positions[i * 3 + 1] = dataView.getFloat32(offset + properties.y.offset, true);
      positions[i * 3 + 2] = dataView.getFloat32(offset + properties.z.offset, true);

      // Color (if available)
      if (properties.f_dc_0 && properties.f_dc_1 && properties.f_dc_2) {
        // Spherical harmonics DC component
        const r = 0.5 + dataView.getFloat32(offset + properties.f_dc_0.offset, true) * 0.28209479177387814;
        const g = 0.5 + dataView.getFloat32(offset + properties.f_dc_1.offset, true) * 0.28209479177387814;
        const b = 0.5 + dataView.getFloat32(offset + properties.f_dc_2.offset, true) * 0.28209479177387814;
        colors[i * 4] = Math.max(0, Math.min(1, r));
        colors[i * 4 + 1] = Math.max(0, Math.min(1, g));
        colors[i * 4 + 2] = Math.max(0, Math.min(1, b));
      } else if (properties.red && properties.green && properties.blue) {
        colors[i * 4] = dataView.getUint8(offset + properties.red.offset) / 255;
        colors[i * 4 + 1] = dataView.getUint8(offset + properties.green.offset) / 255;
        colors[i * 4 + 2] = dataView.getUint8(offset + properties.blue.offset) / 255;
      } else {
        colors[i * 4] = 0.5;
        colors[i * 4 + 1] = 0.5;
        colors[i * 4 + 2] = 0.5;
      }

      // Opacity
      if (properties.opacity) {
        const opacity = dataView.getFloat32(offset + properties.opacity.offset, true);
        colors[i * 4 + 3] = 1 / (1 + Math.exp(-opacity)); // Sigmoid
      } else {
        colors[i * 4 + 3] = 1.0;
      }

      // Scale (log scale in PLY)
      if (properties.scale_0 && properties.scale_1 && properties.scale_2) {
        scales[i * 3] = Math.exp(dataView.getFloat32(offset + properties.scale_0.offset, true));
        scales[i * 3 + 1] = Math.exp(dataView.getFloat32(offset + properties.scale_1.offset, true));
        scales[i * 3 + 2] = Math.exp(dataView.getFloat32(offset + properties.scale_2.offset, true));
      } else {
        scales[i * 3] = 0.01;
        scales[i * 3 + 1] = 0.01;
        scales[i * 3 + 2] = 0.01;
      }

      // Rotation quaternion
      if (properties.rot_0 && properties.rot_1 && properties.rot_2 && properties.rot_3) {
        rotations[i * 4] = dataView.getFloat32(offset + properties.rot_0.offset, true);
        rotations[i * 4 + 1] = dataView.getFloat32(offset + properties.rot_1.offset, true);
        rotations[i * 4 + 2] = dataView.getFloat32(offset + properties.rot_2.offset, true);
        rotations[i * 4 + 3] = dataView.getFloat32(offset + properties.rot_3.offset, true);
      } else {
        rotations[i * 4] = 1;
        rotations[i * 4 + 1] = 0;
        rotations[i * 4 + 2] = 0;
        rotations[i * 4 + 3] = 0;
      }

      offset += bytesPerVertex;

      if (onProgress && i % 10000 === 0) {
        onProgress(i / vertexCount);
      }
    }

    onProgress?.(1);

    return {
      positions,
      colors,
      scales,
      rotations,
      count: vertexCount,
    };
  }

  /**
   * Parse .splat binary format
   */
  private async parseSplat(
    buffer: ArrayBuffer,
    onProgress?: SplatProgressCallback
  ): Promise<SplatData> {
    // .splat format: 32 bytes per splat
    // Position (3 floats) + Scale (3 floats) + Color (4 bytes RGBA) + Quaternion (4 bytes normalized)
    const bytesPerSplat = 32;
    const count = Math.floor(buffer.byteLength / bytesPerSplat);

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 4);
    const scales = new Float32Array(count * 3);
    const rotations = new Float32Array(count * 4);

    const dataView = new DataView(buffer);

    for (let i = 0; i < count; i++) {
      const offset = i * bytesPerSplat;

      // Position
      positions[i * 3] = dataView.getFloat32(offset, true);
      positions[i * 3 + 1] = dataView.getFloat32(offset + 4, true);
      positions[i * 3 + 2] = dataView.getFloat32(offset + 8, true);

      // Scale
      scales[i * 3] = dataView.getFloat32(offset + 12, true);
      scales[i * 3 + 1] = dataView.getFloat32(offset + 16, true);
      scales[i * 3 + 2] = dataView.getFloat32(offset + 20, true);

      // Color RGBA
      colors[i * 4] = dataView.getUint8(offset + 24) / 255;
      colors[i * 4 + 1] = dataView.getUint8(offset + 25) / 255;
      colors[i * 4 + 2] = dataView.getUint8(offset + 26) / 255;
      colors[i * 4 + 3] = dataView.getUint8(offset + 27) / 255;

      // Quaternion (normalized bytes)
      const qx = (dataView.getUint8(offset + 28) - 128) / 128;
      const qy = (dataView.getUint8(offset + 29) - 128) / 128;
      const qz = (dataView.getUint8(offset + 30) - 128) / 128;
      const qw = (dataView.getUint8(offset + 31) - 128) / 128;
      rotations[i * 4] = qw;
      rotations[i * 4 + 1] = qx;
      rotations[i * 4 + 2] = qy;
      rotations[i * 4 + 3] = qz;

      if (onProgress && i % 10000 === 0) {
        onProgress(i / count);
      }
    }

    onProgress?.(1);

    return {
      positions,
      colors,
      scales,
      rotations,
      count,
    };
  }

  /**
   * Create Three.js Points from splat data
   */
  private createPointCloud(data: SplatData): THREE.Points {
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 4));

    // Use point size based on average scale
    const avgScale = data.scales.reduce((a, b) => a + b, 0) / data.scales.length;

    const material = new THREE.PointsMaterial({
      size: Math.max(0.01, avgScale * 10),
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    points.userData.splatData = data;

    return points;
  }

  /**
   * Parse PLY property definitions
   */
  private parsePLYProperties(header: string): Record<string, { offset: number; size: number }> {
    const properties: Record<string, { offset: number; size: number }> = {};
    const lines = header.split('\n');
    let offset = 0;

    for (const line of lines) {
      const match = line.match(/property (\w+) (\w+)/);
      if (match) {
        const [, type, name] = match;
        const size = this.getPropertySize(type);
        properties[name] = { offset, size };
        offset += size;
      }
    }

    return properties;
  }

  private getPropertySize(type: string): number {
    switch (type) {
      case 'float':
      case 'float32':
        return 4;
      case 'double':
      case 'float64':
        return 8;
      case 'int':
      case 'int32':
      case 'uint':
      case 'uint32':
        return 4;
      case 'short':
      case 'int16':
      case 'ushort':
      case 'uint16':
        return 2;
      case 'char':
      case 'int8':
      case 'uchar':
      case 'uint8':
        return 1;
      default:
        return 4;
    }
  }

  private calculateBytesPerVertex(properties: Record<string, { offset: number; size: number }>): number {
    let maxEnd = 0;
    for (const prop of Object.values(properties)) {
      const end = prop.offset + prop.size;
      if (end > maxEnd) maxEnd = end;
    }
    return maxEnd;
  }
}

export const gaussianSplatLoader = new GaussianSplatLoader();
