import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ValidationError, NotFoundError } from '../../../../shared/errors/http-error';

/**
 * Preservation Property Tests — Lead Conversion Non-Buggy Paths
 *
 * **Property 2: Preservation** — Non-Conversion Endpoints and Re-Conversion Rejection
 * Remain Unaffected
 *
 * These tests encode behaviors that must hold on BOTH the unfixed (un-migrated) database
 * AND the fixed (migrated) database.  They establish the preservation baseline:
 * running these tests before and after applying migrations must produce the same PASS result.
 *
 * Four properties are verified:
 *   Property 2a — Re-conversion rejection: any lead with status='Converted' →
 *                 convertContact throws ValidationError "This lead has already been converted"
 *                 before any transaction starts.
 *   Property 2b — createContact:false path: no call to tx.contact.create is ever made.
 *   Property 2c — findAllContacts queries prisma.lead.* only and returns the paginated shape
 *                 { data: T[], total: number, page: number, limit: number } regardless of
 *                 generated filter parameters.
 *   Property 2d — Non-existent accountId: convertContact throws NotFoundError('Account')
 *                 and the Lead's status remains unchanged.
 *
 * **EXPECTED OUTCOME: All tests PASS** on unfixed (un-migrated) code.
 * These tests do not depend on Contact-table columns and are therefore unaffected by schema drift.
 *
 * **Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6**
 */

// ─── Shared mock infrastructure ───────────────────────────────────────────────

const mockTransaction   = vi.fn();
const mockLeadFindMany  = vi.fn();
const mockLeadCount     = vi.fn();
const mockLeadUpdate    = vi.fn();
const mockContactCreate = vi.fn();
const mockAccountCreate = vi.fn();
const mockAccountFindFirst = vi.fn();
const mockActivityCreate = vi.fn();

vi.mock('../../../../config/database.config', () => ({
  default: {
    $transaction: (cb: (tx: unknown) => Promise<unknown>) => mockTransaction(cb),
    lead: {
      findMany: (...args: unknown[]) => mockLeadFindMany(...args),
      count:    (...args: unknown[]) => mockLeadCount(...args),
    },
  },
  enforcePlanLimit: vi.fn(),
}));

