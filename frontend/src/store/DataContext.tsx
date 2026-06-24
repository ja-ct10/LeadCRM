'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  Organization,
  Contact,
  Deal,
  Pipeline,
  Workflow,
  Campaign,
  User,
  Tenant,
  Template,
  RoleDefinition,
  Permission,
  Task,
  WorkflowExecution,
  WorkflowExecutionRun,
  WorkflowExecutionStep,
  WorkflowTriggerRecord,
  PendingAction,
  ServiceOrder,
  AuditLog,
  Asset,
  InventoryItem,
  Activity,
  Invoice,
} from "./types";
import {
  MOCK_LEADS,
  MOCK_DEALS,
  MOCK_PIPELINES,
  MOCK_WORKFLOWS,
  MOCK_CAMPAIGNS,
  MOCK_USERS,
  MOCK_TENANTS,
  MOCK_TEMPLATES,
  MOCK_ROLES,
  MOCK_PERMISSIONS,
  MOCK_TASKS,
  MOCK_WORKFLOW_EXECUTIONS,
  MOCK_SERVICE_ORDERS,
  MOCK_ASSETS,
  MOCK_INVENTORY,
  MOCK_INVOICES,
} from "./mockData";
import { evaluateWorkflowCondition } from "@/features/tenant/automation/workflows/services/workflow-condition-evaluator";

