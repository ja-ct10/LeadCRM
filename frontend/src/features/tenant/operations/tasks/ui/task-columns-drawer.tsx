"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  TASK_COLUMN_DEFINITIONS,
  type ColumnConfigItem,
} from "@leadcrm/shared";
import { Sheet, SheetContent } from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { taskInputClass } from "./task-editor";
function ColumnRow({
  column,
  index,
  total,
  remove,
  move,
}: {
  column: ColumnConfigItem;
  index: number;
  total: number;
  remove: () => void;
  move: (offset: number) => void;
}) {
  const definition = TASK_COLUMN_DEFINITIONS.find(
    (item) => item.id === column.id,
  )!;
  const { setNodeRef, attributes, listeners, transform, transition } =
    useSortable({ id: column.id, disabled: column.id === "action" });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex min-h-14 items-center gap-3 border-b border-border bg-background px-4 last:border-0"
    >
      {column.id === "action" ? (
        <span className="w-4" />
      ) : (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="touch-none rounded text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={"Reorder " + definition.label}
        >
          <GripVertical size={16} />
        </button>
      )}
      <span className="flex-1 text-sm">{definition.label}</span>
      {definition.required ? (
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          Default
        </span>
      ) : (
        <button
          type="button"
          aria-label={"Remove " + definition.label}
          onClick={remove}
          className="rounded p-1 hover:bg-secondary"
        >
          <X size={15} />
        </button>
      )}
      {column.id !== "action" && (
        <span className="flex flex-col">
          <button
            type="button"
            aria-label={"Move " + definition.label + " up"}
            disabled={index <= 1}
            onClick={() => move(-1)}
            className="disabled:opacity-20"
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            aria-label={"Move " + definition.label + " down"}
            disabled={index === total - 1}
            onClick={() => move(1)}
            className="disabled:opacity-20"
          >
            <ChevronDown size={13} />
          </button>
        </span>
      )}
    </li>
  );
}
export function TaskColumnsDrawer({
  columns,
  onSave,
  onClose,
}: {
  columns: ColumnConfigItem[];
  onSave: (columns: ColumnConfigItem[]) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() =>
    columns
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order),
  );
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const heading = useId(),
    panel = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const serialize = (visible: ColumnConfigItem[]) => [
    ...visible.map((column, order) => ({ ...column, visible: true, order })),
    ...TASK_COLUMN_DEFINITIONS.filter(
      (column) => !visible.some((item) => item.id === column.id),
    ).map((column, index) => ({
      id: column.id,
      visible: false,
      order: visible.length + index,
    })),
  ];
  const dirty =
    JSON.stringify(draft.map((column) => column.id)) !==
    JSON.stringify(
      columns
        .filter((column) => column.visible)
        .sort((a, b) => a.order - b.order)
        .map((column) => column.id),
    );
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(
      () => panel.current?.querySelector<HTMLElement>("button")?.focus(),
      0,
    );
    return () => {
      clearTimeout(timer);
      previous?.focus();
    };
  }, []);
  const move = (from: number, to: number) => {
    if (from > 0 && to > 0 && to < draft.length)
      setDraft(arrayMove(draft, from, to));
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave(serialize(draft));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save columns.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <SheetContent
        ref={panel}
        aria-labelledby={heading}
        showClose={!busy}
        className="sm:max-w-[440px]"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (!busy) onClose();
          }
          if (event.key !== "Tab" || !panel.current) return;
          const items = [
            ...panel.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]),input:not([disabled]),[tabindex="0"]',
            ),
          ];
          if (event.shiftKey && document.activeElement === items[0]) {
            event.preventDefault();
            items.at(-1)?.focus();
          }
          if (!event.shiftKey && document.activeElement === items.at(-1)) {
            event.preventDefault();
            items[0]?.focus();
          }
        }}
      >
        <header className="border-b border-border bg-primary/10 px-6 py-6 pr-12">
          <h2 id={heading} className="text-lg font-semibold">
            Attributes visible as columns
          </h2>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <p className="text-sm text-muted-foreground">
            Customize the Tasks page and choose the attributes you want to see
            as columns.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <fieldset disabled={busy} className="space-y-4">
            <div ref={menu} className="relative flex justify-end">
              <Button
                ref={menuButton}
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
              >
                <Plus size={14} />
                Select attributes
                <ChevronDown size={14} />
              </Button>
              {open && (
                <div
                  className="absolute right-0 top-full z-20 mt-2 w-full max-w-72 rounded-xl border border-border bg-background p-3 shadow-xl"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      setOpen(false);
                      menuButton.current?.focus();
                    }
                  }}
                >
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-3 text-muted-foreground"
                    />
                    <input
                      autoFocus
                      aria-label="Search attributes"
                      placeholder="Search"
                      className={taskInputClass + " pl-9"}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="mt-2 max-h-64 overflow-y-auto">
                    {TASK_COLUMN_DEFINITIONS.filter((column) =>
                      column.label.toLowerCase().includes(search.toLowerCase()),
                    ).map((column) => {
                      const added = draft.some((item) => item.id === column.id);
                      return (
                        <button
                          type="button"
                          key={column.id}
                          disabled={added}
                          onClick={() =>
                            setDraft((previous) => [
                              ...previous,
                              {
                                id: column.id,
                                visible: true,
                                order: previous.length,
                              },
                            ])
                          }
                          className="flex w-full items-center justify-between gap-3 rounded p-2 text-left text-sm hover:bg-secondary disabled:cursor-default"
                        >
                          <span>{column.label}</span>
                          {added ? (
                            <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                              Already added
                            </span>
                          ) : (
                            <Plus size={14} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (over)
                  move(
                    draft.findIndex((c) => c.id === active.id),
                    draft.findIndex((c) => c.id === over.id),
                  );
              }}
            >
              <SortableContext
                items={draft.map((column) => column.id)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="overflow-hidden rounded-lg border border-border">
                  {draft.map((column, index) => (
                    <ColumnRow
                      key={column.id}
                      column={column}
                      index={index}
                      total={draft.length}
                      remove={() =>
                        setDraft((previous) =>
                          previous.filter((item) => item.id !== column.id),
                        )
                      }
                      move={(offset) => move(index, index + offset)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          </fieldset>
        </div>
        <footer className="flex justify-between border-t border-border p-4">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !dirty} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
