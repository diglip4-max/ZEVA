// components/CreateJobModal.tsx
import React, { useState } from 'react';
import JobPostingForm, { JobFormData } from './JobPostingForm';
import { jobPostingService } from '../services/jobService';
import { X } from 'lucide-react';

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated?: () => void;
  canCreate: boolean;
}

const CreateJobModal: React.FC<CreateJobModalProps> = ({
  isOpen,
  onClose,
  onJobCreated,
  canCreate,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJobSubmit = async (formData: JobFormData): Promise<void> => {
    if (!canCreate) {
      throw new Error("You do not have permission to create jobs");
    }

    setIsSubmitting(true);
    try {
      await jobPostingService.createClinicJob(formData);
      if (onJobCreated) {
        onJobCreated();
      }
      onClose();
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create New Job</h2>
            <p className="text-sm text-gray-600 mt-1">Fill in the details to post a new job</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content - Scrolled area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <JobPostingForm
              onSubmit={handleJobSubmit}
              isSubmitting={isSubmitting}
              title="Create New Job"
              subtitle="Fill in the details to post a new job"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateJobModal;

 