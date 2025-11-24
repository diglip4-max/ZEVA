import React, { useState } from 'react';
import axios from 'axios';

const CreateAgentModal = ({ isOpen, onClose, onCreated, token, doctorToken, adminToken }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('agent'); // Default to agent
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  // Determine which token to use: priority should match the actual logged-in user context
  // Priority: clinic/agent token (token) > doctorToken > adminToken
  const authToken = token || doctorToken || adminToken || null;
  
  if (!authToken) {
    console.error('No authentication token provided');
    return null;
  }
  
  // Debug: Log which token is being used
  console.log('CreateAgentModal - Token used:', {
    hasClinicOrAgentToken: !!token,
    hasDoctorToken: !!doctorToken,
    hasAdminToken: !!adminToken,
    usingToken: token ? 'clinic/agent token' : doctorToken ? 'doctorToken' : 'adminToken'
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !email || !password || !role) return;
    setSubmitting(true);
    try {
      const { data } = await axios.post(
        '/api/lead-ms/create-agent',
        { name, email, phone, password, role },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (data?.success) {
        setName(''); setEmail(''); setPhone(''); setPassword(''); setRole('agent');
        onCreated?.();
        onClose?.();
      } else {
        alert(data?.message || 'Failed to create user');
      }
    } catch (err) {
      if (err.response?.data?.message) {
        alert(err.response.data.message);
      } else {
        alert('Failed to create user');
      }
      console.error('Create user error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  // Show role selector only if adminToken is present (admin can create both agent and doctorStaff)
  const showRoleSelector = !!adminToken;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-medium text-gray-900">Create {role === 'doctorStaff' ? 'Doctor Staff' : 'Agent'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100" aria-label="Close">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4">
          <div className="grid grid-cols-1 gap-3">
            {showRoleSelector && (
              <div>
                <label className="block text-sm text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none"
                >
                  <option value="agent">Agent</option>
                  <option value="doctorStaff">Doctor Staff</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-700 mb-1">Full name <span className="text-red-500">*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'doctorStaff' ? 'Staff name' : 'Agent name'} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Email address <span className="text-red-500">*</span></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={role === 'doctorStaff' ? 'staff@example.com' : 'agent@example.com'} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Phone number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" required className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-3.5 py-2 bg-gray-900 hover:bg-black text-white text-sm rounded-md">{submitting ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAgentModal;


