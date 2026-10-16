import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ModuleTabs } from '../module-tabs';
import { ModuleWorkspace } from '../module-workspace';

afterEach(cleanup);
const tabs = [{ id: 'all', label: 'All Leads' }, { id: 'mine', label: 'My Leads' }];

it('provides scrollable underline filters with accessible selected, disabled and keyboard focus states', () => {
  const change = vi.fn();
  const view = render(<ModuleTabs tabs={tabs} activeTab="all" onTabChange={change} ariaLabel="Lead views" />);
  const group = screen.getByRole('group', { name: 'Lead views' });
  expect(group.className).toContain('overflow-x-auto');
  expect(group.className).toContain('border-b');
  const all = screen.getByRole('button', { name: 'All Leads', pressed: true });
  expect(all.querySelector('[aria-hidden]')?.className).toContain('bg-primary');
  const mine = screen.getByRole('button', { name: 'My Leads', pressed: false });
  expect(mine.className).toContain('shrink-0');
  expect(mine.className).toContain('focus-visible:');
  mine.focus(); expect(document.activeElement).toBe(mine);
  fireEvent.click(mine); expect(change).toHaveBeenCalledExactlyOnceWith('mine');
  view.rerender(<ModuleTabs tabs={tabs} activeTab="mine" onTabChange={change} disabled ariaLabel="Lead views" />);
  fireEvent.click(mine); expect(change).toHaveBeenCalledTimes(1);
  expect(mine).toHaveProperty('disabled', true);
});

it('uses the same underline group in ModuleWorkspace without changing its tab callback', () => {
  const change = vi.fn();
  render(<ModuleWorkspace moduleId="leads" title="Leads" primaryActionLabel="Create Lead" onPrimaryAction={vi.fn()}
    availableViews={['table']} activeView="table" onViewChange={vi.fn()} savedTabs={tabs} activeTab="all" onTabChange={change}><div>Records</div></ModuleWorkspace>);
  const group = screen.getByRole('group', { name: 'Leads views' });
  expect(group.className).toContain('overflow-x-auto');
  expect(within(group).getByRole('button', { name: 'All Leads', pressed: true }).querySelector('[aria-hidden]')).toBeTruthy();
  fireEvent.click(within(group).getByRole('button', { name: 'My Leads' }));
  expect(change).toHaveBeenCalledExactlyOnceWith('mine');
});
