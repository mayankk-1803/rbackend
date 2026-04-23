import React from 'react';
import { User, Settings, LogOut, ShieldCheck, HelpCircle, ChevronRight } from 'lucide-react';

export default function Profile() {
  const menuItems = [
    { icon: Settings, label: 'Account Settings' },
    { icon: ShieldCheck, label: 'Security & Privacy' },
    { icon: HelpCircle, label: 'Help & Support' },
    { icon: LogOut, label: 'Log Out', textDanger: true }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-r from-[#6D28D9] via-[#4F46E5] to-[#3B82F6] pt-12 pb-24 px-6 shadow-md relative">
        <h1 className="text-white text-xl font-bold">My Profile</h1>
      </div>

      <div className="px-5 -mt-14 relative z-10 flex-1">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 flex flex-col items-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-inner mb-4">
            U
          </div>
          <h2 className="text-lg font-bold text-gray-800">User Account</h2>
          <p className="text-sm text-gray-500 font-medium">+91 9876543210</p>
          <div className="mt-4 px-4 py-1.5 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> KYC Verified
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {menuItems.map((item, idx) => (
            <button key={idx} className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.textDanger ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={`font-semibold text-sm ${item.textDanger ? 'text-red-500' : 'text-gray-700'}`}>{item.label}</span>
              </div>
              <ChevronRight className={`w-5 h-5 ${item.textDanger ? 'text-red-300' : 'text-gray-300'}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
