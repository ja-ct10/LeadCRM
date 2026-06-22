// ─── Contact & Organization ────────────────────────────────────────────────

export interface Organization {
  id: string;
  tenantId: string;
  name: string;
  industry?: string;
  size?: string;
  website?: string;
  taxId?: string;
  assignedUserId?: string;
  tags?: string[];
  createdAt: string;
  isArchived?: boolean;
}

export interface Contact {
  id: string;
  tenantId: string;
  organizationId?: string;
  companyName: string;
  contactPerson: string;
  jobTitle: string;
  email: string;
  phone: string;
  serviceRequired: string;
  leadSource: string;
  estimatedValue: number;
  assignedUserId: string;
  expectedCloseDate: string;
  notes: string;
  status: 'Hot' | 'Warm' | 'Cold' | 'Cancelled' | 'Closed';
  score: number;
  createdAt: string;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  customerType?: 'Individual' | 'Organization';
  callStatus?: string;
  updateStatus?: string;
  contactNumbers?: { id: string; type: 'Telephone' | 'Mobile'; countryCode?: string; number: string; notes?: string }[];
  productInterest?: string;
  address?: string;
  // Enriched fields
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  displayName?: string;
  preferredName?: string;
  department?: string;
  profilePhoto?: string;
  gender?: string;
  dateOfBirth?: string;
  secondaryEmail?: string;
  workEmail?: string;
  mobileNumber?: string;
  phoneCountryCode?: string;
  altPhone?: string;
  website?: string;
  linkedin?: string;
  facebook?: string;
  otherSocial?: string;
  businessType?: string;
  companySize?: string;
  orgOwner?: string;
  orgWebsite?: string;
  orgAddress?: string;
  taxId?: string;
  country?: string;
  region?: string;
  province?: string;
  city?: string;
  barangay?: string;
  postalCode?: string;
  streetAddress?: string;
  building?: string;
  floor?: string;
  unit?: string;
  assignedTeam?: string;
  ownerId?: string;
  createdBy?: string;
  lastUpdated?: string;
  tags?: string;
  customFields?: Record<string, string>;
  internalNotes?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
}
