import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area } from './ChartComponents';
const captured = vi.hoisted(() => ({ bar: null as any, line: null as any }));
vi.mock('react-chartjs-2', () => ({
  Bar: (props: unknown) => { captured.bar = props; return null; },
  Line: (props: unknown) => { captured.line = props; return null; }, Doughnut: () => null,
}));
afterEach(cleanup);
it('renders horizontal stage bars with official colors and formatted currency tooltips', () => {
  render(<BarChart layout="vertical" data={[{ name: 'Lead', value: 1500 }]}><YAxis dataKey="name" /><XAxis tickFormatter={value => `₱${value}`} /><Tooltip formatter={value => `₱${value}`} /><Bar dataKey="value" name="PHP" data={[{ color: '#123456' }]} /></BarChart>);
  expect(captured.bar.options.indexAxis).toBe('y'); expect(captured.bar.data.labels).toEqual(['Lead']);
  expect(captured.bar.data.datasets[0].backgroundColor).toEqual(['#123456']);
  expect(captured.bar.options.scales.y.ticks.callback(0)).toBe('Lead');
  expect(captured.bar.options.plugins.tooltip.callbacks.label({ dataset: { label: 'PHP' }, parsed: { x: 1500, y: 0 } })).toBe('PHP: ₱1500');
});
it('applies actual monetary formatting to the revenue area tooltip', () => {
  render(<AreaChart data={[{ name: '2020-01-01', revenue: 45000 }]}><XAxis dataKey="name" /><YAxis /><Tooltip formatter={value => `₱${value}`} /><Area dataKey="revenue" name="Revenue" /></AreaChart>);
  expect(captured.line.options.plugins.tooltip.callbacks.label({ dataset: { label: 'Revenue' }, parsed: { y: 45000 } })).toBe('Revenue: ₱45000');
});
