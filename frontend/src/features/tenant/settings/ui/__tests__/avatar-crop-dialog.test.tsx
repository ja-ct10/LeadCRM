import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ draw: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: mocks.error } }));
vi.mock('react-easy-crop', () => ({ default: ({ aspect, onCropComplete }: any) => (
  <button onClick={() => onCropComplete({}, { x: 20, y: 30, width: 200, height: 200 })}>Adjust {aspect}:1 crop</button>
) }));
import { AvatarCropDialog } from '../avatar-crop-dialog';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('Image', class { src = ''; decode() { return Promise.resolve(); } });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:temporary-preview');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: mocks.draw } as any);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type, quality) {
    expect([this.width, this.height, type, quality]).toEqual([512, 512, 'image/webp', 0.82]);
    callback(new Blob(['cropped'], { type: 'image/webp' }));
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('previews and cancels without uploading, revoking the temporary preview on close', async () => {
  const upload = vi.fn(), close = vi.fn();
  const view = render(<AvatarCropDialog file={new File(['original'], 'image.png')} onApply={upload} onClose={close} />);
  fireEvent.click(await screen.findByText('Adjust 1:1 crop'));
  fireEvent.change(screen.getByLabelText('Zoom'), { target: { value: '2' } });
  expect(upload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Cancel'));
  expect(close).toHaveBeenCalledOnce();
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:temporary-preview');
});

it('uploads only the cropped square after Apply and waits for confirmation', async () => {
  let resolve!: () => void;
  const upload = vi.fn((_blob: Blob) => new Promise<void>(r => { resolve = r; })), close = vi.fn();
  render(<AvatarCropDialog file={new File(['original'], 'image.png')} onApply={upload} onClose={close} />);
  expect((screen.getByText('Apply picture') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(await screen.findByText('Adjust 1:1 crop'));
  expect(upload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Apply picture'));
  await waitFor(() => expect(upload).toHaveBeenCalledOnce());
  expect(mocks.draw.mock.calls[0].slice(1)).toEqual([20, 30, 200, 200, 0, 0, 512, 512]);
  expect(upload.mock.calls[0][0]).toBeInstanceOf(Blob);
  expect((screen.getByText('Uploading…') as HTMLButtonElement).disabled).toBe(true);
  expect(close).not.toHaveBeenCalled();
  resolve();
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
});
