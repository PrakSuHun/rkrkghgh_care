import path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// 사용자 확인: 현재 활성 수급자 67명
const ACTIVE: Array<{ name: string; birth: string; ltc: string }> = [
  { name: "황덕선", birth: "1935-08-13", ltc: "L0010007167" },
  { name: "하화자", birth: "1943-03-29", ltc: "L0010323490" },
  { name: "이재근", birth: "1959-12-24", ltc: "L0010346958" },
  { name: "송재천", birth: "1942-03-25", ltc: "L0010508655" },
  { name: "라원순", birth: "1934-06-20", ltc: "L0010532375" },
  { name: "황동례", birth: "1942-11-06", ltc: "L0010532487" },
  { name: "김정임", birth: "1938-04-12", ltc: "L0010566058" },
  { name: "김정숙", birth: "1937-10-01", ltc: "L0010567720" },
  { name: "김재헌", birth: "1960-11-22", ltc: "L0010592342" },
  { name: "한영자", birth: "1941-04-05", ltc: "L0010605857" },
  { name: "임정미", birth: "1938-09-18", ltc: "L0010716657" },
  { name: "이윤금", birth: "1945-02-07", ltc: "L0010822640" },
  { name: "김동연", birth: "1934-01-15", ltc: "L0011154929" },
  { name: "이황자", birth: "1940-10-16", ltc: "L0011241374" },
  { name: "김순정", birth: "1929-06-09", ltc: "L0011400674" },
  { name: "전동진", birth: "1938-12-03", ltc: "L0011469472" },
  { name: "안미자", birth: "1943-09-14", ltc: "L1607107416" },
  { name: "이순", birth: "1927-11-14", ltc: "L1608077819" },
  { name: "권혁순", birth: "1951-08-21", ltc: "L1608108551" },
  { name: "김숙자", birth: "1929-03-28", ltc: "L1609103952" },
  { name: "박정애", birth: "1935-06-24", ltc: "L1705050274" },
  { name: "김영례", birth: "1935-07-17", ltc: "L1708189478" },
  { name: "김갑환", birth: "1934-04-25", ltc: "L1801061415" },
  { name: "권용창", birth: "1937-02-19", ltc: "L1802158837" },
  { name: "김동선", birth: "1951-12-26", ltc: "L1803191667" },
  { name: "양복순", birth: "1939-11-05", ltc: "L1805024543" },
  { name: "육맹수", birth: "1948-09-18", ltc: "L1812103602" },
  { name: "장옥예", birth: "1942-05-25", ltc: "L1908013982" },
  { name: "김정중", birth: "1938-01-30", ltc: "L2002039145" },
  { name: "최정규", birth: "1929-10-26", ltc: "L2004147962" },
  { name: "박노옥", birth: "1932-04-10", ltc: "L2005188850" },
  { name: "성연심", birth: "1939-12-10", ltc: "L2005198294" },
  { name: "오세근", birth: "1945-01-10", ltc: "L2011053242" },
  { name: "이송일", birth: "1940-09-03", ltc: "L2103005127" },
  { name: "김동애", birth: "1936-10-31", ltc: "L2106143160" },
  { name: "김순임", birth: "1933-07-03", ltc: "L2131009993" },
  { name: "최신애", birth: "1945-08-25", ltc: "L2201084604" },
  { name: "서영숙", birth: "1949-04-15", ltc: "L2202001467" },
  { name: "이광우", birth: "1957-04-10", ltc: "L2203145235" },
  { name: "도중례", birth: "1932-09-19", ltc: "L2204014248" },
  { name: "곽복용", birth: "1936-01-27", ltc: "L2205123988" },
  { name: "김영화", birth: "1933-12-28", ltc: "L2206164527" },
  { name: "박기옥", birth: "1954-09-11", ltc: "L2207029652" },
  { name: "김재환", birth: "1933-12-25", ltc: "L2208181866" },
  { name: "강외준", birth: "1935-11-05", ltc: "L2209191071" },
  { name: "정석만", birth: "1936-10-03", ltc: "L2210025024" },
  { name: "김중례", birth: "1934-12-20", ltc: "L2302116447" },
  { name: "정춘매", birth: "1948-07-27", ltc: "L2303070646" },
  { name: "최서단", birth: "1946-11-07", ltc: "L2303178861" },
  { name: "이정덕", birth: "1942-12-10", ltc: "L2304014517" },
  { name: "김종숙", birth: "1956-04-15", ltc: "L2306162043" },
  { name: "주용식", birth: "1960-07-04", ltc: "L2306194563" },
  { name: "이명자", birth: "1941-01-02", ltc: "L2307131024" },
  { name: "오천균", birth: "1948-02-02", ltc: "L2312107754" },
  { name: "한윤순", birth: "1936-12-07", ltc: "L2323040055" },
  { name: "김형윤", birth: "1943-12-19", ltc: "L2402180592" },
  { name: "김정환", birth: "1935-02-05", ltc: "L2403197653" },
  { name: "황정환", birth: "1951-06-17", ltc: "L2404154956" },
  { name: "양석한", birth: "1952-10-13", ltc: "L2407200375" },
  { name: "박영성", birth: "1938-02-24", ltc: "L2408064891" },
  { name: "정해성", birth: "1945-09-15", ltc: "L2412175343" },
  { name: "박소례", birth: "1956-03-17", ltc: "L2501036408" },
  { name: "염수용", birth: "1935-02-28", ltc: "L2501113133" },
  { name: "안주원", birth: "1949-03-07", ltc: "L2503003498" },
  { name: "이길봉", birth: "1945-10-11", ltc: "L2507118721" },
  { name: "전대순", birth: "1935-10-15", ltc: "L2525011216" },
  { name: "신재호", birth: "1951-07-18", ltc: "L2601152249" },
];

