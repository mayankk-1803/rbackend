import React, { useState, useEffect } from "react";

export const ProviderToggle = ({ checked, onChange, disabled }) => {
  const [localChecked, setLocalChecked] = useState(checked);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setLocalChecked(checked);
  }, [checked]);

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (disabled || pending) return;

    const nextState = !localChecked;
    setLocalChecked(nextState); // Optimistic Update
    setPending(true);

    try {
      await onChange(nextState);
    } catch (err) {
      // Optimistic Rollback on error
      setLocalChecked(!nextState);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled || pending}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed ${
        localChecked ? "bg-[var(--color-primary)]" : "bg-[var(--text-muted)]/30"
      }`}
    >
      <span className="sr-only">Toggle state</span>
      <span
        pointerEvents="none"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[var(--bg-primary)] shadow ring-0 transition duration-200 ease-in-out ${
          localChecked ? "translate-x-5" : "translate-x-0"
        } ${pending ? "animate-pulse" : ""}`}
      />
    </button>
  );
};

export default ProviderToggle;
