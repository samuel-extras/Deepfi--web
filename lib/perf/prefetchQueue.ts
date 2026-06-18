"use client";

type PrefetchTask = {
  href: string;
  run: (href: string) => Promise<void> | void;
};

const MAX_CONCURRENT_PREFETCH = 2;
const seen = new Set<string>();
const queue: PrefetchTask[] = [];
let active = 0;

const drain = () => {
  while (active < MAX_CONCURRENT_PREFETCH && queue.length > 0) {
    const task = queue.shift();
    if (!task) return;
    active += 1;

    Promise.resolve(task.run(task.href))
      .catch(() => {
        // Ignore prefetch failures, navigation still works without prefetch.
      })
      .finally(() => {
        active -= 1;
        drain();
      });
  }
};

export const enqueueRoutePrefetch = (
  href: string,
  run: (href: string) => Promise<void> | void
): void => {
  if (!href || seen.has(href)) return;
  seen.add(href);
  queue.push({ href, run });
  drain();
};
