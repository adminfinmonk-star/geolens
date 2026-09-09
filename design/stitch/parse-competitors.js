const fs = require("fs");
const j = JSON.parse(fs.readFileSync("design/stitch/gen_competitors.json", "utf8"));
if (j.error) {
  console.log("ERROR", JSON.stringify(j.error));
  process.exit(1);
}
const inner = JSON.parse(j.result.content[0].text);
fs.writeFileSync("design/stitch/gen_competitors_parsed.json", JSON.stringify(inner, null, 2));
const s = JSON.stringify(inner);
const ids = [...s.matchAll(/screens\/([a-f0-9]+)/g)].map((x) => x[1]);
console.log("screenIds", [...new Set(ids)]);
const comps = inner.outputComponents || [];
for (const c of comps) {
  console.log("keys", Object.keys(c).join(","));
}
