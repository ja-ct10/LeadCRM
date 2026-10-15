/** Replace the active text selection, then restore focus and the insertion caret. */
export function insertVariableAtSelection(
  input: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  token: string,
  onChange: (value: string) => void,
) {
  const start = input?.selectionStart ?? value.length;
  const end = input?.selectionEnd ?? start;
  onChange(value.slice(0, start) + token + value.slice(end));
  requestAnimationFrame(() => {
    input?.focus();
    input?.setSelectionRange(start + token.length, start + token.length);
  });
}
