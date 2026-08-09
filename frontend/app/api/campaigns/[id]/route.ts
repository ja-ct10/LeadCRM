import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = req.headers.get('x-tenant-id') || 'default-tenant-id';
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id, tenantId },
      include: {
        targetAudience: true,
        emailTemplate: true,
        smsTemplate: true,
        metrics: {
          orderBy: { snapshotAt: 'desc' },
          take: 1
        },
        _count: {
          select: {
            campaignContacts: true,
            emailDeliveryLogs: true,
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ data: campaign });
  } catch (error: any) {
    console.error('Failed to fetch campaign:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
