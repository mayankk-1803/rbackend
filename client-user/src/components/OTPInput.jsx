import React, { useRef, useEffect } from 'react';

export default function OTPInput({ value, onChange, length = 6, error = false, color = "purple" }) {
  const inputs = useRef([]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (inputs.current[0]) {
      inputs.current[0].focus();
    }
  }, []);

  const handleChange = (e, index) => {
    const val = e.target.value;
    // Allow only numbers
    if (val && !/^\d+$/.test(val)) return;

    const newValue = value.split('');
    // Handle single digit change
    newValue[index] = val.slice(-1);
    const combinedValue = newValue.join('');
    onChange(combinedValue);

    // Auto-focus next input
    if (val && index < length - 1) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    // Handle backspace navigation
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        inputs.current[index - 1].focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const data = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!data) return;
    
    onChange(data);
    
    // Focus last filled input or next empty
    const nextIndex = Math.min(data.length, length - 1);
    if (inputs.current[nextIndex]) {
      inputs.current[nextIndex].focus();
    }
  };

  const focusClass = color === "cyan" 
    ? "focus:border-cyan-500 focus:ring-cyan-500/10" 
    : "focus:border-purple-500 focus:ring-purple-500/10";

  return (
    <div className="flex gap-2 sm:gap-3 justify-between">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="tel"
          maxLength="1"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={value[i] || ''}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKeyDown(e, i)}
          onPaste={handlePaste}
          className={`w-full h-12 sm:h-14 bg-slate-50 border ${
            error 
              ? 'border-rose-300 ring-2 ring-rose-500/10 text-rose-600' 
              : `border-slate-200 ${focusClass} text-slate-900`
          } rounded-xl sm:rounded-2xl text-center text-xl font-black transition-all outline-none shadow-sm`}
        />
      ))}
    </div>
  );
}
