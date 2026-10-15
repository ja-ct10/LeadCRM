'use client';
import { useEffect, useState } from 'react';
import type { WorkflowAction, WorkflowEntity, WorkflowOptions } from '@leadcrm/shared';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { ModuleSearchInput } from '@/shared/components/crm/module-search-input';
import { dealsApi } from '@/shared/services/deals.api';
import { matchesSearch } from '@/shared/utils/search';

function SearchableReference({ label, value, choices, placeholder, disabled, onSearch, onChange }: {
  label: string; value: string; choices: Array<{ id: string; name: string }>; placeholder: string; disabled?: boolean; onSearch?: (value: string) => void; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState('');
  const filtered = choices.filter(choice => matchesSearch(search, choice.name));
  return <div className="space-y-1"><p>{label}</p><DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild><Button type="button" variant="outline" disabled={disabled} aria-label={label} className="h-auto min-h-10 w-full justify-start whitespace-normal text-left">
      {choices.find(choice => choice.id === value)?.name ?? (value ? 'Unavailable selection — repair required' : placeholder)}
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent formContent align="start" role="group" aria-label={`${label} options`} className="w-72 max-w-[80vw]">
      <ModuleSearchInput label={`Search ${label.toLowerCase()}`} placeholder="Search…" value={search} onChange={value => { setSearch(value); onSearch?.(value); }} fullWidth />
      <div className="mt-2 max-h-64 overflow-auto">
        {[{ id: '', name: placeholder }, ...filtered].map(choice => <button key={choice.id} type="button" role="menuitem" aria-disabled="false" className="block min-h-10 w-full rounded px-2 py-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { onChange(choice.id); setOpen(false); }}>{choice.name}</button>)}
        {!filtered.length && <p className="p-2 text-xs text-muted-foreground">No matching options.</p>}
      </div>
    </DropdownMenuContent>
  </DropdownMenu></div>;
}

function SavedDealSelection({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [choices, setChoices] = useState<Array<{ id: string; name: string }>>([]), [error, setError] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => Promise.all([value ? dealsApi.get(value) : Promise.resolve(null), dealsApi.list({ limit: 100, archived: false, search })]).then(([selected, page]) => {
      if (!cancelled) setError('');
      if (!cancelled) setChoices([...new Map([...(selected ? [selected.data] : []), ...page.data].map(deal => [deal.id, { id: deal.id, name: deal.title }])).values()]);
    }).catch(() => { if (!cancelled) setError('The saved Deal could not be loaded. Check your access or clear this selection and use filters.'); }), 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [value, search]);
  return <><SearchableReference label="Specific deal (optional)" value={value} choices={choices} placeholder="Use related deal filters" onSearch={setSearch} onChange={onChange} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</>;
}

export function WorkflowTaskAssociations({ action, entity, options, onChange }: { action: WorkflowAction; entity?: WorkflowEntity; options: WorkflowOptions; onChange: (config: Record<string, unknown>) => void }) {
  const config = action.config;
  const mode = String(config.targetMode || (entity === 'deal' ? 'triggering_deal' : 'single_match'));
  const allowedModes = entity === 'deal' ? ['triggering_deal'] : entity === 'account' ? ['single_match'] : ['single_match', 'all_matching'];
  const change = (key: string, value: string) => {
    const next = { ...config };
    if (value) next[key] = value; else delete next[key];
    if (key === 'pipelineId') delete next.currentStageId;
    onChange(next);
  };
  const stages = options.pipelines.filter(pipeline => !config.pipelineId || pipeline.id === config.pipelineId).flatMap(pipeline => pipeline.stages.map(stage => ({ id: stage.id, name: `${pipeline.name} / ${stage.name}` })));
  return <fieldset className="space-y-3 rounded-lg border border-border p-3">
    <legend className="px-1 font-medium">Task associations</legend>
    <label className="block space-y-1">Associate task with<select aria-label="Associate task with" className="w-full rounded-lg border border-input bg-background p-2" value={mode} onChange={event => change('targetMode', event.target.value)}>
      {entity === 'deal' ? <option value="triggering_deal">Triggering deal</option> : <><option value="single_match">One matching related deal</option>{entity !== 'account' && <option value="all_matching">All matching related deals</option>}</>}
      {!allowedModes.includes(mode) && <option value={mode}>Unavailable selection — repair required</option>}
    </select></label>
    {entity !== 'deal' && entity !== 'account' && <>
      <SearchableReference label="Pipeline filter" value={String(config.pipelineId ?? '')} choices={options.pipelines} placeholder="All pipelines" onChange={value => change('pipelineId', value)} />
      <SearchableReference label="Stage filter" value={String(config.currentStageId ?? '')} choices={stages} placeholder="All stages" onChange={value => change('currentStageId', value)} />
      <SearchableReference label="Product filter" value={String(config.productInterestId ?? '')} choices={options.productInterests ?? []} placeholder="All products" onChange={value => change('productInterestId', value)} />
    </>}
    {(entity === 'deal' || entity === 'account') && !!(config.pipelineId || config.currentStageId || config.productInterestId) && <div role="alert" className="space-y-2 text-sm text-destructive"><p>Related-deal filters require a Lead or Contact trigger.</p><Button type="button" variant="outline" onClick={() => {
      const { pipelineId: _pipeline, currentStageId: _stage, productInterestId: _product, ...next } = config;
      onChange(next);
    }}>Remove unsupported filters</Button></div>}
    {(!!config.dealId || entity === 'account') && <SavedDealSelection value={String(config.dealId ?? '')} onChange={value => change('dealId', value)} />}
    <p className="text-xs text-muted-foreground">{mode === 'all_matching' ? 'Creates one task linked to every matching related deal, up to 50. No deals are silently excluded.' : entity === 'deal' ? 'Uses the deal that triggered this workflow.' : 'Exactly one related deal must match. Use filters to narrow multiple matches.'}</p>
  </fieldset>;
}
