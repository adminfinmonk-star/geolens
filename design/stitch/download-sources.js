const fs = require("fs");
const https = require("https");
const http = require("http");
const { URL } = require("url");

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = new URL(url).protocol === "https:" ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "GeoLens/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        get(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
  });
}

(async () => {
  const j = JSON.parse(fs.readFileSync("design/stitch/gen_sources.json", "utf8"));
  if (j.error) {
    console.error(j.error);
    process.exit(1);
  }
  const inner = JSON.parse(j.result.content[0].text);
  fs.writeFileSync("design/stitch/gen_sources_parsed.json", JSON.stringify(inner, null, 2));
  const screen = inner.outputComponents[0].design.screens[0];
  fs.writeFileSync("design/stitch/sources-screen-id.txt", screen.id);
  console.log("id", screen.id, screen.title);
  const img = await get(screen.screenshot.downloadUrl);
  fs.writeFileSync("design/stitch/sources-screen.png", img.buf);
  console.log("png", img.status, img.buf.length);
  const html = await get(screen.htmlCode.downloadUrl);
  fs.writeFileSync("design/stitch/sources-screen.html", html.buf);
  console.log("html", html.status, html.buf.length);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
