import React from "react";

interface CircuitCartWordmarkProps {
  className?: string;
}

export function CircuitCartWordmark({ className = "" }: CircuitCartWordmarkProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        width="26"
        height="22"
        viewBox="0 0 28 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-[#201524] size-6 shrink-0"
        aria-hidden="true"
      >
        {/* Circuit traces extending to left */}
        <path d="M2 5H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="2" cy="5" r="1.5" fill="currentColor" />
        <path d="M2 11H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="2" cy="11" r="1.5" fill="currentColor" />
        <path d="M2 17H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="2" cy="17" r="1.5" fill="currentColor" />
        {/* Monitor Screen Body */}
        <rect x="9" y="3" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
        {/* Stand & Base */}
        <path d="M17 16V19M13 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-2xl font-bold tracking-tight text-[#201524]">
        CircuitCart
      </span>
    </div>
  );
}
