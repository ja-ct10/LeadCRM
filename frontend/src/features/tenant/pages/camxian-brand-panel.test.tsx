import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
const state = vi.hoisted(() => ({ reduced: false }));
vi.mock('motion/react', () => {
  const wrap = (Tag: 'div' | 'p' | 'h1' | 'ul' | 'section' | 'button') => ({ initial, animate, exit, transition, ...props }: Record<string, unknown>) => React.createElement(Tag, props);
  return { motion: { div: wrap('div'), p: wrap('p'), h1: wrap('h1'), ul: wrap('ul'), section: wrap('section'), button: wrap('button') }, AnimatePresence: ({ children }: { children: React.ReactNode }) => children, useReducedMotion: () => state.reduced };
});
import { CamxianBrandPanel } from './camxian-brand-panel';
beforeEach(() => { vi.useFakeTimers(); state.reduced = false; });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('Camxian solutions', () => {
  it('rotates and cancels its timer on unmount', () => {
    const view = render(<CamxianBrandPanel onNavigate={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'CCTV Surveillance' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(4500));
    expect(screen.getByRole('heading', { name: 'Biometrics & Access Control' })).toBeTruthy();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('lets readers pause and choose a solution', () => {
    render(<CamxianBrandPanel onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Structured Cabling' }));
    act(() => vi.advanceTimersByTime(18000));
    expect(screen.getByRole('heading', { name: 'Structured Cabling' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play service rotation' })).toBeTruthy();
  });
  it('never auto-rotates for reduced motion', () => {
    state.reduced = true;
    render(<CamxianBrandPanel onNavigate={vi.fn()} />);
    act(() => vi.advanceTimersByTime(18000));
    expect(screen.getByRole('heading', { name: 'CCTV Surveillance' })).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
