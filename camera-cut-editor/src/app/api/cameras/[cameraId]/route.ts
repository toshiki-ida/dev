import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ cameraId: string }>;
}

// GET /api/cameras/[cameraId] - Get a single camera
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { cameraId } = await params;

    const camera = await prisma.camera.findUnique({
      where: { id: cameraId },
    });

    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    return NextResponse.json(camera);
  } catch (error) {
    console.error('[API] GET /api/cameras/[cameraId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch camera' },
      { status: 500 }
    );
  }
}

// PATCH /api/cameras/[cameraId] - Update a camera
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { cameraId } = await params;
    const body = await request.json();

    // Extract all possible fields
    const {
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
      near,
      far,
      isLive,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (order !== undefined) updateData.order = order;
    if (positionX !== undefined) updateData.positionX = positionX;
    if (positionY !== undefined) updateData.positionY = positionY;
    if (positionZ !== undefined) updateData.positionZ = positionZ;
    if (pan !== undefined) updateData.pan = pan;
    if (tilt !== undefined) updateData.tilt = tilt;
    if (roll !== undefined) updateData.roll = roll;
    if (fov !== undefined) updateData.fov = fov;
    if (focalLength !== undefined) updateData.focalLength = focalLength;
    if (near !== undefined) updateData.near = near;
    if (far !== undefined) updateData.far = far;
    if (isLive !== undefined) updateData.isLive = isLive;

    const camera = await prisma.camera.update({
      where: { id: cameraId },
      data: updateData,
    });

    return NextResponse.json(camera);
  } catch (error) {
    console.error('[API] PATCH /api/cameras/[cameraId] error:', error);
    return NextResponse.json(
      { error: 'Failed to update camera' },
      { status: 500 }
    );
  }
}

// DELETE /api/cameras/[cameraId] - Delete a camera
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { cameraId } = await params;

    await prisma.camera.delete({
      where: { id: cameraId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] DELETE /api/cameras/[cameraId] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete camera' },
      { status: 500 }
    );
  }
}
