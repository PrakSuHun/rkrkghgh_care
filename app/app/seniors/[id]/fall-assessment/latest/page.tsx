"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";

export default function LatestFallAssessment() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const sp = useSearchParams();
  const from = sp.get("from");
  const { data } = useSWR<any>(`/api/fall-assessments?senior_id=${id}`);

  useEffect(() => {
    if (!data) return;
    const list = data.assessments ?? [];
    const suffix = from ? `?from=${from}` : "";
    if (list.length > 0) {
      router.replace(`/seniors/${id}/fall-assessment/${list[0].id}${suffix}`);
    } else {
      router.replace(`/seniors/${id}`);
    }
  }, [data, id, router, from]);

  return <div className="p-6">로딩 중...</div>;
}
