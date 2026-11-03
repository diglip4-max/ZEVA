/* Reads the record, applies the domain-strip for THIS clinic only, then verifies. */
require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dns = require("dns");

const BASE = "http://localhost:3000";
const ROUTE = `${BASE}/api/admin/backfill-clinic-urls`;
const ID = "68909b31faa98f63e97e3d1b";

async function connectLikeApp() {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  const uri = process.env.MONGODB_URI;
  const m = uri.match(/^mongodb\+srv:\/\/([^@]+)@([^/]+)\/(.*)$/);
  if (!m) return mongoose.connect(uri, { dbName: "web", bufferCommands: false });
  const [, credentials, hostname, rest] = m;
  const [dbName, qs] = rest.includes("?") ? rest.split("?") : [rest, ""];
  const params = new URLSearchParams(qs);
  if (!params.has("authSource")) params.set("authSource", "admin");
  const records = await new Promise((res, rej) =>
    dns.resolveSrv(`_mongodb._tcp.${hostname}`, (e, a) => (e ? rej(e) : res(a)))
  );
  params.set("ssl", "true");
  return mongoose.connect(
    `mongodb://${credentials}@${records.map((r) => `${r.name}:${r.port}`).join(",")}/${dbName || ""}?${params}`,
    { dbName: "web", bufferCommands: false }
  );
}

const show = async (db, label) => {
  const c = await db.collection("clinics").findOne(
    { _id: new mongoose.Types.ObjectId(ID) },
    { projection: { name: 1, slug: 1, slugLocked: 1, previousSlugs: 1, isApproved: 1, address: 1 } }
  );
  console.log(`${label}: slug=${JSON.stringify(c.slug)} locked=${c.slugLocked} approved=${c.isApproved} retired=${JSON.stringify(c.previousSlugs)}`);
  return c;
};

(async () => {
  await connectLikeApp();
  const db = mongoose.connection.db;
  const admin = await db.collection("users").findOne({ role: "admin" });
  const token = jwt.sign({ id: admin._id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "10m" });
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const before = await show(db, "BEFORE");

  // skipSeo: this run is from localhost, where NEXT_PUBLIC_BASE_URL is not the real
  // site - refresh SEO from the server instead so canonicals/sitemap use zeva360.com.
  const r = await fetch(ROUTE, { method: "POST", headers: h, body: JSON.stringify({ apply: true, clinicId: ID, skipSeo: true }) });
  const j = await r.json();
  console.log(`\napply -> HTTP ${r.status} | mode ${j.mode} | stats ${JSON.stringify(j.stats)}`);
  console.log("result:", JSON.stringify(j.results, null, 1));
  console.log("failures:", JSON.stringify(j.failures, null, 1));

  await show(db, "AFTER");

  // Does the cleaned slug now resolve through the public endpoints?
  for (const u of [
    `${BASE}/api/clinics/by-slug/sarthak`,
    `${BASE}/api/clinics/by-slug/${encodeURIComponent(before.slug)}`,
    `${BASE}/clinics/sarthak?c=${ID}`,
  ]) {
    const res = await fetch(u, { redirect: "manual" });
    const text = await res.text();
    const peek = text.startsWith("{") ? text.slice(0, 90) : `${text.length} bytes of HTML`;
    console.log(
      `GET ${u.replace(BASE, "")} -> HTTP ${res.status}${
        res.headers.get("location") ? ` | Location: ${res.headers.get("location")}` : ""
      } | ${peek}`
    );
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
