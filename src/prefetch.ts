/**
 * Prefetch utilities used by service plan execution.
 */

export async function prefetchMany(links: Iterable<string>): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  for (const link of links) {
    const url = String(link);
    await Promise.resolve();
    results[url] = 'prefetched';
  }
  return results;
}
