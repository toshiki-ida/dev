import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// GET /api/users - Get all users
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[API] GET /api/users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user (for testing/development)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, avatar } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        avatar,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/users error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
