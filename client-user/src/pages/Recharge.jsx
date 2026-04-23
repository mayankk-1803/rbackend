import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smartphone, Tv, Zap, Droplets, Flame, Wifi, Landmark } from 'lucide-react';

const rechargeTypes = [
  { type: 'Mobile', path: '/recharge/mobile', icon: Smartphone, desc: 'Mobile prepaid/postpaid bills' },
  { type: 'DTH', path: '/recharge/dth', icon: Tv, desc: 'Direct-to-Home television' },
  { type: 'Electricity', path: '/recharge/electricity', icon: Zap, desc: 'Electricity bill payments' },
  { type: 'Water', path: '/recharge/water', icon: Droplets, desc: 'Water bill payments' },
  { type: 'Gas', path: '/recharge/gas', icon: Flame, desc: 'PNG & LPG gas bills' },
  { type: 'Broadband', path: '/recharge/broadband', icon: Wifi, desc: 'Internet service bills' },
  { type: 'Loan', path: '/recharge/loan', icon: Landmark, desc: 'Loan EMI payments' },
];

export default function Recharge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E5E7EB] bg-[#F8FAFC]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Recharge & Bill Payment</h2>
          <p className="text-sm text-[#64748B] mt-1">Select a service to make payment</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rechargeTypes.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.type}
                  to={item.path}
                  className="group flex items-center gap-4 p-4 border border-[#E5E7EB] rounded-lg hover:border-[#6D28D9] hover:bg-[#F8FAFC] transition-all"
                >
                  <div className="w-12 h-12 bg-[#F3F4F6] group-hover:bg-[#6D28D9] rounded-lg flex items-center justify-center transition-colors">
                    <Icon className="w-6 h-6 text-[#6D28D9] group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0F172A]">{item.type}</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">{item.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
