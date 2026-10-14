/** Rolling slots avoid holding fast recipients behind one slow request. All
 * started work settles before failure recovery, so no receipt is lost on drain. */
export async function runSubmissionPool<T>(items: T[], submit: (item: T) => Promise<void>, concurrency = 5) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new RangeError('Positive submission concurrency required');
  let next = 0;
  let failure: unknown;
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!failed && next < items.length) {
      const item = items[next++];
      try { await submit(item); } catch (error) { failed = true; failure = error; }
    }
  }));
  if (failed) throw failure;
}
