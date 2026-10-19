const fs = require("node:fs");
const path = require("node:path");
const source = process.argv[2];
const dest = process.argv[3];
const raw = JSON.parse(fs.readFileSync(source, "utf8"));
const data = raw.data || (raw.result && raw.result.data);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, Buffer.from(data, "base64"));
console.log(dest, Buffer.from(data, "base64").length);
