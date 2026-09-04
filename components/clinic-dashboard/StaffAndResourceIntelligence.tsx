import React from 'react';

interface Props {
  staffIntelligenceData?: {
    inClinic: number;
    available: number;
    withPatients: number;
    capacityAlerts: {
      doctorId: string;
      name: string;
      initials: string;
      appointmentCount: number;
      utilization: number;
    }[];
    roomData: {
      roomId: string;
      name: string;
      appointmentCount: number;
      utilization: number;
    }[];
    servicePerformance: {
      serviceId: string;
      name: string;
      count: number;
      rank: number;
    }[];
  };
}

const StaffAndResourceIntelligence = ({ staffIntelligenceData }: Props) => {
  const inClinic = staffIntelligenceData?.inClinic || 0;
  const available = staffIntelligenceData?.available || 0;
  const withPatients = staffIntelligenceData?.withPatients || 0;
  const capacityAlerts = staffIntelligenceData?.capacityAlerts || [];
  const roomData = staffIntelligenceData?.roomData || [];
  const servicePerformance = staffIntelligenceData?.servicePerformance || [];

  // Get color based on utilization
  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return 'bg-[#5C7C99]';
    if (utilization >= 50) return 'bg-[#5C7C99]';
    return 'bg-[#D4A373]';
  };

  const getAlertLabel = (index: number, utilization: number) => {
    if (index === 0 && utilization >= 80) return 'Fully booked · next 7 days';
    if (utilization < 50) return 'Under-utilized this week';
    return 'High demand';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-8 mt-6 font-sans">
      {/* Staff & Practitioner Intelligence */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">Staff & Practitioner Intelligence</h3>
          
          <div className="flex items-center gap-6 mb-8">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">In Clinic</p>
              <p className="text-xl font-bold text-gray-900">{inClinic}</p>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Available</p>
              <p className="text-xl font-bold text-gray-900">{available}</p>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">With Patients</p>
              <p className="text-xl font-bold text-gray-900">{withPatients}</p>
            </div>
          </div>

          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">Capacity Alerts</h4>
          
          <div className="flex flex-col gap-4 mb-6">
            {capacityAlerts.length > 0 ? (
              capacityAlerts.map((doctor, index) => (
                <div key={doctor.doctorId} className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#EAF1EC] text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {doctor.initials}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-0.5">{doctor.name}</p>
                      <p className="text-[11px] text-gray-500">{getAlertLabel(index, doctor.utilization)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${getUtilizationColor(doctor.utilization)}`}>
                    {doctor.utilization}%
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No capacity alerts</p>
            )}
          </div>
        </div>

        {capacityAlerts.length >= 2 && (
          <div className="bg-[#F5F4F0] rounded-lg p-3 px-4">
            <p className="text-xs text-gray-600">
              ZEVA recommends: <span className="font-bold text-emerald-700">shift eligible appointments</span> from {capacityAlerts[0]?.name?.split(' ')[0] || 'top doctor'} toward {capacityAlerts[1]?.name?.split(' ')[0] || 'another doctor'}'s available capacity.
            </p>
          </div>
        )}
      </div>

      {/* Room & Service Utilization */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Room & Service</h3>
          <h2 className="text-lg font-bold text-gray-900 mb-6">Resource Utilization</h2>
          
          <div className="flex flex-col gap-3 mb-4">
            {roomData.length > 0 ? (
              roomData.map((room) => (
                <div key={room.roomId} className="flex items-center gap-4">
                  <span className="text-xs font-medium text-gray-700 w-20 truncate">{room.name}</span>
                  <div className="flex-1 bg-[#F5F4F0] rounded-full h-2 overflow-hidden">
                    <div 
                      className={`${getUtilizationColor(room.utilization)} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${room.utilization}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-gray-900 w-16 text-right">
                    {room.appointmentCount} ({room.utilization}%)
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No rooms configured</p>
            )}
          </div>

          {roomData.length > 0 && (
            <div className="bg-[#F5F4F0] rounded-lg p-3 px-4 mb-6">
              <p className="text-[11px] text-gray-600">
                {roomData.reduce((min, room) => room.appointmentCount < min.appointmentCount ? room : min, roomData[0])?.name || 'Room'} has lowest utilization — consider redirecting appointments.
              </p>
            </div>
          )}
          
          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Service Performance</h4>
          
          <div className="grid grid-cols-2 gap-4">
            {servicePerformance.length > 0 ? (
              servicePerformance.map((service, index) => {
                // Top 2 services get green, rest get neutral
                const isTop = index < 2;
                return (
                  <div 
                    key={service.serviceId} 
                    className={`rounded-xl p-4 ${isTop ? 'bg-[#EAF1EC]' : 'bg-[#F5F4F0]'}`}
                  >
                    <p className="text-sm font-bold text-gray-900 mb-2 truncate">{service.name}</p>
                    <div className="flex items-center gap-1 mb-1">
                      <span className={`text-xl font-bold ${isTop ? 'text-emerald-700' : 'text-gray-600'}`}>
                        {service.count}
                      </span>
                      <span className="text-xs text-gray-500">bookings</span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {isTop ? 'Top performing' : `Rank #${service.rank}`}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2">
                <p className="text-sm text-gray-400 text-center py-4">No service data for selected date</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffAndResourceIntelligence;
