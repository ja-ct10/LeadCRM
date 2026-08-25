'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  ExternalLink,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { DealCardList } from './deal-card-list';
import { mapToDealCardData } from './deal-card.utils';
import type { PermissionKey } from '@leadcrm/shared';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RelatedColumnDef {
  /** Field key on the record */
  key: string;
  /** Column header label */
  label: string;
  /** Custom render function */
  render?: (value: unknown, record: Record<string, unknown>) => React.ReactNode;
  /** Column width class (e.g., 'w-[120px]') */
  className?: string;
}

export interface RelatedSectionConfig {
  /** Unique section ID */
  id: string;
  /** Section heading */
  title: string;
  /** Lucide icon for the section */
  icon: LucideIcon;
  /** Target entity type for navigation */
  entityType: 'leads' | 'contacts' | 'accounts' | 'deals' | 'tasks';
  /** Records to display */
  records: Record<string, unknown>[];
  /** Column definitions for the mini-table */
  columns: RelatedColumnDef[];
  /** Maximum items to show before "View All" */
  maxItems?: number;
  /** Whether the user can add records in this section */
  canAdd?: boolean;
  /** Add button label */
  addLabel?: string;
  /** Permission required to add (e.g., 'deals.create') */
  addPermission?: PermissionKey;
  /** Callback when Add is clicked */
  onAdd?: () => void;
  /** Empty state message */
  emptyMessage?: string;
  /** If true, this section shows a single record (e.g., Account for a lead) */
  single?: boolean;
  /** Render mode: 'card' renders DealCardList for deals; default is 'table' */
  renderMode?: 'card' | 'table';
  /** Parent entity ID — used by DealCardList for "View All" links and create pre-fill */
  parentId?: string;
  /** Parent entity type — used by DealCardList */
  parentEntityType?: 'account' | 'contact' | 'lead';
  /** Callback when a deal is edited (for card mode) */
  onEditDeal?: (dealId: string) => void;
  /** Callback when a deal is deleted (for card mode) */
  onDeleteDeal?: (dealId: string) => Promise<void>;
  /** Callback when deals list is mutated (for card mode) */
  onDealMutated?: () => void;
}

export interface RecordRelatedTabProps {
  /** Related entity sections */
  sections: RelatedSectionConfig[];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface RelatedSectionCardProps {
  section: RelatedSectionConfig;
}

function RelatedSectionCard({ section }: RelatedSectionCardProps): React.ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasAddPermission = useHasPermission(section.addPermission ?? 'contacts.view' as PermissionKey);
  const showAdd = section.canAdd && hasAddPermission && section.onAdd;
  const maxItems = section.maxItems ?? 5;
  const visibleRecords = section.records.slice(0, maxItems);
  const hasMore = section.records.length > maxItems;

  // ── Card mode: render DealCardList for deals ────────────────────────────
  if (section.renderMode === 'card' && section.entityType === 'deals') {
    const dealCards = section.records.map(mapToDealCardData);
    return (
      <div className="border border-border rounded-xl bg-card overflow-hidden p-4">
        <DealCardList
          deals={dealCards}
          entityType={section.parentEntityType ?? 'account'}
          entityId={section.parentId ?? ''}
          onCreateDeal={section.onAdd}
          onEditDeal={section.onEditDeal}
          onDeleteDeal={section.onDeleteDeal}
          onDealMutated={section.onDealMutated}
        />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
          aria-expanded={!isCollapsed}
        >
          <section.icon className="h-4 w-4 text-muted-foreground" />
          <span>{section.title}</span>
          <span className="text-xs font-normal text-muted-foreground">
            ({section.records.length})
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              isCollapsed && '-rotate-90'
            )}
          />
        </button>

        {showAdd && (
          <Button
            variant="ghost"
            size="sm"
            onClick={section.onAdd}
            className="h-7 gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {section.addLabel ?? 'Add'}
          </Button>
        )}
      </div>

      {/* Section content */}
      {!isCollapsed && (
        <div>
          {section.records.length === 0 ? (
            <EmptyState
              message={section.emptyMessage ?? `No ${section.title.toLowerCase()} found.`}
              onAdd={showAdd ? section.onAdd : undefined}
              addLabel={section.addLabel}
            />
          ) : section.single ? (
            <SingleRecordDisplay
              record={section.records[0]}
              columns={section.columns}
              entityType={section.entityType}
            />
          ) : (
            <>
              {/* Mini-table */}
              <div className="divide-y divide-border/50">
                {visibleRecords.map((record) => (
                  <RelatedRecordRow
                    key={String(record.id)}
                    record={record}
                    columns={section.columns}
                    entityType={section.entityType}
                  />
                ))}
              </div>

              {/* View All link */}
              {hasMore && (
                <div className="px-4 py-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    Showing {maxItems} of {section.records.length} ·{' '}
                    <button
                      type="button"
                      className="text-primary hover:underline font-medium"
                      onClick={() => {/* Could expand or navigate */}}
                    >
                      View all
                    </button>
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Record Row ──────────────────────────────────────────────────────────────

interface RelatedRecordRowProps {
  record: Record<string, unknown>;
  columns: RelatedColumnDef[];
  entityType: string;
}

function RelatedRecordRow({ record, columns, entityType }: RelatedRecordRowProps): React.ReactElement {
  const recordId = String(record.id ?? '');
  const href = `/crm/${entityType}/${recordId}`;

  return (
    <Link
      href={href}
      className="group grid items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
      style={{ gridTemplateColumns: columns.map((c) => c.className ?? '1fr').join(' ') }}
    >
      {columns.map((col) => {
        const value = record[col.key];
        return (
          <div key={col.key} className="min-w-0">
            {col.render ? (
              col.render(value, record)
            ) : (
              <span className="text-sm text-foreground truncate block">
                {value != null ? String(value) : '—'}
              </span>
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-end">
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// ─── Single Record Display ───────────────────────────────────────────────────

interface SingleRecordDisplayProps {
  record: Record<string, unknown>;
  columns: RelatedColumnDef[];
  entityType: string;
}

function SingleRecordDisplay({ record, columns, entityType }: SingleRecordDisplayProps): React.ReactElement {
  const recordId = String(record.id ?? '');
  const href = `/crm/${entityType}/${recordId}`;

  return (
    <Link
      href={href}
      className="group flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
    >
      <div className="space-y-0.5 min-w-0">
        {columns.map((col) => {
          const value = record[col.key];
          return (
            <div key={col.key}>
              {col.render ? (
                col.render(value, record)
              ) : (
                <p className="text-sm text-foreground truncate">
                  {value != null ? String(value) : '—'}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  message: string;
  onAdd?: () => void;
  addLabel?: string;
}

function EmptyState({ message, onAdd, addLabel }: EmptyStateProps): React.ReactElement {
  return (
    <div className="px-4 py-6 text-center">
      <p className="text-xs text-muted-foreground">{message}</p>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 text-xs font-semibold text-primary hover:underline"
        >
          + {addLabel ?? 'Add'}
        </button>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function RecordRelatedTab({ sections }: RecordRelatedTabProps): React.ReactElement {
  return (
    <div className="p-6 space-y-4 max-w-4xl">
      {sections.map((section) => (
        <RelatedSectionCard key={section.id} section={section} />
      ))}

      {sections.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No related records configured.</p>
        </div>
      )}
    </div>
  );
}
