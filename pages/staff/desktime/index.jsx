// pages/staff/desktime/index.jsx
'use client';
import React from 'react';
import AgentLayout from '../../../components/AgentLayout';
import AgentDesktime from '../../../components/AgentDesktime';
import AgentDesktimeTracker from '../../../components/AgentDesktimeTracker';


const AgentDesktimeDashboard = () => {
 return (
    <>
      <AgentDesktime />
      <AgentDesktimeTracker />
    </>
  );
}

// Add layout function to the component
AgentDesktimeDashboard.getLayout = function PageLayout(page) {
  return <AgentLayout>{page}</AgentLayout>;
};

export default AgentDesktimeDashboard;
