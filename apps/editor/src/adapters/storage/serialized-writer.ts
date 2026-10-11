/** One queue per physical v1 store. Rejected writes do not poison later work. */
export function createSerializedWriter() {
  let tail: Promise<void> = Promise.resolve();
  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation);
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
    settled: () => tail,
  };
}
