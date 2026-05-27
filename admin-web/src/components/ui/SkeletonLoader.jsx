import React from 'react';

export const SkeletonLoader = ({
  variant = 'text', // 'text', 'circle', 'rect', 'card', 'table'
  count = 1,
  className = '',
  height,
  width
}) => {
  const styles = {
    height: height || undefined,
    width: width || undefined
  };

  const getShapeClass = () => {
    switch (variant) {
      case 'circle':
        return 'rounded-full';
      case 'rect':
        return 'rounded-xl';
      case 'card':
        return 'rounded-2xl h-32';
      default:
        return 'rounded h-4';
    }
  };

  const items = Array.from({ length: count });

  if (variant === 'table') {
    return (
      <div className="w-full space-y-4 animate-pulse">
        <div className="h-6 bg-[var(--bg-secondary)] rounded-md w-full" />
        <div className="h-0.5 bg-[var(--border-soft)] w-full" />
        {items.map((_, idx) => (
          <div key={idx} className="flex gap-4 items-center">
            <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/4" />
            <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/4" />
            <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/4" />
            <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((_, idx) => (
        <div
          key={idx}
          style={styles}
          className={`bg-[var(--bg-secondary)] animate-pulse w-full ${getShapeClass()} ${className}`}
        />
      ))}
    </div>
  );
};
