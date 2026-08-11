const path = require("path");
const mongoose = require("mongoose");

try {
  require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
} catch (_) {}
try {
  require("dotenv").config();
} catch (_) {}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/zeva";

async function run() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const start = new Date("2026-08-11T00:00:00.000Z");
  const end = new Date("2026-08-11T23:59:59.999Z");

  const countToday = await db.collection("billings").countDocuments({
    invoicedDate: { $gte: start, $lte: end },
    $or: [
      { paymentMethod: "Cash" },
      { "multiplePayments.paymentMethod": "Cash" }
    ]
  });
  console.log("Cash Billings on 2026-08-11:", countToday);

  // Find the most recent cash billing date
  const mostRecent = await db.collection("billings")
    .find({
      $or: [
        { paymentMethod: "Cash" },
        { "multiplePayments.paymentMethod": "Cash" }
      ]
    })
    .sort({ invoicedDate: -1 })
    .limit(1)
    .toArray();
  
  console.log("Most recent cash billing date in db:", mostRecent[0]?.invoicedDate);

  await mongoose.disconnect();
}

run();
