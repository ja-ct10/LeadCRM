import type { HelpCategory } from './types';
import { gettingStartedArticles } from './getting-started';
import { leadArticles } from './leads';
import { contactArticles, accountArticles } from './contacts-accounts';
import { dealArticles, taskArticles } from './deals-tasks';
import { campaignArticles } from './campaigns';
import { workflowArticles } from './workflows';
import { dashboardArticles } from './dashboard';
import { teamArticles, roleArticles } from './administration';
import { settingsArticles, securityArticles } from './settings';
import { troubleshootingArticles } from './troubleshooting';

const frontend = 'frontend/src/features/tenant/';
const backend = 'backend/src/modules/';
export const helpCategories: HelpCategory[] = [
  { id: 'getting-started', title: 'Getting Started', description: 'Your workspace, navigation, search, and first steps.', sources: [`${frontend}layout/topbar.tsx`, 'frontend/src/shared/components/global-omnibox.tsx'] },
  { id: 'leads', title: 'Leads', description: 'Capture prospects, qualify interest, and convert leads.', sources: [`${frontend}crm/leads/ui/lead-form.tsx`, `${frontend}crm/leads/ui/leads-page.tsx`, `${frontend}crm/leads/ui/convert-lead-dialog.tsx`, `${frontend}crm/shared/import/configs/lead-import.config.ts`, `${backend}crm/leads/lead-automation.service.ts`, `${backend}crm/leads/lead-conversion.service.ts`, `${backend}crm/access/crm-record-access.service.ts`, 'frontend/src/shared/components/crm/crm-record-view.tsx'] },
  { id: 'contacts', title: 'Contacts', description: 'Maintain customer details and company relationships.', sources: [`${frontend}crm/contacts/ui/contact-form.tsx`, `${frontend}crm/contacts/ui/contacts-page.tsx`, `${backend}crm/contacts-v2/contacts-v2.repository.ts`, `${backend}crm/contacts-v2/contact-creation.ts`, 'frontend/src/shared/components/crm/crm-record-view.tsx'] },
  { id: 'accounts', title: 'Accounts', description: 'Organize companies, addresses, and linked records.', sources: [`${frontend}crm/accounts/ui/account-form.tsx`, `${frontend}crm/accounts/schemas/account.schema.ts`, `${backend}crm/companies/companies.repository.ts`, 'frontend/src/shared/components/crm/organization-fields.tsx', 'frontend/src/shared/components/crm/crm-record-view.tsx'] },
  { id: 'deals', title: 'Deals & Pipeline', description: 'Track opportunities from an open stage to won or lost.', sources: [`${frontend}crm/deals/ui/deal-form.tsx`, `${frontend}crm/pipeline/ui/pipeline-page.tsx`, `${backend}crm/deals/deals.service.ts`, `${backend}crm/deals/deal-batch.service.ts`, `${backend}crm/deals/deal-lifecycle.ts`, 'frontend/src/shared/components/crm/deal-closing-requirements.tsx', 'frontend/src/shared/components/crm/crm-record-view.tsx'] },
  { id: 'tasks', title: 'Tasks', description: 'Assign follow-ups, set due dates, and complete work.', sources: [`${frontend}operations/tasks/ui/task-board.tsx`, `${frontend}operations/tasks/ui/task-editor.tsx`, `${frontend}operations/tasks/ui/related-tasks.tsx`, `${backend}operations/tasks/tasks.service.ts`] },
  { id: 'campaigns', title: 'Campaigns', description: 'Select audiences, send messages, and review delivery.', sources: [`${frontend}marketing/campaigns/ui/campaigns-page.tsx`, `${frontend}marketing/campaigns/ui/campaign-builder.tsx`, `${backend}marketing/campaigns/campaigns.service.ts`, `${backend}marketing/campaigns/campaign-submission-recovery.ts`, `${backend}marketing/templates/templates.service.ts`, 'backend/src/integrations/gmail/scheduled-mailbox.service.ts'] },
  { id: 'automation', title: 'Workflows & Automation', description: 'Connect record events, conditions, and supported actions.', sources: ['shared/src/contracts/workflow-catalog.ts', 'shared/src/contracts/workflow.contracts.ts', `${frontend}automation/workflows/ui/workflows-page.tsx`, `${frontend}automation/workflows/ui/visual-workflow-builder.tsx`, `${frontend}automation/workflows/ui/workflow-test-panel.tsx`, `${backend}automation/workflows/workflow.engine.ts`] },
  { id: 'dashboard', title: 'Dashboard', description: 'Understand sales metrics, charts, and exports.', sources: [`${frontend}dashboard/ui/dashboard.tsx`, `${frontend}dashboard/hooks/use-dashboard-report.ts`, `${frontend}reporting/ui/reports-page.tsx`, `${backend}reporting/reports/dashboard.service.ts`] },
  { id: 'team', title: 'Team Management', description: 'Manage users, Groups, status, and reassignment.', sources: [`${frontend}settings/ui/team-management-users.tsx`, `${frontend}settings/ui/team-management-groups.tsx`, `${backend}administration/users/user-deactivation.service.ts`, 'backend/src/api/routes/administration.routes.ts'] },
  { id: 'roles', title: 'Roles & Permissions', description: 'Understand RBAC, assign roles, and manage permissions.', sources: [`${frontend}settings/ui/roles-permissions.tsx`, `${backend}administration/roles/roles.service.ts`, `${backend}administration/roles/roles.repository.ts`, 'shared/src/constants/permission-modules.ts'] },
  { id: 'settings', title: 'Settings', description: 'Profile, organization, fields, Products, Forms, Inbox, and recovery.', sources: [`${frontend}settings/ui/settings-page.tsx`, `${frontend}settings/ui/profile-form.tsx`, `${frontend}settings/ui/organization-settings-form.tsx`, 'frontend/src/shared/components/appearance-settings.tsx', `${frontend}settings/ui/closing-fields-settings.tsx`, `${backend}crm/closing-requirements/closing-requirements.service.ts`, `${backend}crm/closing-requirements/field-layout.service.ts`, `${frontend}settings/ui/products-page.tsx`, `${backend}administration/product-interests/product-interests.service.ts`, `${frontend}settings/ui/archived-data.tsx`, 'shared/src/contracts/archived-data.contract.ts', `${backend}administration/archived-data/archived-data.service.ts`, `${frontend}marketing/forms/ui/form-builder-page.tsx`, `${frontend}marketing/forms/ui/field-palette.tsx`, `${frontend}marketing/forms/ui/form-settings-panel.tsx`, `${frontend}marketing/forms/ui/form-share-panel.tsx`, `${backend}marketing/forms/forms.service.ts`, `${frontend}inbox/ui/inbox-page.tsx`, 'backend/src/integrations/gmail/mailbox-scope.ts', 'backend/src/integrations/gmail/mailbox-sync.service.ts', 'frontend/src/shared/components/crm/email-activity.tsx', 'backend/src/core/auth/profile.service.ts'] },
  { id: 'security', title: 'Security & History', description: 'Review recorded actions and understand access boundaries.', sources: [`${frontend}settings/ui/team-management-users.tsx`, 'backend/src/api/middleware/rbac.middleware.ts'] },
  { id: 'troubleshooting', title: 'Troubleshooting', description: 'Find missing records and resolve common input or access issues.', sources: ['frontend/src/shared/utils/ph-phone.ts', `${frontend}settings/ui/roles-permissions.tsx`, `${frontend}settings/ui/organization-settings-form.tsx`] },
];

export const helpArticles = [
  ...gettingStartedArticles, ...leadArticles, ...contactArticles, ...accountArticles,
  ...dealArticles, ...taskArticles, ...campaignArticles, ...workflowArticles,
  ...dashboardArticles, ...teamArticles, ...roleArticles, ...settingsArticles,
  ...securityArticles, ...troubleshootingArticles,
];
export const popularArticleIds = ['welcome', 'crm-records', 'creating-leads', 'pipeline-stages', 'creating-campaigns', 'creating-workflows', 'creating-roles'];
export const getArticle = (slug: string) => helpArticles.find(article => article.slug === slug);
export const getCategory = (id: string) => helpCategories.find(category => category.id === id);
export const getCategoryArticles = (id: string) => helpArticles.filter(article => article.category === id);
export function getRelatedArticles(slug: string) {
  const current = getArticle(slug);
  if (!current) return [];
  return current.related.map(getArticle).filter((article): article is NonNullable<typeof article> => Boolean(article));
}
