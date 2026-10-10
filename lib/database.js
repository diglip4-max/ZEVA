import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
dotenv.config();

// Fix: Node.js v24 on Windows can't resolve DNS SRV records locally.
// Use Google/Cloudflare DNS so we can manually resolve mongodb+srv:// SRV records.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const MONGODB_URI = process.env.MONGODB_URI;
console.log("mongo uri", MONGODB_URI?.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in your .env");
}

global.mongoose = global.mongoose || { conn: null, promise: null };
let cached = global.mongoose;

/**
 * Manually resolve mongodb+srv:// to a direct mongodb:// URI.
 * This bypasses the broken Node.js DNS SRV resolver on Windows.
 */
async function resolveSrvUri(uri) {
  if (!uri.startsWith('mongodb+srv://')) return uri;

  // Parse: mongodb+srv://user:pass@host/db?params
  const match = uri.match(/^mongodb\+srv:\/\/([^@]+)@([^/]+)\/(.*)$/);
  if (!match) return uri;

  const [_, credentials, hostname, rest] = match;
  const [dbName, queryString] = rest.includes('?') ? rest.split('?') : [rest, ''];
  const params = new URLSearchParams(queryString);

  // Ensure authSource
  if (!params.has('authSource')) params.set('authSource', 'admin');

  // Resolve SRV records via Google DNS
  const srvHost = `_mongodb._tcp.${hostname}`;
  const records = await new Promise((resolve, reject) => {
    dns.resolveSrv(srvHost, (err, addrs) => err ? reject(err) : resolve(addrs));
  });

  const hosts = records.map(r => `${r.name}:${r.port}`).join(',');

  // Resolve TXT records for additional options
  let txtParams = {};
  try {
    const txtRecords = await new Promise((resolve) => {
      dns.resolveTxt(hostname, (err, records) => resolve(err ? [] : records));
    });
    for (const record of txtRecords) {
      const str = record.join('');
      const [key, val] = str.split('=', 2);
      if (key && val) txtParams[key] = val;
    }
  } catch (_) {}

  // Merge: explicit params take precedence over TXT params
  const finalParams = new URLSearchParams({ ...txtParams, ...Object.fromEntries(params) });
  finalParams.set('ssl', 'true');
  finalParams.set('retryWrites', 'true');

  const resolved = `mongodb://${credentials}@${hosts}/${dbName}?${finalParams.toString()}`;
  console.log("🔍 SRV resolved to:", hosts);
  return resolved;
}

async function dbConnect() {
  if (cached.conn) {
    if (cached.conn.connection.db.databaseName !== "web") {
      console.log("⚠️ Connected to wrong database, reconnecting...");
      await mongoose.disconnect();
      cached.conn = null;
      cached.promise = null;
    } else {
      return cached.conn;
    }
  }

  if (!cached.promise) {
    console.log("🟡 Connecting to MongoDB...");

    cached.promise = (async () => {
      // Manually resolve SRV if needed (bypasses broken Node.js SRV on Windows)
      const resolvedUri = await resolveSrvUri(MONGODB_URI);
      const uri = resolvedUri.includes("?") ? resolvedUri : `${resolvedUri}?authSource=admin`;
      console.log("🔗 Connection URI:", uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));

      return mongoose.connect(uri, {
        bufferCommands: false,
        dbName: "web",
      });
    })().then((mongoose) => {
      console.log("✅ MongoDB connected successfully!");
      console.log("📍 Connected to database:", mongoose.connection.db.databaseName);
      return mongoose;
    }).catch(err => {
      console.error("❌ MongoDB connection error:", err);
      cached.promise = null;
      throw err;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;


// import mongoose from "mongoose";

// const MONGODB_URI = process.env.MONGODB_URI;
// if (!MONGODB_URI) throw new Error("Please define MONGODB_URI in .env");

// let cached = global.mongoose;
// if (!cached) cached = global.mongoose = { conn: null, promise: null };

// async function dbConnect() {
//   if (cached.conn) return cached.conn;

//   if (!cached.promise) {
//     console.log("🟡 Connecting to MongoDB...");
//     const uri = MONGODB_URI.includes("?") ? MONGODB_URI : `${MONGODB_URI}?authSource=admin`;

//     cached.promise = mongoose.connect(uri, {
//       dbName: "web",
//       bufferCommands: false,
//     }).then((mongoose) => {
//       console.log("✅ MongoDB connected successfully!");
//       return mongoose;
//     }).catch(err => {
//       cached.promise = null; // allow retry
//       console.error("❌ MongoDB connection error:", err);
//       throw err;
//     });
//   }

//   cached.conn = await cached.promise;
//   return cached.conn;
// }

// export default dbConnect;
