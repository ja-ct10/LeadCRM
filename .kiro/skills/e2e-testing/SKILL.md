---
name: e2e-testing
description: Playwright E2E testing patterns for LeadCRM — Page Object Model, test organization, auth setup, and flaky test prevention. Apply when writing or reviewing end-to-end tests.
---

# E2E Testing — LeadCRM (Playwright)

## Test Organization

```
tests/
├── e2e/
│   ├── auth/          login, logout, register
│   ├── crm/           contacts, deals-pipeline, organizations
│   ├── marketing/     campaigns
│   └── automation/    workflows
├── fixtures/
│   └── auth.fixture.ts
└── pages/             Page Object Models
    ├── contacts.page.ts
    └── pipeline.page.ts
```

## Page Object Model

```typescript
export class ContactsPage {
  readonly addButton: Locator;
  readonly searchInput: Locator;

  constructor(readonly page: Page) {
    this.addButton = page.getByRole('button', { name: 'New Contact' });
    this.searchInput = page.getByPlaceholder('Search contacts...');
  }

  async goto() { await this.page.goto('/contacts'); }

  async createContact(data: { firstName: string; email: string }) {
    await this.addButton.click();
    await this.page.getByLabel('First Name').fill(data.firstName);
    await this.page.getByLabel('Email').fill(data.email);
    await this.page.getByRole('button', { name: 'Save' }).click();
  }
}
```

## Auth Fixture

```typescript
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('salesrep@tenant.com');
    await page.getByLabel('Password').fill('testpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('/dashboard');
    await use(page);
  },
});
```

## Anti-Flakiness Rules

```typescript
// BAD: time-based wait
await page.waitForTimeout(2000);

// GOOD: state-based wait
await page.waitForURL('/dashboard');
await expect(page.getByText('Contact created')).toBeVisible();

// BAD: CSS selector
await page.click('.btn-primary:nth-child(2)');

// GOOD: semantic selector
await page.getByRole('button', { name: 'Save' }).click();
await page.getByLabel('Email Address').fill('test@example.com');
```

## E2E Checklist

- [ ] Page Object Model used — no raw selectors in spec files
- [ ] Auth fixture reuses session — no login per test
- [ ] Semantic selectors (`getByRole`, `getByLabel`, `getByText`)
- [ ] No `waitForTimeout` — use `waitForURL`, `waitFor`, `toBeVisible`
- [ ] RBAC tested: hidden without permission, visible with permission
- [ ] Critical flows covered: login, contact CRUD, deal stage change
