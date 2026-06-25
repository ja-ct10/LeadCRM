import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PipelineSeed {
  name:      string;
  isDefault: boolean;
  stages:    { name: string; order: number; probability: number; color: string; isWon?: boolean; isLost?: boolean; isDefault?: boolean }[];
}

const DEFAULT_PIPELINES: PipelineSeed[] = [
  {
    name:      'Sales Inquiries',
    isDefault: true,
    stages: [
      { name: 'Discovery',    order: 1, probability: 10,  color: '#6366f1', isDefault: true },
      { name: 'Assessment',   order: 2, probability: 25,  color: '#8b5cf6' },
      { name: 'Proposal',     order: 3, probability: 50,  color: '#3b82f6' },
      { name: 'Negotiation',  order: 4, probability: 75,  color: '#f59e0b' },
      { name: 'Closed Won',   order: 5, probability: 100, color: '#10b981', isWon: true },
      { name: 'Closed Lost',  order: 6, probability: 0,   color: '#ef4444', isLost: true },
    ],
  },
  {
    name:      'Technical Support',
    isDefault: false,
    stages: [
      { name: 'New Request',    order: 1, probability: 0,  color: '#6366f1', isDefault: true },
      { name: 'In Progress',    order: 2, probability: 0,  color: '#3b82f6' },
      { name: 'Resolved',       order: 3, probability: 100, color: '#10b981', isWon: true },
      { name: 'Closed',         order: 4, probability: 0,  color: '#ef4444', isLost: true },
    ],
  },
  {
    name:      'Project Implementation',
    isDefault: false,
    stages: [
      { name: 'Planning',       order: 1, probability: 20,  color: '#6366f1', isDefault: true },
      { name: 'Site Survey',    order: 2, probability: 40,  color: '#8b5cf6' },
      { name: 'Installation',   order: 3, probability: 70,  color: '#3b82f6' },
      { name: 'Testing',        order: 4, probability: 85,  color: '#f59e0b' },
      { name: 'Completed',      order: 5, probability: 100, color: '#10b981', isWon: true },
      { name: 'Cancelled',      order: 6, probability: 0,   color: '#ef4444', isLost: true },
    ],
  },
  {
    name:      'After-Sales Concerns',
    isDefault: false,
    stages: [
      { name: 'Reported',       order: 1, probability: 0,  color: '#6366f1', isDefault: true },
      { name: 'Investigating',  order: 2, probability: 0,  color: '#3b82f6' },
      { name: 'Resolved',       order: 3, probability: 100, color: '#10b981', isWon: true },
      { name: 'Closed',         order: 4, probability: 0,  color: '#ef4444', isLost: true },
    ],
  },
];

export async function seedDefaultPipelines(tenantId: string): Promise<void> {
  console.log(`[Seed] Creating default pipelines for tenant: ${tenantId}`);

  for (const pipeline of DEFAULT_PIPELINES) {
    const existing = await prisma.pipeline.findFirst({
      where: { tenantId, name: pipeline.name },
    });

    if (existing) {
      console.log(`[Seed] Pipeline already exists: ${pipeline.name}`);
      continue;
    }

    await prisma.pipeline.create({
      data: {
        tenantId,
        name:      pipeline.name,
        isDefault: pipeline.isDefault,
        stages: {
          create: pipeline.stages.map((s) => ({
            name:        s.name,
            order:       s.order,
            probability: s.probability,
            color:       s.color,
            isWon:       s.isWon    ?? false,
            isLost:      s.isLost   ?? false,
            isDefault:   s.isDefault ?? false,
          })),
        },
      },
    });

    console.log(`[Seed] Pipeline created: ${pipeline.name}`);
  }
}
