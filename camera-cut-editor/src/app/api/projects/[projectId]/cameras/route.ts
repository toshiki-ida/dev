import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId]/cameras - Get all cameras for a project
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;

    const cameras = await prisma.camera.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(cameras);
  } catch (error) {
    console.error('[API] GET /api/projects/[projectId]/cameras error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cameras' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[projectId]/cameras - Create a new camera
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const {
      name,
      positionX = 0,
      positionY = 1.6,
      positionZ = 5,
      pan = 0,
      tilt = 0,
      roll = 0,
      fov = 50,
      focalLength = 35,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Camera name is required' },
        { status: 400 }
      );
    }

    // Get next order number
    const lastCamera = await prisma.camera.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
    });
    const order = lastCamera ? lastCamera.order + 1 : 0;

    const camera = await prisma.camera.create({
      data: {
        name,
        order,
        positionX,
        positionY,
        positionZ,
        pan,
        tilt,
        roll,
        fov,
        focalLength,
        projectId,
      },
    });

    return NextResponse.json(camera, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/projects/[projectId]/cameras error:', error);
    return NextResponse.json(
      { error: 'Failed to create camera' },
      { status: 500 }
    );
  }
}
