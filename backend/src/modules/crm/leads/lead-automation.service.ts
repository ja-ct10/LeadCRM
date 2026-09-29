import { Prisma } from '@prisma/client';
import prisma from '../../../config/database.config';
import { environmentContext } from '../../../core/environment/environment-context';
import { ValidationError } from '../../../shared/errors/http-error';
import { FORM_PRODUCT_INTERESTS, ProductInterestConfigSchema } from '@leadcrm/shared';

type Tx = Prisma.TransactionClient;
export const crmScope = (tenantId: string) => ({ tenantId, environment: environmentContext.getStore()?.environment ?? 'PRODUCTION' as const });

/** Retry database serialization conflicts, including first-use preference races. */
export async function salesTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: 'Serializable', timeout: 20000 }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code) && attempt < 4) continue;
      throw error;
    }
  }
}

export async function productConfiguration(tx: Tx, tenantId: string) {
  const key = { tenantId, module: 'product-interests', key: 'values' };
  const saved = await tx.tenantPreference.upsert({ where: { tenantId_module_key: key }, update: {},
    create: { ...key, value: FORM_PRODUCT_INTERESTS.map(name => ({ name, value: 0 })) } });
  return ProductInterestConfigSchema.parse(saved.value);
}

export async function eligibleAgents(tx: Tx, tenantId: string) {
  const users = await tx.user.findMany({ where: { tenantId, status: 'ACTIVE', role: { notIn: ['Client Admin', 'System Admin', 'Guest'] } },
    include: { userRoles: { where: { tenantId, role: { tenantId, isArchived: false, NOT: { name: { equals: 'Guest', mode: 'insensitive' } } } }, include: { role: { include: { permissions: { where: { tenantId } } } } } } }, orderBy: { id: 'asc' } });
  return users.filter(user => ['contacts', 'deals'].every(module => {
    const permissions = user.userRoles.flatMap(link => link.role.permissions).filter(p => p.module === module);
    return permissions.some(p => p.canView) && permissions.some(p => p.canEdit);
  }));
}

export async function validateSalesOwner(tx: Tx, tenantId: string, id: string) {
  // Client Admin already supports explicit ownership; never included in automatic rotation.
  const admin = await tx.user.findFirst({ where: { tenantId, id, status: 'ACTIVE', role: 'Client Admin' } });
  if (admin) return admin;
  const owner = (await eligibleAgents(tx, tenantId)).find(user => user.id === id);
  if (!owner) throw new ValidationError('Choose an active sales agent with Lead and Deal permissions in this workspace.');
  return owner;
}

export async function salesPipeline(tx: Tx, tenantId: string) {
  const scope = crmScope(tenantId);
  let pipeline = await tx.pipeline.findFirst({ where: { ...scope, name: { equals: 'Sales Pipeline', mode: 'insensitive' } }, orderBy: { createdAt: 'asc' } });
  if (pipeline?.isArchived) pipeline = await tx.pipeline.update({ where: { id: pipeline.id, ...scope }, data: { isArchived: false } });
  if (!pipeline) pipeline = await tx.pipeline.create({ data: { ...scope, name: 'Sales Pipeline', type: 'Sales', isDefault: true } });
  let stages = await tx.stage.findMany({ where: { ...scope, pipelineId: pipeline.id }, orderBy: { order: 'asc' } });
  if (!stages.length) {
    for (const [order, name] of ['Lead', 'Contacted', 'Qualified', 'Won', 'Lost'].entries()) await tx.stage.create({ data: {
      ...scope, pipelineId: pipeline.id, name, order, isDefault: order === 0, isWon: name === 'Won', isLost: name === 'Lost', probability: name === 'Won' ? 100 : 0, requiredFields: [],
    } });
    stages = await tx.stage.findMany({ where: { ...scope, pipelineId: pipeline.id }, orderBy: { order: 'asc' } });
  }
  let initial = stages.find(stage => stage.name.toLowerCase() === 'lead' && !stage.isWon && !stage.isLost);
  if (!initial) initial = await tx.stage.create({ data: { ...scope, pipelineId: pipeline.id, name: 'Lead', order: Math.min(...stages.map(s => s.order)) - 1, isDefault: true, requiredFields: [] } });
  return { pipeline, initial };
}

