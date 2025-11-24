// services/jobService.ts
import axios from "axios";
import type { JobFormData } from "../components/JobPostingForm";

export interface JobPayload
  extends Omit<
    JobFormData,
    "skills" | "perks" | "languagesPreferred" | "noOfOpenings"
  > {
  skills: string[];
  perks: string[];
  languagesPreferred: string[];
  noOfOpenings: number;
}

// Different role-based API configurations
export const jobApiConfig = {
  clinic: {
    endpoint: "/api/job-postings/create",
    tokenKey: "clinicToken",
  },
  doctor: {
    endpoint: "/api/job-postings/doctor-create-job",
    tokenKey: "doctorToken",
  },
  hospital: {
    endpoint: "/api/hospital/job-postings/create",
    tokenKey: "hospitalToken",
  },
  admin: {
    endpoint: "/api/admin/job-postings/create",
    tokenKey: "adminToken",
  },
} as const;

export type UserRole = keyof typeof jobApiConfig;

// Generic job posting service
export const jobPostingService = {
  async createJob(formData: JobFormData, role: UserRole): Promise<void> {
    const config = jobApiConfig[role];
    const token = localStorage.getItem(config.tokenKey);
    console.log("Creating job with config:", config);
    console.log("Form data:", token);

    if (!token) {
      throw new Error("Authentication token not found. Please login again.");
    }

    // Transform form data to API payload
    const payload: JobPayload = {
      ...formData,
      skills: formData.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      perks: formData.perks
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      languagesPreferred: formData.languagesPreferred
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
      noOfOpenings: parseInt(formData.noOfOpenings) || 1,
    };

    try {
      const response = await axios.post(config.endpoint, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage =
          error.response?.data?.message || "Failed to create job posting";
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  // Role-specific convenience methods
  async createClinicJob(formData: JobFormData): Promise<void> {
    return this.createJob(formData, "clinic");
  },

  async createDoctorJob(formData: JobFormData): Promise<void> {
    return this.createJob(formData, "doctor");
  },

  async createHospitalJob(formData: JobFormData): Promise<void> {
    return this.createJob(formData, "hospital");
  },

  async createAdminJob(formData: JobFormData): Promise<void> {
    return this.createJob(formData, "admin");
  },
};
