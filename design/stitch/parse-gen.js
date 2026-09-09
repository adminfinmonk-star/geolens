const fs = require("fs");
const j = JSON.parse(fs.readFileSync("design/stitch/gen_result.json", "utf8"));
const inner = JSON.parse(j.result.content[0].text);
fs.writeFileSync("design/stitch/gen_parsed.json", JSON.stringify(inner, null, 2));
const comps = inner.outputComponents || [];
for (const c of comps) {
  console.log("component keys", Object.keys(c));
  if (c.screen) {
    console.log("screen name", c.screen.name || c.screen.title);
    console.log("screen id field", c.screen.id || c.screen.screenId);
    const shot = c.screen.screenshot?.downloadUrl || c.screen.screenshot?.url;
    const html = c.screen.htmlCode?.downloadUrl || c.screen.htmlCode?.url;
    console.log("has screenshot", !!shot);
    console.log("has html", !!html);
    if (shot) fs.writeFileSync("design/stitch/overview-img-url.txt", shot);
    if (html) fs.writeFileSync("design/stitch/overview-html-url.txt", html);
    fs.writeFileSync("design/stitch/overview-screen.json", JSON.stringify(c.screen, null, 2));
  }
}
const s = JSON.stringify(inner);
const ids = [...s.matchAll(/screens\/([a-f0-9]+)/g)].map((x) => x[1]);
console.log("screenIds", [...new Set(ids)]);
