/**
 * Quick script to get clinic ID from database
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import dbConnect from "../lib/database.js";
import Clinic from "../models/Clinic.js";

dotenv.config({ path: "../.env" });

async function getClinicId() {
  try {
    await dbConnect();
    const clinics = await Clinic.find({}).select("_id name").limit(5);
    console.log("Available clinics:");
    clinics.forEach((c) => {
      console.log(`  ID: ${c._id} | Name: ${c.name || "Unnamed"}`);
    });
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

getClinicId();
