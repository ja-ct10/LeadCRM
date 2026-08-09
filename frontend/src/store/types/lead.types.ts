// ─── Lead ─────────────────────────────────────────────────────────────────
// Canonical Lead type — mirrors the backend Prisma Lead model plus
// UI-only display fields used by leads-page, leads-table, lead-form, etc.
// firstName/lastName are optional to stay assignable from Contact (which has them optional).

export interface Lead {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  productInterest?: string[];
  source?: string;
  assignedUserId?: string;
  status: string;
  accountId?: string;
  createdAt: string;
  updatedAt?: string;

  // ── UI / display fields (derived or legacy-compat) ──────────────────────
  leadPerson?: string;
  displayName?: string;
  recordType?: string;
  customerType?: string;
  jobTitle?: string;
  industry?: string;
  website?: string;
  notes?: string;
  internalNotes?: string;
  score?: number;
  updateStatus?: string;
  organizationId?: string;
  isArchived?: boolean;
  archivedAt?: string;

  // ── Legacy / extra contact fields used by UI ────────────────────────────
  leadSource?: string;
  estimatedValue?: number;
  expectedCloseDate?: string;
  priority?: string;
  linkedin?: string;
  secondaryEmail?: string;
  workEmail?: string;
  altPhone?: string;
  mobileNumber?: string;
  leadNumbers?: string[];
  contactNumbers?: { id: string; type: string; countryCode?: string; number: string; notes?: string }[];
  createdBy?: string;
  lastUpdated?: string;
  tags?: string;
  productInterests?: string[];

  // ── Address breakdown fields ────────────────────────────────────────────
  streetAddress?: string;
  city?: string;
  province?: string;
  region?: string;
  barangay?: string;
  country?: string;
  postalCode?: string;
  building?: string;
  floor?: string;
  unit?: string;

  // ── Extended org fields ────────────────────────────────────────────────
  size?: string;
  taxId?: string;
  orgWebsite?: string;
  companySize?: string;
  businessType?: string;

  // ── Custom fields ─────────────────────────────────────────────────────
  customFields?: Record<string, string>;

  // ── Misc legacy compat ────────────────────────────────────────────────
  contactPerson?: string;
  preferredName?: string;
  middleName?: string;
  suffix?: string;
}

export interface CreateLeadRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  productInterest?: string[];
  source?: string;
  assignedUserId?: string;
  status?: string;
  accountId?: string;
  recordType?: string;
  leadSource?: string;
  estimatedValue?: number;
  expectedCloseDate?: string;
  jobTitle?: string;
  notes?: string;
  organizationId?: string;
  productInterests?: string[];
}

export interface UpdateLeadRequest extends Partial<CreateLeadRequest> {}
