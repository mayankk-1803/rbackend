import React, { memo, useState } from "react";
import { RadioTower } from "lucide-react";
import { getOperatorLogo } from "../config/operators";

const accentClasses = {
  cyan: {
    text: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/20"
  },
  purple: {
    text: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/20"
  }
};

function OperatorLogo({ operator, accent = "cyan", className = "", imageClassName = "h-[26px] w-[26px]" }) {
  const [failedSrc, setFailedSrc] = useState("");
  const logoSrc = getOperatorLogo(operator);
  const styles = accentClasses[accent] || accentClasses.cyan;
  const failed = Boolean(logoSrc && failedSrc === logoSrc);

  if (logoSrc && !failed) {
    return (
      <img
        src={logoSrc}
        alt=""
        className={`${imageClassName} max-h-full max-w-full object-contain`}
        draggable="false"
        decoding="async"
        loading="lazy"
        width="26"
        height="26"
        onError={() => setFailedSrc(logoSrc)}
      />
    );
  }

  return (
    <span
      className={`flex h-[26px] w-[26px] items-center justify-center rounded-full border ${styles.border} ${styles.bg} ${styles.text} ${className}`}
      aria-hidden="true"
    >
      <RadioTower className="h-4 w-4" />
    </span>
  );
}

export default memo(OperatorLogo);
