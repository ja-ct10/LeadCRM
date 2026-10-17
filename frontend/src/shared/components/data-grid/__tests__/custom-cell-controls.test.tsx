import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { DataGrid } from '../data-grid';

afterEach(cleanup);

it.each(['clip', 'wrap'] as const)('honors custom headers and unclipped content for every pin position in %s mode', viewMode => {
  render(<DataGrid<{ id: string }> data={[{ id: 'one' }]} getRowId={row => row.id} viewMode={viewMode} enableColumnMenu={false}
    columns={(['left', null, 'right'] as const).map((pinned, index) => ({
      id: String(index), header: `Column ${index}`, pinned, accessor: row => row.id, truncate: false,
      headerCell: () => <input type="checkbox" aria-label={`Header ${index}`} />,
      cell: () => <button type="button">Action {index}</button>,
    }))} />);
  for (let index = 0; index < 3; index++) {
    expect(screen.getByRole('columnheader', { name: `Column ${index}` }).contains(screen.getByRole('checkbox', { name: `Header ${index}` }))).toBe(true);
    const wrapper = screen.getByRole('button', { name: `Action ${index}` }).parentElement!;
    expect(wrapper.className).toContain('whitespace-normal');
    expect(wrapper.className).not.toMatch(/truncate|line-clamp|overflow-hidden/);
  }
});

it('keeps the existing text headers and clipping as defaults', () => {
  render(<DataGrid<{ id: string }> data={[{ id: 'one' }]} getRowId={row => row.id} columns={[{
    id: 'name', header: 'Existing header', accessor: row => row.id, cell: () => <span>Existing content</span>,
  }]} />);
  expect(screen.getByRole('columnheader', { name: 'Existing header' }).textContent).toBe('Existing header');
  expect(screen.getByText('Existing content').parentElement?.className).toContain('truncate');
});
