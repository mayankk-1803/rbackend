import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import gsap from "gsap";

const ThemeSelector = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const toggleDropdown = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (isOpen) {
        gsap.killTweensOf(menuRef.current);
        gsap.set(menuRef.current, { display: "block", opacity: 0, scale: 0.95, y: -10 });
        
        gsap.to(menuRef.current, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.25,
          ease: "power2.out",
        });

        gsap.fromTo(
          menuRef.current.querySelectorAll(".theme-option"),
          { opacity: 0, x: -5 },
          { opacity: 1, x: 0, stagger: 0.04, duration: 0.2, ease: "power2.out", delay: 0.05 }
        );
      } else {
        gsap.killTweensOf(menuRef.current);
        gsap.to(menuRef.current, {
          opacity: 0,
          scale: 0.95,
          y: -10,
          duration: 0.15,
          ease: "power2.in",
          onComplete: () => {
            if (menuRef.current) menuRef.current.style.display = "none";
          },
        });
      }
    }, dropdownRef);

    return () => ctx.revert();
  }, [isOpen]);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    setIsOpen(false);

    const icon = buttonRef.current.querySelector(".theme-icon");
    if (icon) {
      gsap.fromTo(
        icon,
        { rotate: 0, scale: 0.8 },
        { rotate: 360, scale: 1, duration: 0.4, ease: "power2.out" }
      );
    }
  };

  const getThemeIcon = (t) => {
    switch (t) {
      case "light":
        return <Sun className="w-4 h-4 theme-icon text-amber-500" />;
      case "dark":
        return <Moon className="w-4 h-4 theme-icon text-[var(--color-primary)]" />;
      default:
        return <Monitor className="w-4 h-4 theme-icon text-[var(--text-secondary)]" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-primary)] transition-all duration-150 cursor-pointer text-xs"
      >
        <span className="flex items-center justify-center">
          {getThemeIcon(theme === "system" ? resolvedTheme : theme)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider hidden sm:inline text-[var(--text-primary)]">
          {theme}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <div
        ref={menuRef}
        className="absolute right-0 mt-2 w-36 rounded-xl border border-[var(--border-soft)] bg-[var(--card-bg)] shadow-[var(--shadow-medium)] backdrop-blur-md z-50 py-1"
        style={{ display: "none" }}
      >
        {[
          { key: "dark", label: "Dark", icon: <Moon className="w-4 h-4 text-[var(--color-primary)]" /> },
          { key: "light", label: "Light", icon: <Sun className="w-4 h-4 text-amber-500" /> },
          { key: "system", label: "System", icon: <Monitor className="w-4 h-4 text-[var(--text-secondary)]" /> },
        ].map((opt) => {
          const isSelected = theme === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => handleThemeChange(opt.key)}
              className={`theme-option flex items-center justify-between w-[calc(100%-8px)] mx-1 my-0.5 px-2.5 py-1.5 rounded-lg text-left text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                isSelected
                  ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--border-soft)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
              }`}
            >
              <div className="flex items-center gap-2">
                {opt.icon}
                <span>{opt.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSelector;