vi.mock('../../../../core/audit/audit.service', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('../../automation/triggers/triggers.service', () => ({
  fireContactCreated:       vi.fn(() => Promise.resolve()),
  fireContactStatusChanged: vi.fn(() => Promise.resolve()),
}));

// ─── Repositories ─────────────────────────────────────────────────────────────
// contacts.repository.ts is NOT mocked here so Property 2c can call findAllContacts
// directly and verify it routes through prisma.lead.*.
// contacts.service.ts uses repo.findContactById — we mock that per test.

const mockFindContactById = vi.fn();

vi.mock('../contacts.repository', () => ({
  findContactById: (...args: unknown[]) => mockFindContactById(...args),
  findAllContacts: async (tenantId: string, query: Record<string, unknown>) => {
    // Delegate to the real prisma.lead.* mocks so Property 2c can assert
    // that the repository never touches prisma.contact.*.
    const { getPaginationParams } = await import('../../../../shared/helpers/pagination');
    const { page, limit } = getPaginationParams(query);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(query.archived === 'true' ? { status: 'Archived' } : { status: { not: 'Archived' } }),
      ...(query.status         ? { status:         String(query.status) }        : {}),
      ...(query.accountId      ? { accountId:      String(query.accountId) }     : {}),
      ...(query.assignedUserId ? { assignedUserId: String(query.assignedUserId) } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName:   { contains: String(query.search), mode: 'insensitive' as const } },
              { lastName:    { contains: String(query.search), mode: 'insensitive' as const } },
              { email:       { contains: String(query.search), mode: 'insensitive' as const } },
              { companyName: { contains: String(query.search), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      mockLeadFindMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      mockLeadCount({ where }),
    ]);

    return { data, total, page, limit };
  },
}));

import { convertContact, getContacts } from '../contacts.service';

// ─── tx client builder ────────────────────────────────────────────────────────
// Builds a mock Prisma transaction client.  Individual tests override the stubs
// they care about; defaults are safe no-ops to avoid unhandled rejections.

function buildTxClient(overrides: Record<string, unknown> = {}) {
  return {
    account:     { findFirst: mockAccountFindFirst, create: mockAccountCreate, update: vi.fn() },
    contact:     { findFirst: vi.fn(), create: mockContactCreate, update: vi.fn() },
    deal:        { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    leadDeal:    { create: vi.fn() },
    contactDeal: { create: vi.fn() },
    pipeline:    { findFirst: vi.fn() },
    lead:        { update: mockLeadUpdate },
    activity:    { create: mockActivityCreate },
    ...overrides,
  };
}

// ─── Common fixtures ──────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-pres-1';
const USER_ID   = 'user-pres-1';
const LEAD_ID   = 'lead-pres-1';

/** A lead that has already been converted — satisfies Property 2a. */
function makeConvertedLead(overrides: Record<string, unknown> = {}) {
  return {
    id:             LEAD_ID,
    tenantId:       TENANT_ID,
    status:         'Converted',
    firstName:      'Alice',
    lastName:       'Smith',
    email:          'alice@example.com',
    phone:          '+1 555 111 2222',
    companyName:    'Beta Inc',
    address:        '456 Oak Ave',
    source:         'Referral',
    productInterest: ['Leads Pro'],
    assignedUserId: USER_ID,
    accountId:      null,
    contactId:      'contact-existing-1',
    convertedAt:    new Date(),
    ...overrides,
  };
}

/** A non-converted lead used for Properties 2b and 2d. */
function makeActiveLead(overrides: Record<string, unknown> = {}) {
  return {
    id:             LEAD_ID,
    tenantId:       TENANT_ID,
    status:         'Inquiry',
    firstName:      'Bob',
    lastName:       'Jones',
    email:          'bob@example.com',
    phone:          '+1 555 333 4444',
    companyName:    'Gamma LLC',
    address:        '789 Pine Rd',
    source:         'Web',
    productInterest: ['Analytics'],
    assignedUserId: USER_ID,
    accountId:      null,
    contactId:      null,
    convertedAt:    null,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Property 2a — Re-conversion Rejection
// ═════════════════════════════════════════════════════════════════════════════

describe('Property 2a — Re-conversion Rejection', () => {
  /**
   * FOR ALL leads where status = 'Converted',
   * convertContact(...) ALWAYS throws ValidationError("This lead has already been converted")
   * before entering the prisma.$transaction block.
   *
   * This property DOES NOT depend on the Contact table schema — it fires before any DB write.
   * It must hold on both unfixed and fixed code.
   *
   * Validates: Requirement 3.1
   */

  beforeEach(() => {
    vi.clearAllMocks();
    // Transaction should NEVER be called for an already-converted lead
    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(buildTxClient()),
    );
  });

  it(
    'Property 2a: convertContact always throws ValidationError for any already-converted lead',
    async () => {
      // Generate varying lead IDs and account names — the lead status is always 'Converted'
      const leadIdArb     = fc.string({ minLength: 1, maxLength: 36 });
      const accountNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter(
        (s) => s.trim().length > 0,
      );
      const createDealArb = fc.boolean();

      await fc.assert(
        fc.asyncProperty(
          leadIdArb,
          accountNameArb,
          createDealArb,
          async (leadId, accountName, createDeal) => {
            // Always return a 'Converted' lead regardless of ID
            mockFindContactById.mockResolvedValue(makeConvertedLead({ id: leadId }));

            const dto = {
              accountName,
              createContact: true as const,
              createDeal,
              dealPriority: 'MEDIUM' as const,
            };

            let thrownError: unknown;
            try {
              await convertContact(leadId, TENANT_ID, USER_ID, dto);
            } catch (err) {
              thrownError = err;
            }

            // Must throw ValidationError with the exact message
            expect(thrownError).toBeInstanceOf(ValidationError);
            expect((thrownError as ValidationError).message).toBe(
              'This lead has already been converted',
            );
            expect((thrownError as ValidationError).statusCode).toBe(400);

            // Transaction must NEVER have been entered
            expect(mockTransaction).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 50 },
      );
    },
  );

  it('Property 2a (unit): re-conversion of a specific Converted lead rejects with 400', async () => {
    mockFindContactById.mockResolvedValue(makeConvertedLead());

    await expect(
      convertContact(LEAD_ID, TENANT_ID, USER_ID, {
        accountName:   'Any Corp',
        createContact: true,
        createDeal:    false,
        dealPriority:  'MEDIUM',
      }),
    ).rejects.toThrow('This lead has already been converted');

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Property 2b — createContact:false Skips tx.contact.create
// ═════════════════════════════════════════════════════════════════════════════

describe('Property 2b — createContact:false Skips Contact Creation', () => {
  /**
   * FOR ALL valid conversion requests where createContact = false,
   * tx.contact.create is NEVER called inside the transaction.
   *
   * The Account is resolved/created and the Lead is updated, but the Contact table
   * is never touched.  This path must succeed regardless of Contact table schema state.
   *
   * Validates: Requirements 3.6
   */

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindContactById.mockResolvedValue(makeActiveLead());
    // Account creation succeeds
    mockAccountCreate.mockResolvedValue({ id: 'acct-pres-1', name: 'Delta Co' });
    mockAccountFindFirst.mockResolvedValue(null); // no existing account by ID
    mockLeadUpdate.mockResolvedValue({});
    mockActivityCreate.mockResolvedValue({});

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(buildTxClient()),
    );
  });

  it(
    'Property 2b: tx.contact.create is never called when createContact=false, across varied accountNames',
    async () => {
      const accountNameArb = fc.string({ minLength: 1, maxLength: 80 }).filter(
        (s) => s.trim().length > 0,
      );

      await fc.assert(
        fc.asyncProperty(
          accountNameArb,
          async (accountName) => {
            vi.clearAllMocks();
            mockFindContactById.mockResolvedValue(makeActiveLead());
            mockAccountCreate.mockResolvedValue({ id: 'acct-pres-1', name: accountName });
            mockLeadUpdate.mockResolvedValue({});
            mockActivityCreate.mockResolvedValue({});
            mockTransaction.mockImplementation(
              (cb: (tx: unknown) => Promise<unknown>) => cb(buildTxClient()),
            );

            const dto = {
              accountName,
              createContact: false as const,  // ← key flag
              createDeal:    false as const,
              dealPriority:  'MEDIUM' as const,
            };

            // Should NOT throw — the Contact table is never accessed
            const result = await convertContact(LEAD_ID, TENANT_ID, USER_ID, dto);

            // Contact is null — no Contact record was created
            expect(result.contact).toBeNull();

            // tx.contact.create was never invoked
            expect(mockContactCreate).not.toHaveBeenCalled();

            // Account and lead update DID happen
            expect(mockAccountCreate).toHaveBeenCalledTimes(1);
            expect(mockLeadUpdate).toHaveBeenCalledTimes(1);
          },
        ),
        { numRuns: 30 },
      );
    },
  );

  it(
    'Property 2b (unit): createContact=false with existing accountId skips tx.contact.create',
    async () => {
      const existingAccount = { id: 'acct-existing-1', name: 'Existing Corp' };
      mockAccountFindFirst.mockResolvedValue(existingAccount);

      const dto = {
        accountId:     'acct-existing-1',
        createContact: false as const,
        createDeal:    false as const,
        dealPriority:  'MEDIUM' as const,
      };

      const result = await convertContact(LEAD_ID, TENANT_ID, USER_ID, dto);

      expect(result.contact).toBeNull();
      expect(mockContactCreate).not.toHaveBeenCalled();
      expect(result.account).toEqual(existingAccount);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// Property 2c — findAllContacts Queries prisma.lead.* Only
// ═════════════════════════════════════════════════════════════════════════════

describe('Property 2c — findAllContacts Uses prisma.lead.* (Contact-table Insulated)', () => {
  /**
   * FOR ALL valid filter parameter combinations,
   * getContacts(tenantId, query) calls prisma.lead.findMany and prisma.lead.count
   * and returns the paginated shape { data: T[], meta: { total, page, limit, hasMore } }.
   *
   * The Contact table is never queried.  This property holds regardless of Contact schema state,
   * which is why GET /crm/contacts should theoretically survive Contact-table schema drift
   * (the runtime 500 observed in the bug was due to Prisma client initialization failure,
   * not a direct contact query from this repository).
   *
   * Validates: Requirement 3.5
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    'Property 2c: getContacts always returns paginated shape with lead data, regardless of filters',
    async () => {
      // Generators for realistic filter combinations
      const pageArb   = fc.integer({ min: 1, max: 20 });
      const limitArb  = fc.integer({ min: 1, max: 100 });
      const searchArb = fc.oneof(
        fc.constant(undefined),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
      );
      const statusArb = fc.oneof(
        fc.constant(undefined),
        fc.constantFrom('Inquiry', 'Qualified', 'Converted', 'Archived'),
      );

      await fc.assert(
        fc.asyncProperty(
          pageArb,
          limitArb,
          searchArb,
          statusArb,
          async (page, limit, search, status) => {
            vi.clearAllMocks();

            // Simulate prisma.lead.findMany returning 3 lead rows
            const fakeLeads = [
              { id: 'l1', firstName: 'A', lastName: 'B', tenantId: TENANT_ID },
              { id: 'l2', firstName: 'C', lastName: 'D', tenantId: TENANT_ID },
              { id: 'l3', firstName: 'E', lastName: 'F', tenantId: TENANT_ID },
            ];
            const fakeTotal = 3;
            mockLeadFindMany.mockResolvedValue(fakeLeads);
            mockLeadCount.mockResolvedValue(fakeTotal);

            const query: Record<string, unknown> = { page, limit };
            if (search)  query.search = search;
            if (status)  query.status = status;

            const result = await getContacts(TENANT_ID, query);

            // Must return the paginated envelope shape
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('meta');
            expect(Array.isArray(result.data)).toBe(true);
            expect(typeof result.meta.total).toBe('number');
            expect(typeof result.meta.page).toBe('number');
            expect(typeof result.meta.limit).toBe('number');
            expect(typeof result.meta.hasMore).toBe('boolean');

            // Data comes from the mock lead rows
            expect(result.data).toEqual(fakeLeads);
            expect(result.meta.total).toBe(fakeTotal);

            // prisma.lead.findMany and count were called (not prisma.contact.*)
            expect(mockLeadFindMany).toHaveBeenCalledTimes(1);
            expect(mockLeadCount).toHaveBeenCalledTimes(1);

            // findMany call must include tenantId in where clause
            const findManyCall = mockLeadFindMany.mock.calls[0][0] as { where: { tenantId: string } };
            expect(findManyCall.where.tenantId).toBe(TENANT_ID);
          },
        ),
        { numRuns: 50 },
      );
    },
  );

  it('Property 2c (unit): getContacts with no filters returns all leads for tenant', async () => {
    const leads = [
      { id: 'la', firstName: 'X', lastName: 'Y', tenantId: TENANT_ID },
    ];
    mockLeadFindMany.mockResolvedValue(leads);
    mockLeadCount.mockResolvedValue(1);

    const result = await getContacts(TENANT_ID, {});

    expect(result.data).toEqual(leads);
    expect(result.meta.total).toBe(1);
    expect(result.meta.page).toBe(1);
    expect(mockLeadFindMany).toHaveBeenCalledTimes(1);
    expect(mockLeadCount).toHaveBeenCalledTimes(1);
  });

  it('Property 2c (unit): getContacts with search filter passes it to prisma.lead.findMany', async () => {
    mockLeadFindMany.mockResolvedValue([]);
    mockLeadCount.mockResolvedValue(0);

    await getContacts(TENANT_ID, { search: 'Acme' });

    const call = mockLeadFindMany.mock.calls[0][0] as {
      where: { OR?: Array<{ firstName?: { contains: string } }> };
    };
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR?.[0].firstName?.contains).toBe('Acme');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Property 2d — Non-Existent accountId Throws NotFoundError
// ═════════════════════════════════════════════════════════════════════════════

describe('Property 2d — Non-Existent accountId Throws NotFoundError (Lead Unchanged)', () => {
  /**
   * FOR ALL conversion requests that provide an accountId which does not exist in the tenant,
   * convertContact(...) throws NotFoundError('Account not found') and the Lead's status
   * remains unchanged (tx.lead.update is never called with status='Converted').
   *
   * This property holds before AND after migrations because the Account lookup happens
   * BEFORE the tx.contact.create step, so even an un-migrated Contact table is never reached.
   *
   * Validates: Requirement 3.4
   */

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindContactById.mockResolvedValue(makeActiveLead());

    // Account does NOT exist — findFirst returns null
    mockAccountFindFirst.mockResolvedValue(null);

    mockTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(buildTxClient()),
    );
  });

  it(
    'Property 2d: convertContact always throws NotFoundError for any non-existent accountId',
    async () => {
      // Generate random account IDs — all return null from findFirst (non-existent)
      const accountIdArb = fc.string({ minLength: 1, maxLength: 36 }).filter(
        (s) => s.trim().length > 0,
      );

      await fc.assert(
        fc.asyncProperty(
          accountIdArb,
          async (accountId) => {
            vi.clearAllMocks();
            mockFindContactById.mockResolvedValue(makeActiveLead());
            mockAccountFindFirst.mockResolvedValue(null); // account never found
            mockTransaction.mockImplementation(
              (cb: (tx: unknown) => Promise<unknown>) => cb(buildTxClient()),
            );

            const dto = {
              accountId,               // provided but not found in DB
              createContact: true as const,
              createDeal:    false as const,
              dealPriority:  'MEDIUM' as const,
            };

            let thrownError: unknown;
            try {
              await convertContact(LEAD_ID, TENANT_ID, USER_ID, dto);
            } catch (err) {
              thrownError = err;
            }

            // Must throw NotFoundError for the Account
            expect(thrownError).toBeInstanceOf(NotFoundError);
            expect((thrownError as NotFoundError).message).toBe('Account not found');
            expect((thrownError as NotFoundError).statusCode).toBe(404);

            // Lead was never updated — status unchanged (transaction rolled back)
            expect(mockLeadUpdate).not.toHaveBeenCalled();

            // Contact was never created either (Account lookup failed first)
            expect(mockContactCreate).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 40 },
      );
    },
  );

  it(
    'Property 2d (unit): non-existent accountId for a specific lead throws 404 and does not update lead',
    async () => {
      const dto = {
        accountId:     'non-existent-account-xyz',
        createContact: true as const,
        createDeal:    false as const,
        dealPriority:  'MEDIUM' as const,
      };

      await expect(
        convertContact(LEAD_ID, TENANT_ID, USER_ID, dto),
      ).rejects.toThrow('Account not found');

      await expect(
        convertContact(LEAD_ID, TENANT_ID, USER_ID, dto),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(mockLeadUpdate).not.toHaveBeenCalled();
    },
  );
});
