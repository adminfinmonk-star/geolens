const fs = require("fs");
const https = require("https");
const http = require("http");
const { URL } = require("url");

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.get(
      url,
      { headers: { "User-Agent": "GeoLens/1.0" } },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          get(res.headers.location).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, buf: Buffer.concat(chunks) }),
        );
      },
    );
    req.on("error", reject);
  });
}

(async () => {
  const j = JSON.parse(fs.readFileSync("design/stitch/gen_discovery.json", "utf8"));
  const inner = JSON.parse(j.result.content[0].text);
  const screen = inner.outputComponents[0].design.screens[0];
  fs.writeFileSync("design/stitch/discovery-screen-id.txt", screen.id);
  const imgUrl = screen.screenshot.downloadUrl;
  const htmlUrl = screen.htmlCode.downloadUrl;
  fs.writeFileSync("design/stitch/discovery-img-url.txt", imgUrl);
  fs.writeFileSync("design/stitch/discovery-html-url.txt", htmlUrl);

  const img = await get(imgUrl);
  fs.writeFileSync("design/stitch/discovery-screen.png", img.buf);
  console.log("png", img.status, img.buf.length, img.buf.slice(0, 4).toString("hex"));

  if (!fs.existsSync("design/stitch/discovery-screen.html") || fs.statSync("design/stitch/discovery-screen.html").size < 1000) {
    const html = await get(htmlUrl);
    fs.writeFileSync("design/stitch/discovery-screen.html", html.buf);
    console.log("html", html.status, html.buf.length);
  } else {
    console.log("html keep", fs.statSync("design/stitch/discovery-screen.html").size);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