interface DataContextType {
  organizations: Organization[];
  contacts: Contact[];
  deals: Deal[];
  pipelines: Pipeline[];
  workflows: Workflow[];
  campaigns: Campaign[];
  templates: Template[];
  roles: RoleDefinition[];
  permissions: Permission[];
  users: User[];
  tenants: Tenant[];
  tasks: Task[];
  workflowExecutions: WorkflowExecution[];
  workflowExecutionRuns: WorkflowExecutionRun[];
  workflowExecutionSteps: WorkflowExecutionStep[];
  activities: Activity[];
  addActivity: (activity: Omit<Activity, 'id' | 'tenantId'>) => void;
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id' | 'tenantId' | 'createdAt'>) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  removeInvoice: (id: string) => void;
  pendingActions: PendingAction[];
  serviceOrders: ServiceOrder[];
  assets: Asset[];
  inventoryItems: InventoryItem[];
  auditLogs: AuditLog[];
  addContact: (
    contact: Omit<Contact, "id" | "tenantId" | "createdAt" | "score">,
  ) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  addOrganization: (
    org: Omit<Organization, "id" | "tenantId" | "createdAt">,
  ) => string | null;
  updateOrganization: (id: string, updates: Partial<Organization>) => void;
  deleteOrganization: (id: string) => void;
  addDeal: (deal: Omit<Deal, "id" | "tenantId" | "createdAt">) => void;
  updateDeal: (id: string, updates: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  addPipeline: (pipeline: Omit<Pipeline, "id" | "tenantId">) => void;
  updatePipeline: (id: string, updates: Partial<Pipeline>) => void;
  deletePipeline: (id: string) => void;
  addTask: (task: Omit<Task, "id" | "tenantId" | "createdAt">) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateServiceOrder: (id: string, updates: Partial<ServiceOrder>) => void;
  addWorkflow: (
    workflow: Omit<Workflow, "id" | "tenantId" | "executionCount">,
  ) => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;
  addCampaign: (
    campaign: Omit<
      Campaign,
      | "id"
      | "tenantId"
      | "createdAt"
      | "sentCount"
      | "openedCount"
      | "clickedCount"
      | "engagement"
    >,
  ) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
  addTemplate: (
    template: Omit<Template, "id" | "tenantId" | "createdAt">,
  ) => void;
  updateTemplate: (id: string, updates: Partial<Template>) => void;
  deleteTemplate: (id: string) => void;
  reorderDeals: (reorderedDeals: Deal[]) => void;
  addRole: (
    role: Omit<RoleDefinition, "id" | "tenantId" | "updatedAt">,
  ) => void;
  updateRole: (id: string, updates: Partial<RoleDefinition>) => void;
  deleteRole: (id: string) => void;
  addUser: (userData: any) => void;
  updateUser: (id: string, updates: Partial<any>) => void;
  deleteUser: (id: string) => void;
  restoreRecord: (
    type:
      | "Organization"
      | "Contact"
      | "Deal"
      | "Pipeline"
      | "Workflow"
      | "Campaign"
      | "Template"
      | "Role"
      | "User",
    id: string,
  ) => void;
  resetDemoData: () => void;
  approveTenant: (id: string) => void;
  rejectTenant: (id: string) => void;
  suspendTenant: (id: string) => void;
  updateTenant: (id: string, updates: Partial<Tenant>) => void;
  addAuditLog: (action: string, details: string) => void;
  isServiceModuleEnabled: boolean;
  toggleServiceModule: () => void;
  isAssetModuleEnabled: boolean;
  toggleAssetModule: () => void;
  isBillingModuleEnabled: boolean;
  toggleBillingModule: () => void;
}

const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: "log_seed_1",
    userId: "user_client_admin",
    userEmail: "admin@democorp.com",
    action: "Auth Login",
    details:
      "User authenticated successfully via active MFA token from Chrome browser agent.",
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    ipAddress: "192.168.1.15",
    tenantId: "tenant_demo",
  },
  {
    id: "log_seed_2",
    userId: "user_sales_1",
    userEmail: "bob@democorp.com",
    action: "Contact Created",
    details:
      "Added a new contact profile for company 'Starlight Ventures' (Contact name: Chloe Starlight) with status 'New'.",
    timestamp: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    ipAddress: "192.168.1.27",
    tenantId: "tenant_demo",
  },
  {
    id: "log_seed_3",
    userId: "user_sales_1",
    userEmail: "bob@democorp.com",
    action: "Deal Updated",
    details:
      "Updated pipeline stage from 'Prospecting' to 'Proposal Sent' for active commercial deal 'Enterprise SaaS Expansion'.",
    timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    ipAddress: "192.168.1.27",
    tenantId: "tenant_demo",
  },
  {
    id: "log_seed_4",
    userId: "user_client_admin",
    userEmail: "admin@democorp.com",
    action: "Role Updated",
    details:
      "Updated access definitions and user authorization parameters for role: 'Sales Rep'.",
    timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    ipAddress: "192.168.1.15",
    tenantId: "tenant_demo",
  },
  {
    id: "log_seed_5",
    userId: "system",
    userEmail: "system@leadcrm.com",
    action: "Workflow Automation",
    details:
      "Triggered business workflow automation rule 'New Contact Auto-responder' for context 'Starlight Ventures'.",
    timestamp: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    ipAddress: "127.0.0.1",
    tenantId: "tenant_demo",
  },
  {
    id: "log_seed_6",
    userId: "user_client_admin",
    userEmail: "admin@democorp.com",
    action: "Auth MFA Update",
    details:
      "Enabled mandatory Multi-Factor Authentication (MFA) challenge for administrative workspace safety verification.",
    timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    ipAddress: "192.168.1.15",
    tenantId: "tenant_demo",
  },
  {
    id: "log_seed_7",
    userId: "user_super",
    userEmail: "super@leadcrm.com",
    action: "System Health Check",
    details:
      "Tenant directory automated resource allocation quota & memory utilization status verified successfully.",
    timestamp: new Date(Date.now() - 60 * 3600 * 1000).toISOString(),
    ipAddress: "10.0.0.2",
    tenantId: "system",
  },
];

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, tenant } = useAuth();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workflowExecutions, setWorkflowExecutions] = useState<WorkflowExecution[]>([]);
  const [workflowExecutionRuns, setWorkflowExecutionRuns] = useState<WorkflowExecutionRun[]>([]);
  const [workflowExecutionSteps, setWorkflowExecutionSteps] = useState<WorkflowExecutionStep[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isServiceModuleEnabled, setIsServiceModuleEnabled] =
    useState<boolean>(false);
  const [isAssetModuleEnabled, setIsAssetModuleEnabled] =
    useState<boolean>(false);
  const [isBillingModuleEnabled, setIsBillingModuleEnabled] =
    useState<boolean>(false);

  const loadData = () => {
    let orgs = JSON.parse(
      localStorage.getItem("leadcrm_organizations") || "null",
    );
    let l = JSON.parse(
      localStorage.getItem("leadcrm_leads") || JSON.stringify(MOCK_LEADS),
    );

    // Force refresh leads to apply new fields only once
    if (!localStorage.getItem("leadcrm_migrated_v3")) {
      l = MOCK_LEADS;
      localStorage.setItem("leadcrm_leads", JSON.stringify(l));
      orgs = null;
      localStorage.removeItem("leadcrm_organizations");
      localStorage.setItem("leadcrm_migrated_v3", "true");
    }

    // MIGRATION: Auto-extract Organizations from Leads if not done yet
    if (!orgs && l && l.length > 0) {
      orgs = [];
      const orgMap: Record<string, string> = {}; // Name to ID

      l.forEach((lead: any) => {
        if (lead.customerType === "Organization" && lead.companyName) {
          if (!orgMap[lead.companyName]) {
            const orgId =
              "org_" + Date.now() + Math.random().toString(36).substr(2, 9);
            orgMap[lead.companyName] = orgId;
            orgs.push({
              id: orgId,
              tenantId: lead.tenantId,
              name: lead.companyName,
              industry: lead.businessType || lead.industry || "",
              size: lead.companySize || "",
              website: lead.orgWebsite || "",
              taxId: lead.taxId || "",
              assignedUserId: lead.assignedUserId || "",
              createdAt: lead.createdAt || new Date().toISOString(),
            });
          }
          lead.organizationId = orgMap[lead.companyName];
          lead.customerType = undefined; // Deprecating
        }
      });
      localStorage.setItem("leadcrm_organizations", JSON.stringify(orgs));
      localStorage.setItem("leadcrm_leads", JSON.stringify(l)); // save updated leads back
    } else if (!orgs) {
      orgs = [];
    }

    const d = JSON.parse(
      localStorage.getItem("leadcrm_deals") || JSON.stringify(MOCK_DEALS),
    ).map((deal: any) => {
      // Migration: backfill contactIds from legacy contactId
      if (!deal.contactIds && deal.contactId) {
        return { ...deal, contactIds: [deal.contactId] };
      }
      if (!deal.contactIds) {
        return { ...deal, contactIds: [] };
      }
      return deal;
    });

    const p = JSON.parse(
      localStorage.getItem("leadcrm_pipelines") ||
        JSON.stringify(MOCK_PIPELINES),
    );
    const w = JSON.parse(
      localStorage.getItem("leadcrm_workflows") ||
        JSON.stringify(MOCK_WORKFLOWS),
    );
    const c = JSON.parse(
      localStorage.getItem("leadcrm_campaigns") ||
        JSON.stringify(MOCK_CAMPAIGNS),
    );
    const tpl = JSON.parse(
      localStorage.getItem("leadcrm_templates") ||
        JSON.stringify(MOCK_TEMPLATES),
    );
    const r = JSON.parse(
      localStorage.getItem("leadcrm_roles") || JSON.stringify(MOCK_ROLES),
    );
    const perm = JSON.parse(
      localStorage.getItem("leadcrm_permissions") ||
        JSON.stringify(MOCK_PERMISSIONS),
    );
    const u = JSON.parse(
      localStorage.getItem("leadcrm_users") || JSON.stringify(MOCK_USERS),
    );
    const t = JSON.parse(
      localStorage.getItem("leadcrm_tenants") || JSON.stringify(MOCK_TENANTS),
    ).map((tenant: Tenant) => {
      if (tenant.environment !== "none" && !tenant.healthMetrics) {
        const cpuUsage = Math.floor(Math.random() * 90) + 5;
        const memoryUsage = Math.floor(Math.random() * 90) + 10;
        const storageUsage = Math.floor(Math.random() * 80) + 20;
        let status: "healthy" | "warning" | "critical" = "healthy";

        if (cpuUsage > 90 || memoryUsage > 90 || storageUsage > 90) {
          status = "critical";
        } else if (cpuUsage > 70 || memoryUsage > 70 || storageUsage > 70) {
          status = "warning";
        }

        return {
          ...tenant,
          healthMetrics: {
            cpuUsage,
            memoryUsage,
            storageUsage,
            uptime: (99 + Math.random()).toFixed(1) + "%",
            status,
            lastCheck: new Date().toISOString(),
          },
        };
      }
      return tenant;
    });
    const tsk = JSON.parse(
      localStorage.getItem("leadcrm_tasks") || JSON.stringify(MOCK_TASKS || []),
    );
    const execs = JSON.parse(
      localStorage.getItem("leadcrm_workflow_executions") ||
        JSON.stringify(MOCK_WORKFLOW_EXECUTIONS || []),
    );
    const pending = JSON.parse(
      localStorage.getItem("leadcrm_pending_actions") || "[]",
    );
    const so = JSON.parse(
      localStorage.getItem("leadcrm_service_orders") ||
        JSON.stringify(MOCK_SERVICE_ORDERS || []),
    );
    const ast = JSON.parse(
      localStorage.getItem("leadcrm_assets") ||
        JSON.stringify(MOCK_ASSETS || []),
    );
    const inv = JSON.parse(
      localStorage.getItem("leadcrm_inventory") ||
        JSON.stringify(MOCK_INVENTORY || []),
    );
    const logs = JSON.parse(
      localStorage.getItem("leadcrm_audit_logs") ||
        JSON.stringify(MOCK_AUDIT_LOGS),
    );
    if (!localStorage.getItem("leadcrm_audit_logs")) {
      localStorage.setItem(
        "leadcrm_audit_logs",
        JSON.stringify(MOCK_AUDIT_LOGS),
      );
    }
    const serviceEnabled = JSON.parse(
      localStorage.getItem("leadcrm_service_enabled") || "false",
    );
    const assetEnabled = JSON.parse(
      localStorage.getItem("leadcrm_asset_enabled") || "false",
    );
    const billingEnabled = JSON.parse(
      localStorage.getItem("leadcrm_billing_enabled") || "false",
    );

    const activityData = JSON.parse(
      localStorage.getItem("leadcrm_activities") || "[]",
    );
    const execRuns = JSON.parse(
      localStorage.getItem("leadcrm_workflow_execution_runs") || "[]",
    );
    const execSteps = JSON.parse(
      localStorage.getItem("leadcrm_workflow_execution_steps") || "[]",
    );
    const invoiceData = JSON.parse(
      localStorage.getItem("leadcrm_invoices") || JSON.stringify(MOCK_INVOICES),
    );

    setIsServiceModuleEnabled(serviceEnabled);
    setIsAssetModuleEnabled(assetEnabled);
    setIsBillingModuleEnabled(billingEnabled);

    if (user?.role === "System Admin") {
      setAuditLogs(logs);
      setOrganizations(orgs);
      setContacts(l);
      setDeals(d);
      setPipelines(p);
      setWorkflows(w);
      setCampaigns(c);
      setTemplates(tpl);
      setRoles(r);
      setPermissions(perm);
      setUsers(u);
      setTenants(t);
      setTasks(tsk);
      setWorkflowExecutions(execs);
      setServiceOrders(so);
      setAssets(ast);
      setInventoryItems(inv);
      setActivities(activityData);
      setWorkflowExecutionRuns(execRuns);
      setWorkflowExecutionSteps(execSteps);
      setInvoices(invoiceData);
    } else if (tenant) {
      setAuditLogs(
        logs.filter((log: any) => !log.tenantId || log.tenantId === tenant.id),
      );
      const userRoleDef =
        r.find(
          (role: any) =>
            role.name === user?.role && role.tenantId === tenant.id,
        ) || r.find((role: any) => role.name === user?.role);
      const userPerms = userRoleDef?.permissions || [];

      const canViewAllLeads = userPerms.includes("p2");
      const canViewOwnLeads = userPerms.includes("p2_own");
      const canViewAllDeals = userPerms.includes("p7");
      const canViewOwnDeals = userPerms.includes("p7_own");

      let filteredLeads = l.filter((x: any) => x.tenantId === tenant.id);
      if (!canViewAllLeads && canViewOwnLeads) {
        filteredLeads = filteredLeads.filter(
          (x: any) => x.assignedUserId === user?.id,
        );
      } else if (
        !canViewAllLeads &&
        !canViewOwnLeads &&
        user?.role !== "Client Admin"
      ) {
        filteredLeads = [];
      }

      let filteredDeals = d.filter((x: any) => x.tenantId === tenant.id);
      if (!canViewAllDeals && canViewOwnDeals) {
        filteredDeals = filteredDeals.filter(
          (x: any) => x.assignedUserId === user?.id,
        );
      } else if (
        !canViewAllDeals &&
        !canViewOwnDeals &&
        user?.role !== "Client Admin"
      ) {
        filteredDeals = [];
      }

      setContacts(filteredLeads);
      setDeals(filteredDeals);
      setPipelines(p.filter((x: any) => x.tenantId === tenant.id));
      setWorkflows(w.filter((x: any) => x.tenantId === tenant.id));
      setCampaigns(c.filter((x: any) => x.tenantId === tenant.id));
      setTemplates(tpl.filter((x: any) => x.tenantId === tenant.id));
      setRoles(r.filter((x: any) => x.tenantId === tenant.id));
      setPermissions(perm);
      setUsers(u.filter((x: any) => x.tenantId === tenant.id));
      setTenants(t.filter((x: any) => x.id === tenant.id));
      setTasks(tsk.filter((x: any) => x.tenantId === tenant.id));
      setWorkflowExecutions(execs.filter((x: any) => x.tenantId === tenant.id));
      setPendingActions(pending.filter((x: any) => x.tenantId === tenant.id));
      setServiceOrders(so.filter((x: any) => x.tenantId === tenant.id));
      setAssets(ast.filter((x: any) => x.tenantId === tenant.id));
      setInventoryItems(inv.filter((x: any) => x.tenantId === tenant.id));
      setActivities(activityData.filter((x: any) => x.tenantId === tenant.id));
      setWorkflowExecutionRuns(execRuns.filter((x: any) => x.tenantId === tenant.id));
      setWorkflowExecutionSteps(execSteps.filter((x: any) => x.tenantId === tenant.id));
      setInvoices(invoiceData.filter((x: any) => x.tenantId === tenant.id && !x.isArchived));
    }
  };

  useEffect(() => {
    loadData();
  }, [user, tenant]);

  // Delegates to extracted pure service: src/modules/workflows/services/workflowConditionEvaluator.ts
  const evaluateWorkflowConditionDirectly = (
    wf: Workflow,
    context: { contact?: Contact; deal?: Deal },
  ) => evaluateWorkflowCondition(wf, context, deals, contacts);

    // Run actions for a single matched workflow
  const runSingleWorkflow = (
    wf: Workflow,
    context: { contact?: Contact; deal?: Deal },
    trigger: string,
  ) => {
    if (!tenant) return;

    // ── Phase 3: Create WorkflowExecutionRun record ────────────────────────
    const entityId = context.deal?.id || context.contact?.id || '';
    const entityType = context.deal ? 'deal' : 'contact';
    const runId = 'wfrun_' + Date.now() + Math.random().toString(36).slice(2, 7);

    const newRun: WorkflowExecutionRun = {
      id: runId,
      tenantId: tenant.id,
      workflowId: wf.id,
      workflowName: wf.name,
      triggerId: trigger,
      entityType,
      entityId,
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    // Persist the run record
    setWorkflowExecutionRuns(prev => {
      const updated = [newRun, ...prev].slice(0, 200);
      const all = JSON.parse(localStorage.getItem('leadcrm_workflow_execution_runs') || '[]');
      const merged = all.filter((x: any) => x.tenantId !== tenant.id).concat(updated);
      localStorage.setItem('leadcrm_workflow_execution_runs', JSON.stringify(merged));
      return updated;
    });

    // ── Create Activity entry for timeline ────────────────────────────────
    if (entityId) {
      addActivity({
        type: 'workflow',
        relatedToType: entityType as 'contact' | 'deal',
        relatedToId: entityId,
        title: `Workflow "${wf.name}" triggered`,
        description: `Trigger: ${trigger}`,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        metadata: { workflowId: wf.id, runId },
      });
    }
    // ──────────────────────────────────────────────────────────────────────

    const actionsToRun = wf.actions || [
      {
        id: "legacy_action",
        type: wf.action || "send_email",
        delay: wf.delay || 0,
        delayUnit: wf.delayUnit || "minutes",
        config: wf.actionConfig,
      },
    ];

    actionsToRun.forEach((action: any, stepIndex: number) => {
      if (action.delay && action.delay > 0) {
        // Schedule for later
        const executeAt = new Date();
        if (action.delayUnit === "minutes")
          executeAt.setMinutes(executeAt.getMinutes() + action.delay);
        else if (action.delayUnit === "hours")
          executeAt.setHours(executeAt.getHours() + action.delay);
        else if (action.delayUnit === "days")
          executeAt.setDate(executeAt.getDate() + action.delay);

        const newPending: PendingAction = {
          id: "pa_" + Date.now() + Math.random(),
          workflowId: wf.id,
          tenantId: tenant.id,
          executeAt: executeAt.toISOString(),
          trigger: trigger,
          context: context,
          actionId: action.id,
        };

        setPendingActions((prev) => {
          const updated = [...prev, newPending];
          const allData = JSON.parse(
            localStorage.getItem("leadcrm_pending_actions") || "[]",
          );
          let newData = allData
            .filter((x: any) => x.tenantId !== tenant.id)
            .concat(updated);
          localStorage.setItem(
            "leadcrm_pending_actions",
            JSON.stringify(newData),
          );
          return updated;
        });

        // Record step as 'skipped' (scheduled for later)
        const step: WorkflowExecutionStep = {
          id: 'wfstep_' + Date.now() + Math.random().toString(36).slice(2, 7),
          executionId: runId,
          tenantId: tenant.id,
          stepIndex,
          actionType: action.type,
          status: 'skipped',
          output: { scheduledFor: executeAt.toISOString() },
          executedAt: new Date().toISOString(),
        };
        setWorkflowExecutionSteps(prev => {
          const updated = [step, ...prev].slice(0, 500);
          const all = JSON.parse(localStorage.getItem('leadcrm_workflow_execution_steps') || '[]');
          const merged = all.filter((x: any) => x.tenantId !== tenant.id).concat(updated);
          localStorage.setItem('leadcrm_workflow_execution_steps', JSON.stringify(merged));
          return updated;
        });

        // Legacy execution log
        const newExec: WorkflowExecution = {
          id: "exec_" + Date.now() + Math.random(),
          workflowId: wf.id,
          tenantId: tenant.id,
          timestamp: new Date().toISOString(),
          status: "success",
          details: `Scheduled action '${action.type}' for ${executeAt.toLocaleString()}`,
          relatedEntityId: entityId,
        };
        setWorkflowExecutions((prev) => {
          const updated = [newExec, ...prev].slice(0, 100);
          const allData = JSON.parse(localStorage.getItem("leadcrm_workflow_executions") || "[]");
          const newData = allData.filter((x: any) => x.tenantId !== tenant.id).concat(updated);
          localStorage.setItem("leadcrm_workflow_executions", JSON.stringify(newData));
          return updated;
        });
      } else {
        // Execute immediately — pass runId and stepIndex for step tracking
        executeWorkflowAction(wf, action, context, runId, stepIndex);
      }
    });

    // Mark run as completed
    setWorkflowExecutionRuns(prev =>
      prev.map(r => r.id === runId ? { ...r, status: 'completed', completedAt: new Date().toISOString() } : r),
    );
  };

  // Evaluate time-based triggers periodically
  const evaluateTimeBasedWorkflows = () => {
    if (!tenant) return;

    const timeBasedWorkflows = workflows.filter(
      (wf) =>
        wf.status === "active" &&
        (wf.trigger === "deal_expected_close_date_approaching" ||
          wf.trigger === "lead_expected_close_date_approaching"),
    );

    if (timeBasedWorkflows.length === 0) return;

    timeBasedWorkflows.forEach((wf) => {
      if (wf.trigger === "deal_expected_close_date_approaching") {
        deals.forEach((deal) => {
          const key = `wf_exec_${wf.id}_deal_${deal.id}`;
          if (localStorage.getItem(key) === "true") return;

          const alreadyRun = workflowExecutions.some(
            (exec) =>
              exec.workflowId === wf.id && exec.relatedEntityId === deal.id,
          );
          if (alreadyRun) {
            localStorage.setItem(key, "true");
            return;
          }

          let conditionMet = true;
          if (wf.condition) {
            conditionMet = evaluateWorkflowConditionDirectly(wf, { deal });
          }

          if (conditionMet) {
            localStorage.setItem(key, "true");
            runSingleWorkflow(wf, { deal }, wf.trigger);
          }
        });
      } else if (wf.trigger === "lead_expected_close_date_approaching") {
        contacts.forEach((contact) => {
          const key = `wf_exec_${wf.id}_lead_${contact.id}`;
          if (localStorage.getItem(key) === "true") return;

          const alreadyRun = workflowExecutions.some(
            (exec) =>
              exec.workflowId === wf.id && exec.relatedEntityId === contact.id,
          );
          if (alreadyRun) {
            localStorage.setItem(key, "true");
            return;
          }

          let conditionMet = true;
          if (wf.condition) {
            conditionMet = evaluateWorkflowConditionDirectly(wf, { contact });
          }

          if (conditionMet) {
            localStorage.setItem(key, "true");
            runSingleWorkflow(wf, { contact }, wf.trigger);
          }
        });
      }
    });
  };

  // Process pending actions and time-based workflows
  useEffect(() => {
    evaluateTimeBasedWorkflows();

    const interval = setInterval(() => {
      const now = new Date();
      const toExecute = pendingActions.filter(
        (pa) => new Date(pa.executeAt) <= now,
      );

      if (toExecute.length > 0) {
        toExecute.forEach((pa) => {
          const wf = workflows.find((w) => w.id === pa.workflowId);
          if (wf) {
            const action = wf.actions?.find(
              (a) => a.id === (pa as any).actionId,
            ) || {
              id: "legacy_action",
              type: wf.action || "send_email",
              config: wf.actionConfig,
            };
            executeWorkflowAction(wf, action, pa.context, undefined, 0);
          }
        });

        const remaining = pendingActions.filter(
          (pa) => new Date(pa.executeAt) > now,
        );
        saveAndSet("leadcrm_pending_actions", remaining, setPendingActions);
      }

      evaluateTimeBasedWorkflows();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [pendingActions, workflows, deals, contacts]);

  const saveAndSet = (key: string, data: any[], setter: any) => {
    const allData = JSON.parse(localStorage.getItem(key) || "[]");
    // Update the global list
    let newData = [...allData];
    if (tenant) {
      newData = newData
        .filter((x: any) => x.tenantId !== tenant.id)
        .concat(data);
    } else {
      newData = data;
    }
    localStorage.setItem(key, JSON.stringify(newData));
    setter(data);
  };

  const calculateScore = (status: string) => {
    if (status === "Hot") return 95;
    if (status === "Warm") return 75;
    if (status === "Cold") return 40;
    return 0;
  };

  const runWorkflows = (
    trigger: string,
    context: { contact?: Contact; deal?: Deal },
  ) => {
    if (!tenant) return;

    const activeWorkflows = workflows.filter(
      (wf) => wf.status === "active" && wf.trigger === trigger,
    );

    activeWorkflows.forEach((wf) => {
      // Check condition
      let conditionMet = true;
      if (wf.condition) {
        conditionMet = evaluateWorkflowConditionDirectly(wf, context);
      }

      if (conditionMet) {
        runSingleWorkflow(wf, context, trigger);
      }
    });
  };

  const executeWorkflowAction = (
    wf: Workflow,
    action: any,
    context: { contact?: Contact; deal?: Deal },
    runId?: string,
    stepIndex?: number,
  ) => {
    if (!tenant) return;

    const replaceMergeTags = (text: string) => {
      if (!text) return text;
      return text
        .replace(/\[Deal Name\]/g, context.deal?.title || "")
        .replace(/\[Contact Name\]/g, context.contact?.companyName || "")
        .replace(
          /\[Contact Person\]/g,
          context.deal?.contactPerson || context.contact?.contactPerson || "",
        )
        .replace(
          /\[Company Name\]/g,
          context.deal?.companyName || context.contact?.companyName || "",
        )
        .replace(
          /\[Value\]/g,
          (context.deal?.value || context.contact?.estimatedValue || 0).toString(),
        )
        .replace(/\[Score\]/g, (context.contact?.score || 0).toString());
    };

    let executionDetails = "";
    let stepOutput: Record<string, unknown> = {};

    if (action.type === "create_task") {
      const taskTitle = replaceMergeTags(action.config?.taskTitle || `Workflow: ${wf.name}`);
      const taskDesc  = replaceMergeTags(action.config?.taskDescription || wf.description);
      addTask({
        dealId: context.deal?.id,
        title: taskTitle,
        description: taskDesc,
        status: "pending",
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
        assignedUserId:
          context.deal?.assignedUserId ||
          context.contact?.assignedUserId ||
          user?.id ||
          "system",
      });
      executionDetails = `Created task: ${taskTitle}`;
      stepOutput = { taskTitle };
    } else if (action.type === "send_email" || action.type === "send_sms") {
      const template = templates.find(t => t.id === action.config?.templateId);
      executionDetails = `Sent ${action.type === "send_email" ? "Email" : "SMS"} using template: ${template?.name || "Default"}`;
      stepOutput = { templateName: template?.name || "Default" };
    } else {
      executionDetails = `Executed action: ${action.type}`;
      stepOutput = { actionType: action.type };
    }

    // ── WorkflowExecutionStep record ──────────────────────────────────────
    if (runId !== undefined && stepIndex !== undefined) {
      const step: WorkflowExecutionStep = {
        id: 'wfstep_' + Date.now() + Math.random().toString(36).slice(2, 7),
        executionId: runId,
        tenantId: tenant.id,
        stepIndex,
        actionType: action.type,
        status: 'success',
        output: stepOutput,
        executedAt: new Date().toISOString(),
      };
      setWorkflowExecutionSteps(prev => {
        const updated = [step, ...prev].slice(0, 500);
        const all = JSON.parse(localStorage.getItem('leadcrm_workflow_execution_steps') || '[]');
        const merged = all.filter((x: any) => x.tenantId !== tenant.id).concat(updated);
        localStorage.setItem('leadcrm_workflow_execution_steps', JSON.stringify(merged));
        return updated;
      });
    }
    // ─────────────────────────────────────────────────────────────────────

    // Legacy execution log (keep for backward compat)
    const newExec: WorkflowExecution = {
      id: "exec_" + Date.now() + Math.random(),
      workflowId: wf.id,
      tenantId: tenant.id,
      timestamp: new Date().toISOString(),
      status: "success",
      details: executionDetails,
      relatedEntityId: context.deal?.id || context.contact?.id,
    };
    const newExecs = [newExec, ...workflowExecutions].slice(0, 100);
    saveAndSet("leadcrm_workflow_executions", newExecs, setWorkflowExecutions);

    const newWorkflows = workflows.map(w =>
      w.id === wf.id ? { ...w, executionCount: w.executionCount + 1 } : w,
    );
    saveAndSet("leadcrm_workflows", newWorkflows, setWorkflows);
  };

  const addOrganization = (orgData: any) => {
    if (!tenant) return null;
    const newOrg = {
      ...orgData,
      id: "org_" + Date.now(),
      tenantId: tenant.id,
      createdAt: new Date().toISOString(),
    };
    const newOrgs = [...organizations, newOrg];
    saveAndSet("leadcrm_organizations", newOrgs, setOrganizations);
    addAuditLog(
      "Created Organization",
      `Organization "${newOrg.name}" was added.`,
    );
    return newOrg.id;
  };

  const updateOrganization = (id: string, updates: any) => {
    const updated = organizations.map((o) =>
      o.id === id ? { ...o, ...updates } : o,
    );
    saveAndSet("leadcrm_organizations", updated, setOrganizations);
    const org = organizations.find((o) => o.id === id);
    if (org) {
      addAuditLog(
        "Updated Organization",
        `Organization "${org.name}" was updated.`,
      );
    }
  };

  const deleteOrganization = (id: string) => {
    const original = organizations.find((o) => o.id === id);
    const arr = organizations.map((o) =>
      o.id === id ? { ...o, isArchived: true } : o,
    );
    saveAndSet("leadcrm_organizations", arr, setOrganizations);
    if (original) {
      addAuditLog(
        "Organization Archived",
        `Archived corporate client profile '${original.name}'.`,
      );
    }
  };

  const addContact = (leadData: any) => {
    if (!tenant) return;
    const newLead: Contact = {
      ...leadData,
      id: "lead_" + Date.now(),
      tenantId: tenant.id,
      score: calculateScore(leadData.status),
      createdAt: new Date().toISOString(),
    };
    const newLeads = [...contacts, newLead];
    saveAndSet("leadcrm_leads", newLeads, setContacts);
    addAuditLog(
      "Contact Created",
      `Added a new contact profile for company '${newLead.companyName}' (Contact: ${newLead.contactPerson}) with status '${newLead.status}'.`,
      newLead.id,
    );
    runWorkflows("lead_created", { contact: newLead });
  };

  const updateContact = (id: string, updates: Partial<Contact>) => {
    const original = contacts.find((l) => l.id === id);
    const newLeads = contacts.map((l) => {
      if (l.id === id) {
        const updated = { ...l, ...updates };
        if (updates.status) updated.score = calculateScore(updates.status);
        return updated;
      }
      return l;
    });
    saveAndSet("leadcrm_leads", newLeads, setContacts);
    if (original) {
      const changes: string[] = [];
      const changeset: Record<string, { old: any; new: any }> = {};

      Object.keys(updates).forEach((k) => {
        const key = k as keyof Contact;
        if (updates[key] !== undefined && updates[key] !== original[key]) {
          changeset[key] = {
            old: original[key] === undefined ? null : original[key],
            new: updates[key],
          };
        }
      });

      if (updates.status && updates.status !== original.status) {
        changes.push(`status to '${updates.status}'`);
      }
      if (updates.companyName && updates.companyName !== original.companyName) {
        changes.push(`company name to '${updates.companyName}'`);
      }
      if (
        updates.estimatedValue &&
        updates.estimatedValue !== original.estimatedValue
      ) {
        changes.push(`value to â‚±${updates.estimatedValue}`);
      }
      if (
        updates.assignedUserId &&
        updates.assignedUserId !== original.assignedUserId
      ) {
        const assignedUser = users.find((u) => u.id === updates.assignedUserId);
        changes.push(
          `assigned user to '${assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : updates.assignedUserId}'`,
        );
      }
      const details =
        changes.length > 0
          ? `Updated ${changes.join(", ")} for contact '${original.companyName}'.`
          : `Modified contact profile details for '${original.companyName}'.`;
      addAuditLog("Contact Updated", details, id, changeset);
    }
  };

  const deleteContact = (id: string) => {
    const original = contacts.find((l) => l.id === id);
    const newLeads = contacts.map((l) =>
      l.id === id ? { ...l, isArchived: true } : l,
    );
    saveAndSet("leadcrm_leads", newLeads, setContacts);
    if (original) {
      addAuditLog(
        "Contact Archived",
        `Archived contact profile belonging to company '${original.companyName}'.`,
      );
    }
  };

  const addDeal = (dealData: any) => {
    if (!tenant) return;
    // Normalise: always maintain contactIds array, backfill from legacy contactId
    const contactIds: string[] = dealData.contactIds
      ? dealData.contactIds
      : dealData.contactId
        ? [dealData.contactId]
        : [];

    const newDeal: Deal = {
      ...dealData,
      id: "deal_" + Date.now(),
      tenantId: tenant.id,
      contactIds,
      lastStageChangeDate: new Date().toISOString(),
      order: deals.filter(
        (d) =>
          d.pipelineId === dealData.pipelineId &&
          d.stageId === dealData.stageId,
      ).length,
      createdAt: new Date().toISOString(),
      history: [
        {
          stageId: dealData.stageId,
          timestamp: new Date().toISOString(),
          userId: user?.id || "system",
          note: "Deal created",
        },
      ],
      ownershipHistory: dealData.assignedUserId
        ? [{ assignedTo: dealData.assignedUserId, assignedBy: user?.id || 'system', assignedAt: new Date().toISOString() }]
        : [],
    };
    const newDeals = [...deals, newDeal];
    saveAndSet("leadcrm_deals", newDeals, setDeals);
    addAuditLog(
      "Deal Created",
      `Added a new deal '${newDeal.title}' (₱${newDeal.value.toLocaleString()}) for client '${newDeal.companyName}'.`,
      newDeal.id,
    );
    addActivity({
      type: 'deal-created',
      relatedToType: 'deal',
      relatedToId: newDeal.id,
      title: `Deal created: ${newDeal.title}`,
      createdBy: user?.id || 'system',
      createdAt: new Date().toISOString(),
    });
    runWorkflows("deal_created", { deal: newDeal });
  };

  const updateDeal = (id: string, updates: Partial<Deal>) => {
    const original = deals.find((d) => d.id === id);
    const newDeals = deals.map((d) => {
      if (d.id === id) {
        const updated = { ...d, ...updates };

        // Track stage change
        if (updates.stageId && updates.stageId !== d.stageId) {
          updated.lastStageChangeDate = new Date().toISOString();
          const historyEntry = {
            stageId: updates.stageId,
            previousStageId: d.stageId,
            timestamp: new Date().toISOString(),
            userId: user?.id || "system",
            note: updates.lostReason
              ? `Stage changed to Closed Lost: ${updates.lostReason}`
              : undefined,
          };
          updated.history = [...(d.history || []), historyEntry];

          // Fire stage-change Activity
          addActivity({
            type: 'stage-change',
            relatedToType: 'deal',
            relatedToId: d.id,
            title: `Deal moved to new stage`,
            createdBy: user?.id || 'system',
            createdAt: new Date().toISOString(),
            metadata: { previousStageId: d.stageId, newStageId: updates.stageId },
          });

          const stageSuffix = updates.stageId.includes("stage_")
            ? updates.stageId.replace("stage_", "")
            : updates.stageId;
          runWorkflows(`deal_stage_${stageSuffix}`, { deal: updated });
        }

        // Track owner change — append DealOwnershipRecord
        if (updates.assignedUserId && updates.assignedUserId !== d.assignedUserId) {
          updated.ownershipHistory = [
            ...(d.ownershipHistory || []),
            {
              assignedTo: updates.assignedUserId,
              assignedBy: user?.id || 'system',
              assignedAt: new Date().toISOString(),
            },
          ];
        }

        return updated;
      }
      return d;
    });
    saveAndSet("leadcrm_deals", newDeals, setDeals);
    if (original) {
      const changes: string[] = [];
      const changeset: Record<string, { old: any; new: any }> = {};

      Object.keys(updates).forEach((k) => {
        const key = k as keyof Deal;
        if (updates[key] !== undefined && updates[key] !== original[key]) {
          changeset[key] = {
            old: original[key] === undefined ? null : original[key],
            new: updates[key],
          };
        }
      });

      if (updates.stageId && updates.stageId !== original.stageId) {
        const pLine = pipelines.find((p) => p.id === original.pipelineId);
        const oldName =
          pLine?.stages.find((s) => s.id === original.stageId)?.name ||
          original.stageId;
        const newName =
          pLine?.stages.find((s) => s.id === updates.stageId)?.name ||
          updates.stageId;
        changes.push(`pipeline stage from '${oldName}' to '${newName}'`);
      }
      if (updates.value && updates.value !== original.value) {
        changes.push(`revenue value to â‚±${updates.value.toLocaleString()}`);
      }
      if (updates.priority && updates.priority !== original.priority) {
        changes.push(`priority to '${updates.priority}'`);
      }
      if (
        updates.assignedUserId &&
        updates.assignedUserId !== original.assignedUserId
      ) {
        const assignedUser = users.find((u) => u.id === updates.assignedUserId);
        changes.push(
          `assigned representative to '${assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : updates.assignedUserId}'`,
        );
      }
      const details =
        changes.length > 0
          ? `Updated ${changes.join(", ")} for deal '${original.title}'.`
          : `Modified deal details for '${original.title}'.`;
      addAuditLog("Deal Updated", details, id, changeset);
    }
  };

  const deleteDeal = (id: string) => {
    const original = deals.find((d) => d.id === id);
    const newDeals = deals.map((d) =>
      d.id === id ? { ...d, isArchived: true } : d,
    );
    saveAndSet("leadcrm_deals", newDeals, setDeals);
    if (original) {
      addAuditLog(
        "Deal Archived",
        `Archived deal opportunity '${original.title}' valued at PHP ${original.value.toLocaleString()}.`,
      );
    }
  };

  const reorderDeals = (reorderedDeals: Deal[]) => {
    const reorderedIds = new Set(reorderedDeals.map((d) => d.id));
    const newDeals = deals.map((d) => {
      if (reorderedIds.has(d.id)) {
        return reorderedDeals.find((rd) => rd.id === d.id)!;
      }
      return d;
    });
    saveAndSet("leadcrm_deals", newDeals, setDeals);
  };

  const addPipeline = (pipelineData: Omit<Pipeline, "id" | "tenantId">) => {
    if (!tenant) return;
    const newPipeline: Pipeline = {
      ...pipelineData,
      id: `pipe_${Date.now()}`,
      tenantId: tenant.id,
    };
    const newPipelines = [...pipelines, newPipeline];
    saveAndSet("leadcrm_pipelines", newPipelines, setPipelines);
  };

  const updatePipeline = (id: string, updates: Partial<Pipeline>) => {
    const newPipelines = pipelines.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    saveAndSet("leadcrm_pipelines", newPipelines, setPipelines);
  };

  const deletePipeline = (id: string) => {
    const original = pipelines.find((p) => p.id === id);
    const newPipelines = pipelines.map((p) =>
      p.id === id ? { ...p, isArchived: true } : p,
    );
    saveAndSet("leadcrm_pipelines", newPipelines, setPipelines);
    if (original) {
      addAuditLog(
        "Pipeline Archived",
        `Archived sales pipeline configuration '${original.name}'.`,
      );
    }
  };

  const addTask = (taskData: any) => {
    if (!tenant) return;
    const now = new Date().toISOString();
    const newTask: Task = {
      ...taskData,
      id: "task_" + Date.now(),
      tenantId: tenant.id,
      createdAt: now,
      assignedBy: taskData.assignedBy || user?.id || 'system',
      assignmentHistory: [
        {
          assignedTo: taskData.assignedUserId || 'system',
          assignedBy: taskData.assignedBy || user?.id || 'system',
          assignedAt: now,
          reason: taskData.assignReason,
        },
      ],
    };
    const newTasks = [...tasks, newTask];
    saveAndSet("leadcrm_tasks", newTasks, setTasks);
    addAuditLog(
      "Task Created",
      `Created task '${newTask.title}' and assigned it to ${newTask.assignedUserId === "system" ? "System automation" : "user reps"}.`,
    );
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const original = tasks.find((t) => t.id === id);
    const newTasks = tasks.map((t) => {
      if (t.id !== id) return t;
      const updated = { ...t, ...updates };

      // Track assignment history when assignedUserId changes
      if (updates.assignedUserId && updates.assignedUserId !== t.assignedUserId) {
        const record: import('./types').TaskAssignmentRecord = {
          assignedTo: updates.assignedUserId,
          assignedBy: user?.id || 'system',
          assignedAt: new Date().toISOString(),
          previousAssignee: t.assignedUserId || undefined,
          reason: (updates as any).reassignReason,
        };
        updated.assignmentHistory = [...(t.assignmentHistory || []), record];
        updated.assignedBy = user?.id || 'system';
      }

      return updated;
    });
    saveAndSet("leadcrm_tasks", newTasks, setTasks);
    if (original) {
      const changes: string[] = [];
      if (updates.status && updates.status !== original.status) {
        changes.push(`status to '${updates.status}'`);
      }
      if (updates.title && updates.title !== original.title) {
        changes.push(`title to '${updates.title}'`);
      }
      if (updates.assignedUserId && updates.assignedUserId !== original.assignedUserId) {
        const assignedUser = users.find((u) => u.id === updates.assignedUserId);
        changes.push(
          `assigned to '${assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : updates.assignedUserId}'`,
        );
      }
      const details =
        changes.length > 0
          ? `Updated ${changes.join(", ")} for task '${original.title}'.`
          : `Modified task details for '${original.title}'.`;
      addAuditLog("Task Updated", details);
    }
  };

  const updateServiceOrder = (id: string, updates: Partial<ServiceOrder>) => {
    const original = serviceOrders.find((so) => so.id === id);
    const newOrders = serviceOrders.map((so) =>
      so.id === id ? { ...so, ...updates } : so,
    );
    saveAndSet("leadcrm_service_orders", newOrders, setServiceOrders);
    if (original) {
      addAuditLog(
        "Service Order Updated",
        `Service Order ID '${original.id}' status updated to '${updates.status || original.status}'.`,
      );
    }
  };

  const addWorkflow = (workflowData: any) => {
    if (!tenant) return;
    const newWorkflow: Workflow = {
      ...workflowData,
      id: "wf_" + Date.now(),
      tenantId: tenant.id,
      executionCount: 0,
      status: "active",
    };
    const newWorkflows = [...workflows, newWorkflow];
    saveAndSet("leadcrm_workflows", newWorkflows, setWorkflows);
    addAuditLog(
      "Workflow Created",
      `Added business workflow automation rule '${newWorkflow.name}' for trigger '${newWorkflow.trigger}'.`,
    );
  };

  const updateWorkflow = (id: string, updates: Partial<Workflow>) => {
    const original = workflows.find((w) => w.id === id);
    const newWorkflows = workflows.map((w) =>
      w.id === id ? { ...w, ...updates } : w,
    );
    saveAndSet("leadcrm_workflows", newWorkflows, setWorkflows);
    if (original) {
      addAuditLog(
        "Workflow Updated",
        `Updated workflow settings for automation rule '${original.name}'.`,
      );
    }
  };

  const deleteWorkflow = (id: string) => {
    const original = workflows.find((w) => w.id === id);
    const newWorkflows = workflows.map((w) =>
      w.id === id ? { ...w, isArchived: true } : w,
    );
    saveAndSet("leadcrm_workflows", newWorkflows, setWorkflows);
    if (original) {
      addAuditLog(
        "Workflow Archived",
        `Archived workflow automation rule '${original.name}'.`,
      );
    }
  };

  const addCampaign = (campaignData: any) => {
    if (!tenant) return;
    const newCampaign: Campaign = {
      ...campaignData,
      id: "camp_" + Date.now(),
      tenantId: tenant.id,
      createdAt: new Date().toLocaleDateString(),
      sentCount: 0,
      openedCount: 0,
      clickedCount: 0,
      engagement: 0,
    };
    const newCampaigns = [...campaigns, newCampaign];
    saveAndSet("leadcrm_campaigns", newCampaigns, setCampaigns);
    addAuditLog(
      "Campaign Created",
      `Created campaign schedule '${newCampaign.name}' with source template ID '${campaignData.templateId || "default"}'.`,
    );
  };

  const updateCampaign = (id: string, updates: Partial<Campaign>) => {
    const original = campaigns.find((c) => c.id === id);
    const newCampaigns = campaigns.map((c) =>
      c.id === id ? { ...c, ...updates } : c,
    );
    saveAndSet("leadcrm_campaigns", newCampaigns, setCampaigns);
    if (original) {
      addAuditLog(
        "Campaign Updated",
        `Updated campaign configurations for '${original.name}'.`,
      );
    }
  };

  const deleteCampaign = (id: string) => {
    const original = campaigns.find((c) => c.id === id);
    const newCampaigns = campaigns.map((c) =>
      c.id === id ? { ...c, isArchived: true } : c,
    );
    saveAndSet("leadcrm_campaigns", newCampaigns, setCampaigns);
    if (original) {
      addAuditLog(
        "Campaign Archived",
        `Archived marketing campaign '${original.name}'.`,
      );
    }
  };

  const addTemplate = (templateData: any) => {
    if (!tenant) return;
    const newTemplate: Template = {
      ...templateData,
      id: "tpl_" + Date.now(),
      tenantId: tenant.id,
      createdAt: new Date().toLocaleDateString(),
    };
    const newTemplates = [...templates, newTemplate];
    saveAndSet("leadcrm_templates", newTemplates, setTemplates);
  };

  const updateTemplate = (id: string, updates: Partial<Template>) => {
    const newTemplates = templates.map((t) =>
      t.id === id ? { ...t, ...updates } : t,
    );
    saveAndSet("leadcrm_templates", newTemplates, setTemplates);
  };

  const deleteTemplate = (id: string) => {
    const original = templates.find((t) => t.id === id);
    const newTemplates = templates.map((t) =>
      t.id === id ? { ...t, isArchived: true } : t,
    );
    saveAndSet("leadcrm_templates", newTemplates, setTemplates);
    if (original) {
      addAuditLog(
        "Template Archived",
        `Archived communication template '${original.name}'.`,
      );
    }
  };

  const addRole = (roleData: any) => {
    if (!tenant) return;
    const newRole: RoleDefinition = {
      ...roleData,
      id: "role_" + Date.now(),
      tenantId: tenant.id,
      updatedAt: new Date().toLocaleString(),
    };
    const newRoles = [...roles, newRole];
    saveAndSet("leadcrm_roles", newRoles, setRoles);
    addAuditLog(
      "Role Created",
      `Created custom user access level group description: '${newRole.name}'.`,
    );
  };

  const updateRole = (id: string, updates: Partial<RoleDefinition>) => {
    const original = roles.find((r) => r.id === id);
    const newRoles = roles.map((r) =>
      r.id === id
        ? { ...r, ...updates, updatedAt: new Date().toLocaleString() }
        : r,
    );
    saveAndSet("leadcrm_roles", newRoles, setRoles);
    if (original) {
      addAuditLog(
        "Role Updated",
        `Updated permissions or configuration for access level role: '${original.name}'.`,
      );
    }
  };

  const deleteRole = (id: string) => {
    const original = roles.find((r) => r.id === id);
    const newRoles = roles.map((r) =>
      r.id === id ? { ...r, isArchived: true } : r,
    );
    saveAndSet("leadcrm_roles", newRoles, setRoles);
    if (original) {
      addAuditLog(
        "Role Archived",
        `Archived custom user access level group: '${original.name}'.`,
      );
    }
  };

  const addUser = (userData: any) => {
    if (!tenant) return;
    const nameParts = (userData.name || "").trim().split(/\s+/);
    const firstName = userData.firstName || nameParts[0] || "New";
    const lastName =
      userData.lastName || nameParts.slice(1).join(" ") || "User";

    const newUser: User = {
      id:
        userData.id ||
        "usr_" + Date.now() + Math.random().toString(36).substr(2, 5),
      tenantId: tenant.id,
      firstName,
      lastName,
      email: userData.email || "",
      role: userData.role || "Sales Rep",
      status: userData.status || "Active",
      phone: userData.phone || "",
    };

    const allUsers = JSON.parse(
      localStorage.getItem("leadcrm_users") || JSON.stringify(MOCK_USERS),
    );
    const updatedUsers = [
      ...allUsers.filter((u: any) => u.id !== newUser.id),
      newUser,
    ];
    localStorage.setItem("leadcrm_users", JSON.stringify(updatedUsers));

    setUsers(updatedUsers.filter((u: any) => u.tenantId === tenant.id));
    addAuditLog(
      "User Registered",
      `Registered new team member: '${firstName} ${lastName}'.`,
    );
  };

  const updateUser = (id: string, updates: Partial<any>) => {
    const allUsers = JSON.parse(
      localStorage.getItem("leadcrm_users") || JSON.stringify(MOCK_USERS),
    );
    const original = allUsers.find((u: any) => u.id === id);
    if (!original) return;

    let firstName = updates.firstName || original.firstName;
    let lastName = updates.lastName || original.lastName;
    if (updates.name) {
      const nameParts = updates.name.trim().split(/\s+/);
      firstName = nameParts[0] || "";
      lastName = nameParts.slice(1).join(" ") || "";
    }

    const updatedUser = {
      ...original,
      ...updates,
      firstName,
      lastName,
    };

    const updatedUsers = allUsers.map((u: any) =>
      u.id === id ? updatedUser : u,
    );
    localStorage.setItem("leadcrm_users", JSON.stringify(updatedUsers));

    if (tenant) {
      setUsers(updatedUsers.filter((u: any) => u.tenantId === tenant.id));
    } else {
      setUsers(updatedUsers);
    }

    addAuditLog(
      "User Updated",
      `Updated profile/role details for team member: '${firstName} ${lastName}'.`,
    );

    const currentUser = JSON.parse(
      localStorage.getItem("leadcrm_user") || "null",
    );
    if (currentUser && currentUser.id === id) {
      localStorage.setItem("leadcrm_user", JSON.stringify(updatedUser));
    }
  };

  const deleteUser = (id: string) => {
    const allUsers = JSON.parse(
      localStorage.getItem("leadcrm_users") || JSON.stringify(MOCK_USERS),
    );
    const original = allUsers.find((u: any) => u.id === id);
    if (!original) return;

    const updatedUsers = allUsers.map((u: any) =>
      u.id === id ? { ...u, status: "Inactive", isArchived: true } : u,
    );
    localStorage.setItem("leadcrm_users", JSON.stringify(updatedUsers));

    if (tenant) {
      setUsers(updatedUsers.filter((u: any) => u.tenantId === tenant.id));
    } else {
      setUsers(updatedUsers);
    }

    addAuditLog(
      "User Archived",
      `Deactivated and archived team member account: '${original.firstName} ${original.lastName}'.`,
    );
  };

  const restoreRecord = (
    type:
      | "Organization"
      | "Contact"
      | "Deal"
      | "Pipeline"
      | "Workflow"
      | "Campaign"
      | "Template"
      | "Role"
      | "User",
    id: string,
  ) => {
    switch (type) {
      case "Organization":
        saveAndSet(
          "leadcrm_organizations",
          organizations.map((o) =>
            o.id === id ? { ...o, isArchived: false } : o,
          ),
          setOrganizations,
        );
        addAuditLog(
          "Organization Restored",
          `Restored corporate client profile (ID: ${id}).`,
        );
        break;
      case "Contact":
        saveAndSet(
          "leadcrm_leads",
          contacts.map((c) =>
            c.id === id ? { ...c, isArchived: false, status: "Cold" } : c,
          ),
          setContacts,
        );
        addAuditLog(
          "Contact Restored",
          `Restored contact profile (ID: ${id}).`,
        );
        break;
      case "Deal":
        saveAndSet(
          "leadcrm_deals",
          deals.map((d) => (d.id === id ? { ...d, isArchived: false } : d)),
          setDeals,
        );
        addAuditLog("Deal Restored", `Restored deal opportunity (ID: ${id}).`);
        break;
      case "Pipeline":
        saveAndSet(
          "leadcrm_pipelines",
          pipelines.map((p) => (p.id === id ? { ...p, isArchived: false } : p)),
          setPipelines,
        );
        addAuditLog(
          "Pipeline Restored",
          `Restored sales pipeline (ID: ${id}).`,
        );
        break;
      case "Workflow":
        saveAndSet(
          "leadcrm_workflows",
          workflows.map((w) => (w.id === id ? { ...w, isArchived: false } : w)),
          setWorkflows,
        );
        addAuditLog(
          "Workflow Restored",
          `Restored workflow automation rule (ID: ${id}).`,
        );
        break;
      case "Campaign":
        saveAndSet(
          "leadcrm_campaigns",
          campaigns.map((c) => (c.id === id ? { ...c, isArchived: false } : c)),
          setCampaigns,
        );
        addAuditLog(
          "Campaign Restored",
          `Restored marketing campaign (ID: ${id}).`,
        );
        break;
      case "Template":
        saveAndSet(
          "leadcrm_templates",
          templates.map((t) => (t.id === id ? { ...t, isArchived: false } : t)),
          setTemplates,
        );
        addAuditLog(
          "Template Restored",
          `Restored communication template (ID: ${id}).`,
        );
        break;
      case "Role":
        saveAndSet(
          "leadcrm_roles",
          roles.map((r) => (r.id === id ? { ...r, isArchived: false } : r)),
          setRoles,
        );
        addAuditLog(
          "Role Restored",
          `Restored custom access role (ID: ${id}).`,
        );
        break;
      case "User":
        const allUsers = JSON.parse(
          localStorage.getItem("leadcrm_users") || "[]",
        );
        const updatedUsers = allUsers.map((u: any) =>
          u.id === id ? { ...u, status: "Active", isArchived: false } : u,
        );
        localStorage.setItem("leadcrm_users", JSON.stringify(updatedUsers));
        if (tenant) {
          setUsers(updatedUsers.filter((u: any) => u.tenantId === tenant.id));
        } else {
          setUsers(updatedUsers);
        }
        addAuditLog(
          "User Restored",
          `Restored team member account (ID: ${id}).`,
        );
        break;
    }
  };

  const addAuditLog = (
    action: string,
    details: string,
    rowId?: string,
    changeset?: Record<string, { old: any; new: any }>,
  ) => {
    const currentUser =
      user || JSON.parse(localStorage.getItem("leadcrm_user") || "null");
    if (!currentUser) return;

    // Simulate semi-dynamic IP address based on user session ranges to look organic
    const mockIPs = [
      "112.204.42.10",
      "120.28.114.50",
      "202.90.136.2",
      "180.191.137.24",
      "49.145.96.12",
    ];
    const hashedIndex =
      currentUser.id
        .split("")
        .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) %
      mockIPs.length;
    const ipAddress = mockIPs[hashedIndex];

    const newLog: AuditLog = {
      id: "log_" + Math.random().toString(36).substring(2, 11),
      userId: currentUser.id,
      userEmail: currentUser.email,
      action,
      details,
      timestamp: new Date().toISOString(),
      ipAddress,
      tenantId: tenant?.id || currentUser.tenantId || "",
      rowId,
      changeset,
      operatorRole: currentUser.role,
    };

    const allLogs = JSON.parse(
      localStorage.getItem("leadcrm_audit_logs") || "[]",
    );
    const updatedLogs = [newLog, ...allLogs].slice(0, 500); // Keep last 500 logs
    localStorage.setItem("leadcrm_audit_logs", JSON.stringify(updatedLogs));

    if (user?.role === "System Admin") {
      setAuditLogs(updatedLogs);
    } else if (tenant) {
      setAuditLogs(
        updatedLogs.filter(
          (log: any) => !log.tenantId || log.tenantId === tenant.id,
        ),
      );
    } else {
      setAuditLogs([newLog]);
    }
  };

  const addActivity = (activityData: Omit<Activity, 'id' | 'tenantId'>) => {
    const currentTenantId = tenant?.id || user?.tenantId || '';
    if (!currentTenantId) return;

    const newActivity: Activity = {
      ...activityData,
      id: 'act_' + Math.random().toString(36).substring(2, 11),
      tenantId: currentTenantId,
    };

    const allActivities = JSON.parse(
      localStorage.getItem('leadcrm_activities') || '[]',
    );
    const updated = [newActivity, ...allActivities].slice(0, 1000);
    localStorage.setItem('leadcrm_activities', JSON.stringify(updated));
    setActivities(updated.filter((a: Activity) => a.tenantId === currentTenantId));
  };

  const addInvoice = (invoiceData: Omit<Invoice, 'id' | 'tenantId' | 'createdAt'>) => {
    if (!tenant) return;
    const newInvoice: Invoice = {
      ...invoiceData,
      id: 'INV-' + Date.now(),
      tenantId: tenant.id,
      createdAt: new Date().toISOString(),
    };
    const all = JSON.parse(localStorage.getItem('leadcrm_invoices') || JSON.stringify(MOCK_INVOICES));
    const updated = [...all, newInvoice];
    localStorage.setItem('leadcrm_invoices', JSON.stringify(updated));
    setInvoices(updated.filter((x: Invoice) => x.tenantId === tenant.id && !x.isArchived));
    addAuditLog('Invoice Created', `Created invoice ${newInvoice.id} for ${newInvoice.companyName}`);
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    const all = JSON.parse(localStorage.getItem('leadcrm_invoices') || JSON.stringify(MOCK_INVOICES));
    const updated = all.map((inv: Invoice) => inv.id === id ? { ...inv, ...updates } : inv);
    localStorage.setItem('leadcrm_invoices', JSON.stringify(updated));
    if (tenant) setInvoices(updated.filter((x: Invoice) => x.tenantId === tenant.id && !x.isArchived));
  };

  const removeInvoice = (id: string) => {
    const all = JSON.parse(localStorage.getItem('leadcrm_invoices') || JSON.stringify(MOCK_INVOICES));
    const updated = all.map((inv: Invoice) => inv.id === id ? { ...inv, isArchived: true } : inv);
    localStorage.setItem('leadcrm_invoices', JSON.stringify(updated));
    if (tenant) setInvoices(updated.filter((x: Invoice) => x.tenantId === tenant.id && !x.isArchived));
  };

  const approveTenant = (id: string) => {
    const allTenants = JSON.parse(
      localStorage.getItem("leadcrm_tenants") || "[]",
    );
    const tenantToApprove = allTenants.find((t: Tenant) => t.id === id);
    if (!tenantToApprove) return;

    const newTenants = allTenants.map((t: Tenant) => {
      if (t.id === id) {
        if (t.approvalStep === "basic") {
          addAuditLog(
            "Approve Tenant Step 1",
            `Approved basic details for ${t.name}. Sandbox environment provisioned.`,
          );
          return {
            ...t,
            approvalStep: "requirements",
            environment: "sandbox",
            status: "pending",
          };
        } else if (t.approvalStep === "requirements") {
          addAuditLog(
            "Approve Tenant Final",
            `Approved business requirements for ${t.name}. Production environment provisioned.`,
          );
          return {
            ...t,
            approvalStep: "completed",
            environment: "production",
            status: "active",
          };
        }
        return {
          ...t,
          status: "active",
          approvalStep: "completed",
          environment: "production",
        };
      }
      return t;
    });
    localStorage.setItem("leadcrm_tenants", JSON.stringify(newTenants));
    loadData();
  };

  const rejectTenant = (id: string) => {
    const allTenants = JSON.parse(
      localStorage.getItem("leadcrm_tenants") || "[]",
    );
    const tenant = allTenants.find((t: Tenant) => t.id === id);
    if (tenant)
      addAuditLog("Reject Tenant", `Rejected application for ${tenant.name}.`);

    const newTenants = allTenants.map((t: Tenant) =>
      t.id === id ? { ...t, status: "rejected" } : t,
    );
    localStorage.setItem("leadcrm_tenants", JSON.stringify(newTenants));
    loadData();
  };

  const suspendTenant = (id: string) => {
    const allTenants = JSON.parse(
      localStorage.getItem("leadcrm_tenants") || "[]",
    );
    const tenant = allTenants.find((t: Tenant) => t.id === id);
    if (tenant)
      addAuditLog("Suspend Tenant", `Suspended access for ${tenant.name}.`);

    const newTenants = allTenants.map((t: Tenant) =>
      t.id === id ? { ...t, status: "suspended" } : t,
    );
    localStorage.setItem("leadcrm_tenants", JSON.stringify(newTenants));
    loadData();
  };

  const updateTenant = (id: string, updates: Partial<Tenant>) => {
    const allTenants = JSON.parse(
      localStorage.getItem("leadcrm_tenants") || "[]",
    );
    const tenant = allTenants.find((t: Tenant) => t.id === id);
    if (tenant && updates.adminNotes) {
      addAuditLog(
        "Update Tenant Notes",
        `Updated internal admin notes for ${tenant.name}.`,
      );
    }

    const newTenants = allTenants.map((t: Tenant) =>
      t.id === id ? { ...t, ...updates } : t,
    );
    localStorage.setItem("leadcrm_tenants", JSON.stringify(newTenants));
    loadData();
  };

  const resetDemoData = () => {
    localStorage.setItem("leadcrm_leads", JSON.stringify(MOCK_LEADS));
    localStorage.setItem("leadcrm_deals", JSON.stringify(MOCK_DEALS));
    localStorage.setItem("leadcrm_pipelines", JSON.stringify(MOCK_PIPELINES));
    localStorage.setItem("leadcrm_workflows", JSON.stringify(MOCK_WORKFLOWS));
    localStorage.setItem("leadcrm_campaigns", JSON.stringify(MOCK_CAMPAIGNS));
    localStorage.setItem("leadcrm_templates", JSON.stringify(MOCK_TEMPLATES));
    localStorage.setItem("leadcrm_roles", JSON.stringify(MOCK_ROLES));
    localStorage.setItem(
      "leadcrm_permissions",
      JSON.stringify(MOCK_PERMISSIONS),
    );
    localStorage.setItem("leadcrm_users", JSON.stringify(MOCK_USERS));
    localStorage.setItem("leadcrm_tenants", JSON.stringify(MOCK_TENANTS));
    localStorage.setItem("leadcrm_tasks", JSON.stringify(MOCK_TASKS));
    localStorage.setItem("leadcrm_service_enabled", "false");
    localStorage.setItem("leadcrm_asset_enabled", "false");
    localStorage.setItem("leadcrm_billing_enabled", "false");
    loadData();
  };

  const toggleServiceModule = () => {
    const newState = !isServiceModuleEnabled;
    localStorage.setItem("leadcrm_service_enabled", JSON.stringify(newState));
    setIsServiceModuleEnabled(newState);
  };

  const toggleAssetModule = () => {
    const newState = !isAssetModuleEnabled;
    localStorage.setItem("leadcrm_asset_enabled", JSON.stringify(newState));
    setIsAssetModuleEnabled(newState);
  };

  const toggleBillingModule = () => {
    const newState = !isBillingModuleEnabled;
    localStorage.setItem("leadcrm_billing_enabled", JSON.stringify(newState));
    setIsBillingModuleEnabled(newState);
  };

  return (
    <DataContext.Provider
      value={{
        organizations,
        contacts,
        deals,
        pipelines,
        workflows,
        campaigns,
        templates,
        roles,
        permissions,
        users,
        tenants,
        tasks,
        workflowExecutions,
        workflowExecutionRuns,
        workflowExecutionSteps,
        activities,
        addActivity,
        invoices,
        addInvoice,
        updateInvoice,
        removeInvoice,
        pendingActions,
        serviceOrders,
        assets,
        inventoryItems,
        auditLogs,
        addOrganization,
        updateOrganization,
        deleteOrganization,
        addContact,
        updateContact,
        deleteContact,
        addDeal,
        updateDeal,
        deleteDeal,
        addPipeline,
        updatePipeline,
        deletePipeline,
        addRole,
        updateRole,
        deleteRole,
        resetDemoData,
        approveTenant,
        rejectTenant,
        suspendTenant,
        updateTenant,
        addAuditLog,
        addTask,
        updateTask,
        updateServiceOrder,
        addWorkflow,
        updateWorkflow,
        deleteWorkflow,
        reorderDeals,
        addCampaign,
        updateCampaign,
        deleteCampaign,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        isServiceModuleEnabled,
        toggleServiceModule,
        isAssetModuleEnabled,
        toggleAssetModule,
        isBillingModuleEnabled,
        toggleBillingModule,
        addUser,
        updateUser,
        deleteUser,
        restoreRecord,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = (options?: { includeArchived?: boolean }) => {
  const context = useContext(DataContext);
  if (context === undefined)
    throw new Error("useData must be used within a DataProvider");
    
  if (options?.includeArchived) {
    return context;
  }

  return {
    ...context,
    contacts: context.contacts.filter((c) => !c.isArchived),
    organizations: context.organizations.filter((o) => !o.isArchived),
    deals: context.deals.filter((d) => !d.isArchived),
    pipelines: context.pipelines.filter((p) => !p.isArchived),
    workflows: context.workflows.filter((w) => !w.isArchived),
    campaigns: context.campaigns.filter((c) => !c.isArchived),
    templates: context.templates.filter((t) => !t.isArchived),
    roles: context.roles.filter((r) => !r.isArchived),
    users: context.users.filter((u) => !u.isArchived),
    tasks: context.tasks ? context.tasks.filter((t) => !("isArchived" in t) || !(t as any).isArchived) : [],
    serviceOrders: context.serviceOrders ? context.serviceOrders.filter((s) => !("isArchived" in s) || !(s as any).isArchived) : [],
    assets: context.assets ? context.assets.filter((a) => !("isArchived" in a) || !(a as any).isArchived) : [],
    inventoryItems: context.inventoryItems ? context.inventoryItems.filter((i) => !("isArchived" in i) || !(i as any).isArchived) : []
  };
};
