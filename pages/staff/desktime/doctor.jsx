// pages/staff/desktime/doctor.jsx
'use client';
import React from 'react';
import AgentLayout from '../../../components/AgentLayout';
import DoctorDesktime from '../../../components/DoctorDesktime';
import DoctorDesktimeTracker from '../../../components/DoctorDesktimeTracker';

const DoctorDesktimeDashboard = () => {
  return (
    <>
      <DoctorDesktimeTracker />
      <DoctorDesktime />
    </>
  );
}

// Add layout function to the component
DoctorDesktimeDashboard.getLayout = function PageLayout(page) {
  return <AgentLayout>{page}</AgentLayout>;
};

export default DoctorDesktimeDashboard;