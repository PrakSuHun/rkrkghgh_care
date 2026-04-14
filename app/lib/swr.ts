"use client";

import { SWRConfiguration } from "swr";

export const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
});

export const defaultSWRConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: true,
  dedupingInterval: 5000,
};
