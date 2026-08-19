// Round 5: search EVERY database on the Atlas cluster for the leads
import "dotenv/config";
import mongoose from "mongoose";
import dbConnect from "../lib/database.js";

await dbConnect();

const admin = mongoose.connection.db.admin();
const dbs = await admin.listDatabases();
console.log("=== ALL DATABASES ON THE CLUSTER ===");
for (const d of dbs.databases) {
  console.log(`  ${d.name} (size: ${d.sizeOnDisk || 0} bytes)`);
}

const client = mongoose.connection.getClient();
const targetIds = [
  "6a7efbeb34640c0920602ec2",  // Dipli1 Kumar
  "6a7ef8e234640c092060243d",  // jbjbjhjhk
];

for (const dbInfo of dbs.databases) {
  const dbName = dbInfo.name;
  // Skip system DBs for performance
  if (["admin", "local", "config"].includes(dbName)) continue;
  const testDb = client.db(dbName);
  const collections = await testDb.listCollections().toArray();
  for (const collInfo of collections) {
    const coll = testDb.collection(collInfo.name);
    for (const id of targetIds) {
      try {
        const oid = new mongoose.Types.ObjectId(id);
        const doc = await coll.findOne({ _id: oid });
        if (doc) {
          console.log(`\n  ✅ FOUND ${id} in ${dbName}.${collInfo.name}`);
          console.log(`     name: ${doc.name}, status: ${doc.status}`);
          console.log(`     followUps: ${JSON.stringify(doc.followUps)}`);
        }
      } catch (e) {
        // skip
      }
    }
  }
}

await mongoose.disconnect();
process.exit(0);
