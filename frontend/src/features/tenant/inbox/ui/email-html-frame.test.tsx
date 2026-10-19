import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EmailHtmlFrame } from './email-html-frame';

let resize: ResizeObserverCallback;
let observers: { disconnect: ReturnType<typeof vi.fn> }[];
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

beforeEach(() => {
  observers = []; frames = new Map(); nextFrame = 0;
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn();
    observe = vi.fn();
    constructor(callback: ResizeObserverCallback) { resize = callback; observers.push(this); }
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function loadFrame() {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<EmailHtmlFrame body="<p>Original email</p>" inlineImages={{}} />); });
  const frame = view.getByTitle('Email message content') as HTMLIFrameElement;
  const body = frame.contentDocument!.body;
  Object.defineProperty(body, 'scrollHeight', { value: 100, configurable: true });
  observers.length = 0;
  fireEvent.load(frame);
  flushFrame();
  return { ...view, frame, body };
}
function flushFrame() {
  const callbacks = [...frames.values()]; frames.clear();
  act(() => callbacks.forEach(callback => callback(0)));
}

it('defers resize-driven height writes and coalesces notifications while preserving growth and shrinkage', async () => {
  const { frame, body } = await loadFrame();
  expect(frame.style.height).toBe('100px');
  Object.defineProperty(body, 'scrollHeight', { value: 240, configurable: true });
  act(() => { resize([], {} as ResizeObserver); resize([], {} as ResizeObserver); });
  expect(frame.style.height).toBe('100px');
  expect(frames.size).toBe(1);
  flushFrame(); expect(frame.style.height).toBe('240px');
  Object.defineProperty(body, 'scrollHeight', { value: 60, configurable: true });
  fireEvent(body, new Event('toggle', { bubbles: true }));
  flushFrame(); expect(frame.style.height).toBe('60px');
});

it('disconnects observers, removes listeners and cancels queued measurements on reload and unmount', async () => {
  const { frame, unmount } = await loadFrame();
  const remove = vi.spyOn(frame.contentDocument!, 'removeEventListener');
  act(() => resize([], {} as ResizeObserver));
  expect(frames.size).toBe(1);
  const previousFrame = nextFrame;
  fireEvent.load(frame);
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(window.cancelAnimationFrame).toHaveBeenCalledWith(previousFrame);
  expect(frames.size).toBe(1); // Initial measurement for the newly loaded document.
  expect(remove).toHaveBeenCalledWith('load', expect.any(Function), true);
  expect(remove).toHaveBeenCalledWith('toggle', expect.any(Function), true);
  act(() => resize([], {} as ResizeObserver));
  unmount();
  expect(observers[1].disconnect).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
  expect(remove).toHaveBeenCalledTimes(4);
});

it('cleans the old document before loading changed content and retains unchanged srcDoc', async () => {
  const view = await loadFrame();
  const original = view.frame.getAttribute('srcdoc');
  view.rerender(<EmailHtmlFrame body="<p>Original email</p>" inlineImages={{}} />);
  expect(view.frame.getAttribute('srcdoc')).toBe(original);
  expect(observers[0].disconnect).not.toHaveBeenCalled();
  const remove = vi.spyOn(view.frame.contentDocument!, 'removeEventListener');
  act(() => resize([], {} as ResizeObserver));
  expect(frames.size).toBe(1);
  view.rerender(<EmailHtmlFrame body="<p>Recovered message</p>" inlineImages={{}} />);
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledTimes(2);
  expect(frames.size).toBe(0);
  expect(view.frame.getAttribute('sandbox')).not.toContain('allow-scripts');
  expect(view.frame.getAttribute('srcdoc')).toContain("script-src 'none'");
});
