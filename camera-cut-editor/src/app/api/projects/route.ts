import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// GET /api/projects - List all projects
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        cameras: true,
        models: true,
        _count: {
          select: { cameras: true, models: true, members: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('[API] GET /api/projects error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, ownerId } = body;

    if (!name || !ownerId) {
      return NextResponse.json(
        { error: 'Name and ownerId are required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        ownerId,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/projects error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
