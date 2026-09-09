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

async function save(name, genFile) {
  const j = JSON.parse(fs.readFileSync(genFile, "utf8"));
  if (j.error) throw new Error(JSON.stringify(j.error));
  const inner = JSON.parse(j.result.content[0].text);
  const screen = inner.outputComponents[0].design.screens[0];
  fs.writeFileSync(`design/stitch/${name}-screen-id.txt`, screen.id);
  console.log(name, screen.id, screen.title);
  const img = await get(screen.screenshot.downloadUrl);
  fs.writeFileSync(`design/stitch/${name}-screen.png`, img.buf);
  const html = await get(screen.htmlCode.downloadUrl);
  fs.writeFileSync(`design/stitch/${name}-screen.html`, html.buf);
  console.log(name, "png", img.buf.length, "html", html.buf.length);
}

(async () => {
  await save("actions", "design/stitch/gen_actions.json");
  await save("factcheck", "design/stitch/gen_factcheck.json");
  await save("chats", "design/stitch/gen_chats.json");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
