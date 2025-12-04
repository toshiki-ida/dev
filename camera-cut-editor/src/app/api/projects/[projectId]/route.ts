import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId] - Get a single project
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        cameras: {
          orderBy: { order: 'asc' },
        },
        models: true,
        layouts: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('[API] GET /api/projects/[projectId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[projectId] - Update a project
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { name, description } = body;

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('[API] PATCH /api/projects/[projectId] error:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[projectId] - Delete a project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;

    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] DELETE /api/projects/[projectId] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
