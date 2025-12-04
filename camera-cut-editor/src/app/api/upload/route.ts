import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Allowed file extensions for 3D models
const ALLOWED_EXTENSIONS = ['.ply', '.splat', '.spz', '.ksplat', '.gltf', '.glb', '.fbx', '.obj', '.usd', '.usdz'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// POST /api/upload - Upload a 3D model file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file extension
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` },
        { status: 400 }
      );
    }

    // Create upload directory if it doesn't exist
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const projectDir = projectId ? path.join(uploadDir, projectId) : uploadDir;

    if (!existsSync(projectDir)) {
      await mkdir(projectDir, { recursive: true });
    }

    // Generate unique filename
    const fileId = uuidv4();
    const fileName = `${fileId}${ext}`;
    const filePath = path.join(projectDir, fileName);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Generate URL for the file
    const fileUrl = `/api/files/${projectId ? `${projectId}/` : ''}${fileName}`;

    console.log(`[Upload] File saved: ${filePath}`);

    return NextResponse.json({
      success: true,
      file: {
        id: fileId,
        name: file.name,
        fileName: fileName,
        fileType: ext.slice(1), // Remove the dot
        fileSize: file.size,
        filePath: filePath,
        url: fileUrl,
      },
    });
  } catch (error) {
    console.error('[API] POST /api/upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
