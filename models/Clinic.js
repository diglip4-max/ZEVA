// models/Clinic.ts
import mongoose from "mongoose";
import { TreatmentRefSchema } from "../schema/TreatmentRef";

const ClinicSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: String,
    address: String,
    treatments: { type: [TreatmentRefSchema], default: [] }, // subTreatments now include price
    servicesName: { type: [String], default: [] },
    pricing: String,
    timings: {
      type: [
        new mongoose.Schema(
          {
            day: {
              type: String,
              enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
              required: true,
            },
            isOpen:      { type: Boolean, default: false },
            openingTime: { type: String, default: '09:00 AM' },
            closingTime: { type: String, default: '06:00 PM' },
            breakStart:  { type: String, default: '01:00 PM' },
            breakEnd:    { type: String, default: '02:00 PM' },
          },
          { _id: false }
        ),
      ],
      default: [
        { day: 'Monday',    isOpen: true,  openingTime: '09:00 AM', closingTime: '06:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
        { day: 'Tuesday',   isOpen: true,  openingTime: '09:00 AM', closingTime: '06:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
        { day: 'Wednesday', isOpen: false, openingTime: '09:00 AM', closingTime: '06:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
        { day: 'Thursday',  isOpen: false, openingTime: '09:00 AM', closingTime: '06:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
        { day: 'Friday',    isOpen: false, openingTime: '09:00 AM', closingTime: '06:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
        { day: 'Saturday',  isOpen: false, openingTime: '09:00 AM', closingTime: '06:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
        { day: 'Sunday',    isOpen: false, openingTime: '09:00 AM', closingTime: '06:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
      ],
    },
    photos: [String],
    licenseDocumentUrl: { type: String, default: null },
    documents: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, required: true, trim: true },
            url: { type: String, required: true, trim: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    tagline: { type: String, default: "" },
    description: { type: String, default: "" },
    phone: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    email: { type: String, default: "" },
    website: { type: String, default: "" },
    isApproved: { type: Boolean, default: false },
    declined: { type: Boolean, default: false },
    slug: { 
      type: String, 
      unique: true, 
      sparse: true, // Only unique when exists
      index: true 
    },
    slugLocked: { type: Boolean, default: false }, // Lock slug once approved
    otpWhatsAppNumber: { type: String, default: null },
    otpEmail: { type: String, default: null },
    listingVisibility: {
      showServices:       { type: Boolean, default: true },
      showPrices:         { type: Boolean, default: true },
      showStaff:          { type: Boolean, default: true },
      showReviews:        { type: Boolean, default: true },
      enableOnlineBooking:{ type: Boolean, default: true },
      featuredListing:    { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

ClinicSchema.index({ location: "2dsphere" });
ClinicSchema.index({
  "treatments.mainTreatmentSlug": 1,
  "treatments.subTreatmentSlug": 1,
});



if (mongoose.models.Clinic) {
  delete mongoose.models.Clinic;
}
export default mongoose.model("Clinic", ClinicSchema);
