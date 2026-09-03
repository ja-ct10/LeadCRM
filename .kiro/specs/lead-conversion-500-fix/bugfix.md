# Bugfix Requirements Document

## Introduction

Triggering lead conversion via `POST /api/v1/crm/leads/{id}/convert` responds with 500 Internal Server Error instead of completing the conversion. A follow-on 500 also appears on `GET /api/v1/crm/contacts` immediately after the failed conversion attempt. Both failures share a common root in the backend CRM module and block a core CRM workflow: converting a qualified lead into a Contact, Account, and optionally a Deal.

The conversion endpoint lives in `backend/src/modules/crm/contacts/contacts.service.ts`. It runs a multi-step Prisma transaction that (a) resolves or creates an Account, (b) creates a new `Contact` record from the Lead's data, (c) optionally creates a Deal with junction records, and (d) updates the Lead's status to `Converted`. The secondary contacts list endpoint is served by `contacts-v2.controller.ts` → `contacts-v2.repository.ts`, which queries the `Contact` table.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits a valid convert payload (with `accountName` or `accountId`) to `POST /crm/leads/{id}/convert` THEN the server returns `500 Internal Server Error` and the Lead's status remains unchanged.

1.2 WHEN the convert request includes `createContact: true` (the default) THEN the server fails to create the `Contact` record inside the transaction and rolls back all changes.

1.3 WHEN `GET /crm/contacts?limit=100` is requested immediately after a failed conversion attempt THEN the server returns `500 Internal Server Error` instead of the paginated contact list.

1.4 WHEN the conversion transaction partially succeeds up to the `tx.contact.create(...)` step but the `Contact` table schema is out of sync with the Prisma-generated client (e.g., the `accountId` column or `lifecycleStage` enum column does not exist in the live database) THEN every subsequent Prisma query against the `Contact` model also fails with a schema mismatch error.

### Expected Behavior (Correct)

2.1 WHEN a user submits a valid convert payload to `POST /crm/leads/{id}/convert` THEN the server SHALL return `200 OK` with a response body containing `{ success: true, data: { lead, contact, account, deal } }`.

2.2 WHEN `createContact: true` (default) and the Lead has valid `firstName` and `lastName` fields THEN the server SHALL create a new `Contact` record in the `Contact` table with the Lead's data mapped correctly (`Lead.companyName → Contact.company`, `Lead.productInterest → Contact.productInterests`) and return it in the response.

2.3 WHEN the conversion transaction completes successfully THEN the Lead's `status` SHALL be updated to `Converted`, and `Lead.contactId`, `Lead.accountId`, and `Lead.convertedAt` SHALL be populated.

2.4 WHEN `GET /crm/contacts?limit=100` is requested after a successful conversion THEN the server SHALL return `200 OK` with a paginated list that includes the newly created Contact record.

2.5 WHEN the Contact table has all required columns present in the live database (including `accountId`, `lifecycleStage`, and `productInterests`) THEN both the conversion endpoint and the contacts list endpoint SHALL respond without error.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a Lead's `status` is already `Converted` THEN the system SHALL CONTINUE TO reject the conversion request with a `400 Bad Request` validation error ("This lead has already been converted") and SHALL NOT create duplicate Contact or Account records.

3.2 WHEN `accountId` is provided and the account exists in the tenant THEN the system SHALL CONTINUE TO link the Lead to that existing Account without creating a new one.

3.3 WHEN `createDeal: true` and `dealTitle` are provided in the convert payload THEN the system SHALL CONTINUE TO create a Deal, a `LeadDeal` junction, a `ContactDeal` junction (if a contact was created or linked), and a deal-creation Activity record inside the same transaction.

3.4 WHEN the convert payload specifies a non-existent `accountId` or `contactId` THEN the system SHALL CONTINUE TO return a `404 Not Found` error and roll back the entire transaction.

3.5 WHEN `GET /crm/leads` is requested THEN the system SHALL CONTINUE TO return the paginated lead list from the `Lead` table without error, regardless of the state of the `Contact` table.

3.6 WHEN `POST /crm/leads/{id}/convert` is called with a `createContact: false` flag THEN the system SHALL CONTINUE TO complete the conversion without creating a Contact record, linking only the Account (and optionally Deal) to the Lead.

---

## Bug Condition

**Bug Condition Function:**

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ConversionRequest
  OUTPUT: boolean

  // Bug is triggered when conversion is attempted AND the Contact table's
  // schema in the live database is missing one or more columns that the
  // Prisma-generated client expects (e.g., "accountId", "lifecycleStage",
  // "productInterests") because a pending migration has not been applied.
  RETURN (
    X.endpoint = 'POST /crm/leads/{id}/convert'
    AND X.lead.status != 'Converted'
    AND ContactTableHasMissingColumns()
  )
END FUNCTION
```

**Property: Fix Checking**

```pascal
// Property: Fix Checking — conversion succeeds when all migrations are applied
FOR ALL X WHERE isBugCondition(X) DO
  // After applying all pending migrations:
  result ← convertContact'(X)
  ASSERT result.status = 200
    AND result.data.contact != null
    AND result.data.lead.status = 'Converted'
    AND no_transaction_rollback(result)
END FOR
```

**Preservation Goal:**

```pascal
// Property: Preservation Checking — non-conversion endpoints unaffected
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // i.e., GET /leads, GET /contacts, GET /deals, re-conversion rejection,
  // and all other endpoints continue to behave identically before and after the fix.
END FOR
```
