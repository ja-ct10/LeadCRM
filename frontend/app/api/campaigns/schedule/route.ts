import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id') || 'default-tenant-id';
    const body = await req.json();
    const { campaignId, scheduledFor } = body;

    if (!campaignId || !scheduledFor) {
      return NextResponse.json({ error: 'campaignId and scheduledFor are required' }, { status: 400 });
    }

    const scheduledDate = new Date(scheduledFor);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledFor date' }, { status: 400 });
    }

    const campaign = await prisma.campaign.update({
      where: { id: campaignId, tenantId },
      data: { 
        status: 'SCHEDULED',
        scheduledFor: scheduledDate
      }
    });

    return NextResponse.json({ success: true, data: campaign });
  } catch (error: any) {
    console.error('Failed to schedule campaign:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
