import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

export const DropdownPortal = ({
  isOpen,
  onClose,
  triggerRef,
  children,
  align = "right",
  className = ""
}) => {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const portalRef = useRef(null);

  const updateCoords = () => {
    if (triggerRef && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = portalRef.current ? portalRef.current.offsetWidth : 208;
      
      // Calculate vertical position
      let top = rect.bottom + window.scrollY;
      
      // Check if menu goes off screen vertically, and flip it upwards if needed
      const menuHeight = portalRef.current ? portalRef.current.offsetHeight : 250;
      if (rect.bottom + menuHeight > window.innerHeight && rect.top - menuHeight > 0) {
        top = rect.top + window.scrollY - menuHeight;
      }

      // Calculate horizontal position
      let left = rect.left + window.scrollX;
      if (align === "right") {
        left = rect.right + window.scrollX - menuWidth;
      }

      setCoords({ top, left });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();

      // Ensure position is correct after render cycle
      const frameId = requestAnimationFrame(updateCoords);

      const handleScroll = () => {
        updateCoords();
      };

      const handleResize = () => {
        updateCoords();
      };

      const handleOutsideClick = (e) => {
        if (
          (triggerRef && triggerRef.current && triggerRef.current.contains(e.target)) ||
          (portalRef.current && portalRef.current.contains(e.target))
        ) {
          return;
        }
        onClose();
      };

      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
        document.removeEventListener("mousedown", handleOutsideClick);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, triggerRef, align, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      ref={portalRef}
      style={{
        position: "absolute",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
      className={`z-[99999] pointer-events-auto ${className}`}
    >
      {children}
    </div>,
    document.body
  );
};

export default DropdownPortal;
