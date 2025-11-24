import React, { useState } from 'react';
import JobPostingForm from "../../components/JobPostingForm";
import DoctorLayout from "../../components/DoctorLayout";
import withDoctorAuth from "../../components/withDoctorAuth";
import { jobPostingService } from "../../services/jobService";
import type { NextPageWithLayout } from "../_app";
import type { JobFormData } from "../../components/JobPostingForm";

function DoctorPostJobPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJobSubmit = async (formData: JobFormData): Promise<void> => {
    setIsSubmitting(true);
    try {
      await jobPostingService.createDoctorJob(formData); // ✅ THIS IS WHAT YOU NEED
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <JobPostingForm
      onSubmit={handleJobSubmit}
      isSubmitting={isSubmitting}
      title="Post a Job - Doctor"
      subtitle="Create a new job posting as a doctor"
    />
  );
}

DoctorPostJobPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <DoctorLayout>{page}</DoctorLayout>;
};

const ProtectedDoctorJobPage: NextPageWithLayout = withDoctorAuth(DoctorPostJobPage);
ProtectedDoctorJobPage.getLayout = DoctorPostJobPage.getLayout;

export default ProtectedDoctorJobPage;