async function main() {
  const { data: all } = await sb.from("seniors").select("id, name, long_term_care_id");
  if (!all) throw new Error("fetch failed");
  console.log(`DB seniors: ${all.length}`);

  // 1. 중복 병합 & 삭제 (같은 이름에 null+non-null 있으면 null 행의 assess를 non-null 행으로 병합 후 null 행 삭제)
  const byName = new Map<string, typeof all>();
  for (const r of all) {
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name)!.push(r);
  }

  let mergedCount = 0;
  let deletedDupes = 0;
  for (const [name, rows] of byName) {
    if (rows.length < 2) continue;
    const withLtc = rows.find((r) => r.long_term_care_id);
    const withoutLtc = rows.filter((r) => !r.long_term_care_id);
    if (!withLtc) continue;

    for (const src of withoutLtc) {
      // fetch full row
      const { data: srcFull } = await sb.from("seniors").select("*").eq("id", src.id).single();
      const { data: tgtFull } = await sb.from("seniors").select("*").eq("id", withLtc.id).single();
      if (!srcFull || !tgtFull) continue;
      const patch: Record<string, unknown> = {};
      const fields = [
        "assess_meal", "assess_mobility", "assess_physical", "assess_excretion",
        "assess_hygiene", "assess_adl", "assess_cognition", "assess_behavior",
        "assess_family_env", "assess_summary", "assess_updated_at",
      ];
      for (const f of fields) {
        if (!tgtFull[f] && srcFull[f]) patch[f] = srcFull[f];
      }
      if (Object.keys(patch).length) {
        await sb.from("seniors").update(patch).eq("id", withLtc.id);
        mergedCount++;
      }
      await sb.from("seniors").delete().eq("id", src.id);
      deletedDupes++;
    }
  }
  console.log(`Merged assess: ${mergedCount}, deleted duplicate rows: ${deletedDupes}`);

  // 2. 67명 active 리스트 정규화
  let updated = 0;
  let inserted = 0;
  for (const a of ACTIVE) {
    // 먼저 ltc로 찾기
    const { data: byLtc } = await sb
      .from("seniors")
      .select("id, name")
      .eq("long_term_care_id", a.ltc)
      .maybeSingle();
    if (byLtc) {
      await sb.from("seniors").update({
        name: a.name,
        birth_date: a.birth,
        long_term_care_id: a.ltc,
        status: "active",
      }).eq("id", byLtc.id);
      updated++;
      continue;
    }
    // 이름으로 찾기 (ltc 없는 레거시)
    const { data: byN } = await sb
      .from("seniors")
      .select("id")
      .eq("name", a.name)
      .is("long_term_care_id", null)
      .maybeSingle();
    if (byN) {
      await sb.from("seniors").update({
        birth_date: a.birth,
        long_term_care_id: a.ltc,
        status: "active",
      }).eq("id", byN.id);
      updated++;
      continue;
    }
    // 새로 삽입
    await sb.from("seniors").insert({
      name: a.name,
      birth_date: a.birth,
      long_term_care_id: a.ltc,
      status: "active",
    });
    inserted++;
  }
  console.log(`Active list updated: ${updated}, inserted: ${inserted}`);

  // 3. 활성 목록에 없는 seniors → inactive
  const activeLtcs = new Set(ACTIVE.map((a) => a.ltc));
  const { data: remaining } = await sb.from("seniors").select("id, name, long_term_care_id, status");
  let deactivated = 0;
  for (const s of remaining ?? []) {
    if (s.long_term_care_id && !activeLtcs.has(s.long_term_care_id) && s.status !== "inactive") {
      await sb.from("seniors").update({ status: "inactive" }).eq("id", s.id);
      deactivated++;
    }
  }
  console.log(`Deactivated: ${deactivated}`);

  const { count: finalCount } = await sb.from("seniors").select("*", { count: "exact", head: true });
  const { count: activeCount } = await sb
    .from("seniors")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");
  console.log(`Final: total=${finalCount}, active=${activeCount}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
