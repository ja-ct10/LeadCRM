"use client";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { apiClient } from "@/lib/api/client";
import type { TaskOption, TaskOptionKind } from "@leadcrm/shared";
import { Button } from "@/shared/components/ui/button";
import { TaskRelatedRecordCreator } from "./task-related-record-creator";
const LeadForm = dynamic(() =>
  import("@/features/tenant/crm/leads/ui/lead-form").then(
    (module) => module.AddLeadForm,
  ),
);
const AccountForm = dynamic(() =>
  import("@/features/tenant/crm/accounts/ui/account-form").then(
    (module) => module.AccountFormInner,
  ),
);
const DealForm = dynamic(() =>
  import("@/features/tenant/crm/deals/ui/deal-form").then(
    (module) => module.DealForm,
  ),
);

// Contact's legacy form emits Lead fields. This focused form uses Contact fields
// until the separate Contacts module can align its form and API contract.
function ContactQuickCreate({
  onSave,
  onCancel,
}: {
  onSave: (data: object) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
  });
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(
          Object.fromEntries(
            Object.entries(values).map(([key, value]) => [
              key,
              value.trim() || undefined,
            ]),
          ),
        );
      }}
    >
      <h3 className="text-sm font-semibold">Basic information</h3>
      {Object.entries({
        firstName: "First name",
        lastName: "Last name",
        email: "Email",
        phone: "Phone",
        company: "Company name",
      }).map(([field, label]) => (
        <label key={field} className="block space-y-2 text-sm font-medium">
          <span>
            {label}
            {field.endsWith("Name") ? " *" : ""}
          </span>
          <input
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required={field.endsWith("Name")}
            pattern={field.endsWith("Name") ? ".*\\S.*" : undefined}
            maxLength={field.endsWith("Name") ? 100 : 255}
            type={
              field === "email" ? "email" : field === "phone" ? "tel" : "text"
            }
            value={values[field as keyof typeof values]}
            onChange={(event) =>
              setValues({ ...values, [field]: event.target.value })
            }
          />
        </label>
      ))}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create contact</Button>
      </div>
    </form>
  );
}

/** Uses CRM forms and public routes; creation never clears the parent Task draft. */
export function TaskRecordCreator({
  kind,
  leadIds = [],
  onCreated,
  onCancel,
  onBusy,
}: {
  kind: Exclude<TaskOptionKind, "user">;
  leadIds?: string[];
  onCreated: (option: TaskOption) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const submit = async (data: object) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const path = {
        lead: "leads",
        contact: "contacts",
        account: "accounts",
        deal: "deals",
      }[kind];
      const response = await apiClient.post<{
        data: {
          id: string;
          firstName?: string;
          lastName?: string;
          name?: string;
          title?: string;
        };
      }>("/crm/" + path, data);
      const row = response.data;
      onCreated({
        id: row.id,
        label:
          row.name ||
          row.title ||
          [row.firstName, row.lastName].filter(Boolean).join(" "),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create record.");
    } finally {
      pending.current = false;
      setBusy(false);
      onBusy(false);
    }
  };
  if (leadIds.length && (kind === "contact" || kind === "account")) {
    return (
      <TaskRelatedRecordCreator
        kind={kind}
        leadIds={leadIds}
        onCreated={onCreated}
        onCancel={onCancel}
        onBusy={onBusy}
      />
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <p className="mb-4 text-sm text-muted-foreground">
        Your task draft is preserved. The new record will be selected after it
        is saved.
      </p>
      {kind === "deal" && leadIds.length > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          This deal will be linked to the {leadIds.length} selected
          {leadIds.length === 1 ? " lead" : " leads"}. You can add other leads
          below.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="min-h-0 flex-1">
        {kind === "lead" && (
          <LeadForm onSave={(data) => void submit(data)} onCancel={onCancel} />
        )}
        {kind === "contact" && (
          <ContactQuickCreate
            onSave={(data) => void submit(data)}
            onCancel={onCancel}
          />
        )}
        {kind === "account" && (
          <AccountForm
            onSave={(data) =>
              void submit({
                ...data,
                customerSince:
                  data.customerSince &&
                  /^\d{4}-\d{2}-\d{2}$/.test(data.customerSince)
                    ? `${data.customerSince}T00:00:00.000Z`
                    : data.customerSince,
              })
            }
            onCancel={onCancel}
          />
        )}
        {kind === "deal" && (
          <DealForm
            mode="create"
            isLoading={busy}
            onCancel={onCancel}
            onSubmit={async (data) => {
              const { organizationId, ...payload } = data;
              await submit({
                ...payload,
                leadIds: [...new Set([...leadIds, ...(payload.leadIds ?? [])])],
                accountId: organizationId || undefined,
              });
            }}
          />
        )}
      </fieldset>
      {busy && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Creating record…
        </p>
      )}
    </div>
  );
}
