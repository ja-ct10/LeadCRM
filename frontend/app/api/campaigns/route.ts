import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Schema for campaign creation
const createCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['EMAIL', 'SMS', 'MULTI_CHANNEL']),
  targetAudienceId: z.string().optional(),
  emailTemplateId: z.string().optional(),
  smsTemplateId: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    // Basic auth/tenant resolution would go here in a real setup
    // For now, we fetch campaigns with a fixed tenant or get from headers
    const tenantId = req.headers.get('x-tenant-id') || 'default-tenant-id';

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;

    const campaigns = await prisma.campaign.findMany({
      where: { tenantId, isArchived: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
      include: {
        _count: {
          select: { campaignContacts: true }
        }
      }
    });

    const total = await prisma.campaign.count({
      where: { tenantId, isArchived: false }
    });

    return NextResponse.json({
      data: campaigns,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Failed to fetch campaigns:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id') || 'default-tenant-id';
    const body = await req.json();

    // Validate request body
    const validatedData = createCampaignSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json({ error: 'Invalid data', details: validatedData.error.errors }, { status: 400 });
    }

    const { name, type, targetAudienceId, emailTemplateId, smsTemplateId, subject, body: contentBody } = validatedData.data;

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name,
        type,
        targetAudienceId,
        emailTemplateId,
        smsTemplateId,
        subject,
        body: contentBody,
        status: 'DRAFT',
      }
    });

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create campaign:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
