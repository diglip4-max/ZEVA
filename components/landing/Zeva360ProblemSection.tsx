import React from "react";
import { Calendar, UserX, FileText, ClipboardList } from "lucide-react";

const Zeva360ProblemSection: React.FC = () => {
  const problems = [
    {
      icon: Calendar,
      iconBg: "bg-pink-500",
      title: "Missed Appointments",
    },
    {
      icon: UserX,
      iconBg: "bg-orange-500",
      title: "No Follow-Ups",
    },
    {
      icon: FileText,
      iconBg: "bg-purple-500",
      title: "Billing Errors",
    },
    {
      icon: ClipboardList,
      iconBg: "bg-blue-500",
      title: "Too Much Paperwork",
    },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-10">
          Why Most Clinics Lose{" "}
          <span className="text-orange-500">₹50,000+</span>{" "}
          Every Month
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-md hover:shadow-lg transition-all"
            >
              <div className={`w-10 h-10 ${problem.iconBg} rounded-lg flex items-center justify-center mb-3 mx-auto`}>
                <problem.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-gray-800">{problem.title}</p>
            </div>
          ))}
        </div>

        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-900 text-white rounded-full text-sm font-semibold shadow-lg">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>All with Automated WhatsApp Reminders & Smart Billing</span>
        </div>
      </div>
    </section>
  );
};

export default Zeva360ProblemSection;
