import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { JobProcessor } from '@/src/lib/queue/processor';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id') || 'default-tenant-id';
    const body = await req.json();
    const { triggerType, entityId, entityType, payload } = body;

    if (!triggerType) {
      return NextResponse.json({ error: 'triggerType is required' }, { status: 400 });
    }

    // Find active automation rules matching this trigger
    const rules = await prisma.automationRule.findMany({
      where: {
        tenantId,
        triggerType,
        isActive: true
      }
    });

    if (rules.length === 0) {
      return NextResponse.json({ message: 'No active rules found for this trigger' });
    }

    // For each rule, we evaluate conditions (simplified for now) and execute actions
    for (const rule of rules) {
      const actions: any = rule.actions || [];
      
      for (const action of actions) {
        if (action.type === 'SCHEDULE_CAMPAIGN') {
          const { campaignId, delayMinutes } = action.payload;
          
          if (campaignId) {
            const scheduledFor = new Date(Date.now() + (delayMinutes || 0) * 60000);
            
            // In a real system we'd link this specifically to the entity (like contactId)
            // But for this example we just schedule the campaign itself
            await prisma.campaign.update({
              where: { id: campaignId, tenantId },
              data: {
                status: 'SCHEDULED',
                scheduledFor
              }
            });
          }
        }
      }
    }

    // Optionally wake up the processor to handle immediate schedules
    JobProcessor.start();

    return NextResponse.json({ success: true, triggeredRules: rules.length });
  } catch (error: any) {
    console.error('Failed to trigger automation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
