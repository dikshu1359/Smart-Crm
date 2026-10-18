import React from 'react';

/**
 * DashboardAnimatedBackground
 * Extends the landing page visual language (subtle floating geometric shapes:
 * circles, rounded squares, triangles, rotating polygons, and ambient glow orbs)
 * across Admin, Teacher, and Student internal dashboard views.
 *
 * Characteristics:
 * - pointer-events-none, z-0 (behind all interactive page content)
 * - Complementary colors: purple, pink, cyan with low ambient opacity
 * - Excluded from print layout (@media print)
 * - Respects prefers-reduced-motion
 */
export const DashboardAnimatedBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="animated-bg-layer pointer-events-none fixed inset-0 overflow-hidden z-0 select-none no-print print:hidden"
    >
      {/* Ambient Radial Color Glows */}
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-purple-600/12 blur-[120px] pulse-ambient" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-pink-600/10 blur-[130px] pulse-ambient" />
      <div className="absolute bottom-10 left-1/4 w-80 h-80 rounded-full bg-cyan-600/10 blur-[130px] pulse-ambient" />

      {/* Floating Circles */}
      <div className="absolute top-20 left-[10%] w-12 h-12 rounded-full border border-purple-500/20 bg-purple-500/5 float-drift-1" />
      <div className="absolute top-72 right-[12%] w-16 h-16 rounded-full border border-pink-500/20 bg-pink-500/5 float-drift-2" />
      <div className="absolute bottom-32 left-[14%] w-10 h-10 rounded-full border border-cyan-400/20 bg-cyan-400/5 float-drift-3" />

      {/* Floating Squares & Diamonds */}
      <div className="absolute top-40 right-[25%] w-9 h-9 rounded-xl border border-pink-400/20 bg-pink-400/5 rotate-12 float-drift-2" />
      <div className="absolute top-[480px] left-[6%] w-8 h-8 rounded-lg border border-purple-400/20 bg-purple-400/5 -rotate-6 float-drift-1" />
      <div className="absolute bottom-60 right-[18%] w-11 h-11 rounded-2xl border border-cyan-400/15 bg-cyan-400/5 rotate-45 float-drift-3" />

      {/* Geometric Floating Triangles (SVG) */}
      <div className="absolute top-32 left-[28%] w-8 h-8 opacity-25 float-drift-3">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50 15, 88 85, 12 85" stroke="#A855F7" strokeWidth="4" fill="rgba(168, 85, 247, 0.08)" />
        </svg>
      </div>

      <div className="absolute top-[600px] right-[8%] w-10 h-10 opacity-25 float-drift-1 rotate-45">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50 15, 88 85, 12 85" stroke="#EC4899" strokeWidth="4" fill="rgba(236, 72, 153, 0.08)" />
        </svg>
      </div>

      <div className="absolute bottom-24 left-[35%] w-7 h-7 opacity-20 float-drift-2 rotate-180">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50 15, 88 85, 12 85" stroke="#06B6D4" strokeWidth="4" fill="rgba(6, 182, 212, 0.08)" />
        </svg>
      </div>

      {/* Subtle Micro Floating Particles */}
      <div className="absolute top-28 left-[45%] w-2 h-2 rounded-full bg-purple-400/30 float-drift-2" />
      <div className="absolute top-80 right-[35%] w-1.5 h-1.5 rounded-full bg-pink-400/35 float-drift-1" />
      <div className="absolute top-[520px] left-[22%] w-2 h-2 rounded-full bg-cyan-400/30 float-drift-3" />
      <div className="absolute bottom-40 right-[30%] w-2.5 h-2.5 rounded-full bg-purple-400/25 float-drift-1" />
    </div>
  );
};

export default DashboardAnimatedBackground;