export async function createProductDeals(tx: Tx, tenantId: string, leadId: string, actorId?: string) {
  const scope = crmScope(tenantId);
  const lead = await tx.lead.findFirstOrThrow({ where: { id: leadId, ...scope } });
  const products = await productConfiguration(tx, tenantId);
  const selected = [...new Set(lead.productInterest)].map(name => {
    const product = products.find(p => p.name === name);
    if (!product) throw new ValidationError(`Unknown Product Interest: ${name}`);
    return product;
  });
  if (!lead.assignedUserId || !selected.length || lead.isArchived) return;
  const agent = await validateSalesOwner(tx, tenantId, lead.assignedUserId);
  const { pipeline, initial } = await salesPipeline(tx, tenantId);
  for (const product of selected) {
    const automationKey = `${lead.id}:${product.name}`;
    if (await tx.deal.findFirst({ where: { ...scope, automationKey } })) continue;
    const deal = await tx.deal.create({ data: { ...scope, automationKey, leadId: lead.id, title: `${lead.firstName} ${lead.lastName} – ${product.name}`.slice(0, 255),
      productInterests: [product.name], value: product.value, assignedUserId: lead.assignedUserId, ownerId: lead.assignedUserId,
      pipelineId: pipeline.id, stageId: initial.id, accountId: lead.accountId, leadSource: lead.source, tags: [] } });
    await tx.leadDeal.create({ data: { ...scope, leadId: lead.id, dealId: deal.id, addedById: actorId } });
    await tx.activity.create({ data: { ...scope, dealId: deal.id, createdById: actorId ?? lead.assignedUserId,
      type: 'deal_action', title: `Deal created for ${product.name}; assigned to ${agent.firstName} ${agent.lastName}`, description: "System created this Deal from the Lead's Product Interest." } });
  }
}

export async function createAssignedLead(tx: Tx, input: Prisma.LeadUncheckedCreateInput, actorId?: string) {
  const scope = crmScope(input.tenantId);
  if (input.creationKey) {
    const existing = await tx.lead.findFirst({ where: { ...scope, creationKey: input.creationKey } });
    if (existing) return existing;
  }
  if (input.accountId && !await tx.account.findFirst({ where: { ...scope, id: input.accountId, isArchived: false } })) throw new ValidationError('Account is unavailable in this workspace.');
  const lead = await tx.lead.create({ data: { ...input, ...scope, assignedUserId: null } });
  const agents = await eligibleAgents(tx, scope.tenantId);
  let agent = input.assignedUserId ? await validateSalesOwner(tx, scope.tenantId, input.assignedUserId) : undefined;
  if (!agent && agents.length) {
    const key = { tenantId: scope.tenantId, module: 'lead-assignment', key: scope.environment };
    const cursor = await tx.tenantPreference.findUnique({ where: { tenantId_module_key: key } });
    const lastId = typeof cursor?.value === 'string' ? cursor.value : '';
    agent = agents[(agents.findIndex(user => user.id === lastId) + 1) % agents.length];
    await tx.tenantPreference.upsert({ where: { tenantId_module_key: key }, create: { ...key, value: agent.id }, update: { value: agent.id } });
  }
  if (agent) {
    await tx.lead.update({ where: { id: lead.id, ...scope }, data: { assignedUserId: agent.id } });
    await tx.activity.create({ data: { ...scope, leadId: lead.id, createdById: actorId ?? agent.id, type: 'assignment',
      title: `Lead assigned to ${agent.firstName} ${agent.lastName}`, description: `${input.assignedUserId ? 'Explicit' : 'System round-robin'} assignment.` } });
  }
  await createProductDeals(tx, scope.tenantId, lead.id, actorId);
  return tx.lead.findFirstOrThrow({ where: { id: lead.id, ...scope }, include: { assignedUser: { select: { id: true, firstName: true, lastName: true } } } });
}
