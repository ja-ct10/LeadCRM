import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['Email', 'SMS']),
  category: z.string().optional(),
  subject: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
});

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id') || 'default-tenant-id';
    
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    
    const templates = await prisma.template.findMany({
      where: { 
        tenantId, 
        isArchived: false,
        ...(type ? { type } : {})
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ data: templates });
  } catch (error: any) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id') || 'default-tenant-id';
    const body = await req.json();

    const validatedData = createTemplateSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json({ error: 'Invalid data', details: validatedData.error.errors }, { status: 400 });
    }

    const template = await prisma.template.create({
      data: {
        tenantId,
        ...validatedData.data
      }
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create template:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
