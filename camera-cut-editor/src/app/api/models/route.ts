import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Project models directory
const MODELS_DIR = path.join(process.cwd(), 'public', 'uploads', 'models');

// Ensure models directory exists
async function ensureModelsDir(projectId: string) {
  const projectDir = path.join(MODELS_DIR, projectId);
  if (!existsSync(projectDir)) {
    await mkdir(projectDir, { recursive: true });
  }
  return projectDir;
}

// POST - Upload a model file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string || 'default-project';
    const modelId = formData.get('modelId') as string || crypto.randomUUID();

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get file extension
    const ext = path.extname(file.name).toLowerCase();
    const validExtensions = ['.gltf', '.glb', '.fbx', '.obj', '.ply', '.splat', '.spz', '.ksplat'];

    if (!validExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Save file
    const projectDir = await ensureModelsDir(projectId);
    const fileName = `${modelId}${ext}`;
    const filePath = path.join(projectDir, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Return the URL to access the file
    const url = `/uploads/models/${projectId}/${fileName}`;

    return NextResponse.json({
      success: true,
      modelId,
      url,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('[API/models] Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

// GET - List models for a project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || 'default-project';

    const projectDir = path.join(MODELS_DIR, projectId);

    if (!existsSync(projectDir)) {
      return NextResponse.json({ models: [] });
    }

    const files = await readdir(projectDir);
    const models = await Promise.all(
      files.map(async (fileName) => {
        const filePath = path.join(projectDir, fileName);
        const stats = await stat(filePath);
        const modelId = path.basename(fileName, path.extname(fileName));

        return {
          modelId,
          fileName,
          url: `/uploads/models/${projectId}/${fileName}`,
          fileSize: stats.size,
          createdAt: stats.birthtime,
        };
      })
    );

    return NextResponse.json({ models });
  } catch (error) {
    console.error('[API/models] Error listing models:', error);
    return NextResponse.json({ error: 'Failed to list models' }, { status: 500 });
  }
}

// DELETE - Delete a model file
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || 'default-project';
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({ error: 'No modelId provided' }, { status: 400 });
    }

    const projectDir = path.join(MODELS_DIR, projectId);

    if (!existsSync(projectDir)) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find and delete the file with matching modelId
    const files = await readdir(projectDir);
    const modelFile = files.find(f => f.startsWith(modelId));

    if (!modelFile) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    await unlink(path.join(projectDir, modelFile));

    return NextResponse.json({ success: true, modelId });
  } catch (error) {
    console.error('[API/models] Error deleting model:', error);
    return NextResponse.json({ error: 'Failed to delete model' }, { status: 500 });
  }
}
