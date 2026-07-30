import React from 'react';

interface WarframeIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  showText?: boolean;
}

export function WarframeIcon({ className = "w-6 h-6", showText = false, ...props }: WarframeIconProps) {
  const viewBox = showText ? "0 0 100 118" : "0 0 100 96";
  return (
    <svg 
      viewBox={viewBox} 
      fill="currentColor" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* 1st (Outermost) Concentric Arch */}
      <path 
        d="M 50 15
           C 38 22, 24 32, 18 62
           C 25 50, 36 36, 50 20
           C 64 36, 75 50, 82 62
           C 76 32, 62 22, 50 15 Z" 
      />

      {/* 2nd Concentric Arch */}
      <path 
        d="M 50 23
           C 40 30, 28 39, 22 66
           C 29 55, 38 42, 50 28
           C 62 42, 71 55, 78 66
           C 72 39, 60 30, 50 23 Z" 
      />

      {/* 3rd Concentric Arch */}
      <path 
        d="M 50 31
           C 42 38, 32 46, 26 70
           C 33 60, 40 48, 50 36
           C 60 48, 67 60, 74 70
           C 68 46, 58 38, 50 31 Z" 
      />

      {/* 4th (Innermost) Concentric Arch / Lotus Core Bud */}
      <path 
        d="M 50 39
           C 44 46, 36 53, 30 74
           C 37 65, 42 54, 50 44
           C 58 54, 63 65, 70 74
           C 64 53, 56 46, 50 39 Z" 
      />

      {/* Left Diagonally Ascending Wing Blades (Lotus Petals pointing upwards and outwards) */}
      {/* Upper Blade */}
      <path 
        d="M 26 44
           C 20 40, 12 34, 6 26
           C 10 32, 18 36, 24 38
           C 25 40, 26 42, 26 44 Z" 
      />
      {/* Middle Blade */}
      <path 
        d="M 29 51
           C 23 47, 16 41, 10 33
           C 14 39, 21 43, 27 45
           C 28 47, 29 49, 29 51 Z" 
      />
      {/* Lower Blade */}
      <path 
        d="M 32 58
           C 26 54, 20 48, 14 40
           C 18 46, 25 50, 30 52
           C 31 54, 32 56, 32 58 Z" 
      />

      {/* Right Diagonally Ascending Wing Blades (Perfect Mirror Images pointing upwards and outwards) */}
      {/* Upper Blade */}
      <path 
        d="M 74 44
           C 80 40, 88 34, 94 26
           C 90 32, 82 36, 76 38
           C 75 40, 74 42, 74 44 Z" 
      />
      {/* Middle Blade */}
      <path 
        d="M 71 51
           C 77 47, 84 41, 90 33
           C 86 39, 79 43, 73 45
           C 72 47, 71 49, 71 51 Z" 
      />
      {/* Lower Blade */}
      <path 
        d="M 68 58
           C 74 54, 80 48, 86 40
           C 82 46, 75 50, 70 52
           C 69 54, 68 56, 68 58 Z" 
      />

      {/* Futuristic Geometric 'WARFRAME' Wordmark */}
      {showText && (
        <text
          x="50"
          y="110"
          textAnchor="middle"
          fill="currentColor"
          fontFamily="'Orbitron', sans-serif"
          fontWeight="bold"
          fontSize="10"
          letterSpacing="0.4em"
          className="tracking-[0.4em] font-bold"
        >
          WARFRAME
        </text>
      )}
    </svg>
  );
}

