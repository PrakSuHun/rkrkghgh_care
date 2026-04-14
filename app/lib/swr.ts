"use client";

import { SWRConfiguration, mutate } from "swr";

export const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
});

export const defaultSWRConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: true,
  dedupingInterval: 5000,
};

export function invalidate(...prefixes: string[]) {
  return mutate(
    (key) => typeof key === "string" && prefixes.some((p) => key.startsWith(p)),
    undefined,
    { revalidate: true },
  );
}
