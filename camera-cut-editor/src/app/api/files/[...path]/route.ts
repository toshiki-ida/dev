import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

// Content type mapping for 3D model files
const CONTENT_TYPES: Record<string, string> = {
  '.ply': 'application/octet-stream',
  '.splat': 'application/octet-stream',
  '.spz': 'application/octet-stream',
  '.ksplat': 'application/octet-stream',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.fbx': 'application/octet-stream',
  '.obj': 'text/plain',
  '.usd': 'application/octet-stream',
  '.usdz': 'model/vnd.usdz+zip',
};

// GET /api/files/[...path] - Serve uploaded files
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const pathSegments = (await params).path;
    const relativePath = pathSegments.join('/');

    // Construct full file path
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.join(uploadDir, relativePath);

    // Security: Prevent path traversal
    const normalizedPath = path.normalize(filePath);
    const normalizedUploadDir = path.normalize(uploadDir);
    if (!normalizedPath.startsWith(normalizedUploadDir)) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Get file stats
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return NextResponse.json(
        { error: 'Not a file' },
        { status: 400 }
      );
    }

    // Read file
    const fileBuffer = await readFile(filePath);

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStat.size.toString(),
        'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[API] GET /api/files error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
