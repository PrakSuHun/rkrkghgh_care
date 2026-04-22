import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = readFileSync("/Volumes/박수훈/care/app/.env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await supabase.from("caregivers").select("id, name, status").order("name");
console.log(`총 ${data.length}명`);
const tagged = data.filter((c) => /퇴사|휴직/.test(c.name));
console.log(`태그 남은 것: ${tagged.length}`);
for (const c of tagged) console.log(`  ${c.id} "${c.name}" ${c.status}`);
