import React from 'react';

import { APP_VERSION_LABEL } from '../../constants/version';

interface OmniGitLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function OmniGitLogo({ size = 24, showText = true, className = '' }: OmniGitLogoProps) {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Option 1 High-Saturation Vibrant Electric Cyan & Azure Sequoia Glassmorphism Logo */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 hover:scale-105"
      >
        <defs>
          {/* Smoked Obsidian Tile Gradient */}
          <linearGradient id="og-tile-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#161e2b" />
            <stop offset="100%" stopColor="#0a0d14" />
          </linearGradient>

          {/* Left O-Ring: Vibrant Electric Cyan / Aqua Glow */}
          <linearGradient id="og-cyan-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="35%" stopColor="#00f5ff" />
            <stop offset="70%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Right G-Ring: Deep Radiant Azure / Cobalt Blue */}
          <linearGradient id="og-azure-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="45%" stopColor="#3b82f6" />
            <stop offset="85%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>

          {/* Center Token Metal Gradient */}
          <linearGradient id="og-token-grad" x1="20%" y1="10%" x2="80%" y2="90%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          {/* High-Intensity Laser Glow Filter */}
          <filter id="og-vibrant-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="0.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Squircle Ceramic Baseplate & Ambient Rim */}
        <rect x="1.5" y="1.5" width="29" height="29" rx="7.5" fill="url(#og-tile-grad)" stroke="#1e2d42" strokeWidth="0.8" />
        <rect x="2.5" y="2.5" width="27" height="27" rx="6.8" fill="none" stroke="rgba(56,189,248,0.18)" strokeWidth="0.5" />

        {/* 2. Left O-Ring: Fully Saturated Electric Cyan Glass Ring */}
        <circle cx="11.8" cy="16" r="5.7" stroke="url(#og-cyan-ring)" strokeWidth="2.8" fill="none" filter="url(#og-vibrant-glow)" />
        <circle cx="11.8" cy="16" r="5.7" stroke="#ffffff" strokeWidth="0.55" strokeOpacity="0.6" fill="none" />

        {/* 3. Right G-Ring: Fully Saturated Deep Azure Cobalt Glass Ring */}
        <path
          d="M 23.3 12.2 A 5.7 5.7 0 1 0 24.2 18.5 L 18.5 18.5"
          stroke="url(#og-azure-ring)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter="url(#og-vibrant-glow)"
        />
        <path
          d="M 23.3 12.2 A 5.7 5.7 0 1 0 24.2 18.5 L 18.5 18.5"
          stroke="#ffffff"
          strokeWidth="0.55"
          strokeOpacity="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* 4. Center Git Commit Nexus Token */}
        <circle cx="15.8" cy="16" r="3.2" fill="url(#og-token-grad)" stroke="#3b82f6" strokeWidth="0.6" />
        <path d="M 15.8 18.2 V 14.5 M 15.8 16.5 C 16.6 16.5 17.5 15.8 17.5 14.8" stroke="#ffffff" strokeWidth="0.75" strokeLinecap="round" />
        <circle cx="15.8" cy="14" r="0.65" fill="#00f5ff" stroke="#ffffff" strokeWidth="0.3" />
        <circle cx="17.5" cy="14.8" r="0.65" fill="#00f5ff" stroke="#ffffff" strokeWidth="0.3" />
        <circle cx="15.8" cy="18.2" r="0.65" fill="#00f5ff" stroke="#ffffff" strokeWidth="0.3" />
      </svg>

      {showText && (
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm tracking-tight text-theme-main font-sans">
            Omni<span className="text-sky-400">Git</span>
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            {APP_VERSION_LABEL}
          </span>
        </div>
      )}
    </div>
  );
}
