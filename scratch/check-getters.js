const path = require("path");
const mongoose = require("mongoose");
const PettyCash = require("../models/PettyCash").default;

try {
  require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
} catch (_) {}
try {
  require("dotenv").config();
} catch (_) {}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/zeva";

async function run() {
  await mongoose.connect(MONGODB_URI);
  
  const clinicId = "68909b31faa98f63e97e3d1b";
  
  const globalPettyCash = await PettyCash.findOne({ 
    clinicId: new mongoose.Types.ObjectId(clinicId), 
    staffId: null 
  }).select("globalSpentAmount").lean({ getters: true });

  console.log("globalPettyCash:", globalPettyCash);
  if (globalPettyCash) {
    console.log("Type of globalSpentAmount:", typeof globalPettyCash.globalSpentAmount);
    console.log("Constructor name:", globalPettyCash.globalSpentAmount?.constructor?.name);
    console.log("Value:", globalPettyCash.globalSpentAmount);
  }

  await mongoose.disconnect();
}

run();
