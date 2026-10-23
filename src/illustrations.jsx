import React from "react";

// ─── NeuroIntent Brand Emblem (Compact, Vibrant) ───────────────────────────
export function NeuroBrandEmblem({ className = "w-6 h-6", active = true }) {
  return (
    <div className={`relative flex items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-500 text-white p-1 shadow-sm shrink-0 ${className}`}>
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 6c-3.2 0-5.8 1.8-6.3 4.6-1.5.3-2.7 1.6-2.7 3.4 0 1.2.6 2.2 1.5 2.8C8 18.2 8 19.6 9.2 21c1.2 1.6 3 2.2 4.8 2.2H16" stroke="#BAE6FD" />
        <path d="M16 6c3.2 0 5.8 1.8 6.3 4.6 1.5.3 2.7 1.6 2.7 3.4 0 1.2-.6 2.2-1.5 2.8C24 18.2 24 19.6 22.8 21c-1.2 1.6-3 2.2-4.8 2.2H16" stroke="#FFFFFF" />
        <path d="M16 9v12" stroke="#E0F2FE" strokeDasharray="2 2" />
        <circle cx="16" cy="11" r="1.4" fill="#38BDF8" stroke="none" />
        <circle cx="12" cy="15" r="1.4" fill="#F472B6" stroke="none" />
        <circle cx="20" cy="15" r="1.4" fill="#34D399" stroke="none" />
        <circle cx="16" cy="19" r="1.4" fill="#FBBF24" stroke="none" />
      </svg>
      {active && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-white" />
      )}
    </div>
  );
}

// ─── Cohesive, Colorful & High-Quality Category Illustrations ───────────────
export function CategoryIllustration({ id, className = "w-16 h-16" }) {
  switch (id) {
    case "most_needed":
      return (
        <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="50" height="50" rx="16" fill="#FEF3C7" />
          <path d="M28 13l4.5 9.2 10.1 1.5-7.3 7.1 1.7 10.1L28 36.2l-9 4.7 1.7-10.1-7.3-7.1 10.1-1.5L28 13z" fill="#F59E0B" stroke="#D97706" strokeWidth="2.5" />
        </svg>
      );

    case "water":
      return (
        <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="50" height="50" rx="16" fill="#E0F2FE" />
          <path d="M28 13c-5.5 7.5-11 13.5-11 20a11 11 0 1 0 22 0c0-6.5-5.5-12.5-11-20z" fill="#38BDF8" stroke="#0284C7" strokeWidth="2.5" />
          <path d="M23 33.5c1.2 2.8 4.2 4.5 7.5 4.5" stroke="#BAE6FD" strokeWidth="2.2" />
          <circle cx="32" cy="28" r="2" fill="#FFFFFF" />
        </svg>
      );

    case "food":
      return (
        <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="50" height="50" rx="16" fill="#FFEDD5" />
          <path d="M14 31c0 8.5 6.5 14 14 14s14-5.5 14-14H14z" fill="#FB923C" stroke="#EA580C" strokeWidth="2.5" />
          <path d="M11 31h34" stroke="#EA580C" strokeWidth="2.8" />
          <path d="M20 22c0-4 3-6 3-9" stroke="#F97316" strokeWidth="2.4" />
          <path d="M28 20c0-4 3-6 3-9" stroke="#F97316" strokeWidth="2.4" />
          <path d="M36 22c0-4 3-6 3-9" stroke="#F97316" strokeWidth="2.4" />
        </svg>
      );

    case "bathroom":
      return (
        <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="50" height="50" rx="16" fill="#E0F7FA" />
          <path d="M15 32c0 6 4.5 10 13 10s13-4 13-10v-4H15v4z" fill="#38BDF8" stroke="#0284C7" strokeWidth="2.5" />
          <path d="M12 28h32" stroke="#0284C7" strokeWidth="2.6" />
          <path d="M18 28V15a3.5 3.5 0 0 1 3.5-3.5h7a3.5 3.5 0 0 1 3.5 3.5v3" stroke="#0284C7" strokeWidth="2.4" />
          <circle cx="34" cy="20" r="1.8" fill="#00ACC1" />
          <circle cx="39" cy="23" r="1.8" fill="#00ACC1" />
          <circle cx="35" cy="25" r="1.8" fill="#00ACC1" />
        </svg>
      );

    case "pain":
      return (
        <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="50" height="50" rx="16" fill="#FFE4E6" />
          <circle cx="28" cy="28" r="15" fill="#FDA4AF" stroke="#E11D48" strokeWidth="2.5" />
          <path d="M19 28h4.5l2.5-6 3.5 12 3-6h4.5" stroke="#BE123C" strokeWidth="2.6" />
        </svg>
      );

    case "unwell":
      return (
        <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="50" height="50" rx="16" fill="#FEF3C7" />
          <path d="M21 35a7 7 0 0 0 14 0c0-3.5-3-5.2-4.8-8.2V17a2.2 2.2 0 0 0-4.4 0v9.8c-1.8 3-4.8 4.7-4.8 8.2z" fill="#FCD34D" stroke="#D97706" strokeWidth="2.5" />
          <circle cx="28" cy="35" r="3.5" fill="#D97706" />
          <path d="M28 21v8" stroke="#D97706" strokeWidth="2.2" />
          <path d="M37 18c2.2 1.8 3.5 4.5 2.5 8" stroke="#B45309" strokeWidth="2.2" />
        </svg>
      );

    case "health":
      return (
        <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="50" height="50" rx="16" fill="#D1FAE5" />
          <rect x="15" y="21" width="26" height="22" rx="5" fill="#6EE7B7" stroke="#059669" strokeWidth="2.5" />
          <path d="M22 21v-3.5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V21" stroke="#059669" strokeWidth="2.4" />
          <path d="M28 27v10M23 32h10" stroke="#047857" strokeWidth="3" />
        </svg>
      );

    case "comfort":
      return (
        <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="50" height="50" rx="16" fill="#EDE9FE" />
          <path d="M14 32c0-6 6.5-11 14-11s14 5 14 11-6.5 11-14 11-14-5-14-11z" fill="#C4B5FD" stroke="#7C3AED" strokeWidth="2.5" />
          <path d="M21 30c3-3 8-4.2 13.5-2.2" stroke="#6D28D9" strokeWidth="2.2" />
          <circle cx="28" cy="16" r="2.2" fill="#8B5CF6" />
          <circle cx="34" cy="18" r="1.5" fill="#A78BFA" />
        </svg>
      );

    case "talk":
      return (
        <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="50" height="50" rx="16" fill="#EEF2FF" />
          <path d="M15 21a7 7 0 0 1 7-7h12a7 7 0 0 1 7 7v7a7 7 0 0 1-7 7h-4l-6 5v-5h-2a7 7 0 0 1-7-7v-7z" fill="#A5B4FC" stroke="#4F46E5" strokeWidth="2.5" />
          <circle cx="23" cy="24.5" r="2" fill="#3730A3" />
          <circle cx="28" cy="24.5" r="2" fill="#3730A3" />
          <circle cx="33" cy="24.5" r="2" fill="#3730A3" />
        </svg>
      );

    case "help":
      return (
        <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="50" height="50" rx="16" fill="#FEE2E2" />
          <path d="M28 11l14 7v10.5c0 9.5-6.5 16.5-14 18.5-7.5-2-14-9-14-18.5V18l14-7z" fill="#F87171" stroke="#DC2626" strokeWidth="2.6" />
          <path d="M28 22v8M28 35v.6" stroke="#FFFFFF" strokeWidth="3.2" />
        </svg>
      );

    case "other":
    default:
      return (
        <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="50" height="50" rx="16" fill="#CCFBF1" />
          <circle cx="28" cy="28" r="14" fill="#5EEAD4" stroke="#0D9488" strokeWidth="2.5" />
          <circle cx="21" cy="28" r="2.4" fill="#0F766E" />
          <circle cx="28" cy="28" r="2.4" fill="#0F766E" />
          <circle cx="35" cy="28" r="2.4" fill="#0F766E" />
        </svg>
      );
  }
}

// ─── Human-Centered Vector Artwork for Subpage Option Cards ─────────────────
export function OptionArt({ domainId, title, emoji, className = "w-12 h-12" }) {
  const t = title.toLowerCase();

  // Most Needed quick communication options
  if (domainId === "most_needed") {
    if (t === "yes") return <QuickResponseGlyph id="yes" className={className} />;
    if (t === "no") return <QuickResponseGlyph id="no" className={className} />;
    if (t === "please") return <QuickResponseGlyph id="please" className={className} />;
    if (t.includes("thank")) return <QuickResponseGlyph id="thankyou" className={className} />;
    if (t.includes("help")) return <QuickResponseGlyph id="needhelp" className={className} />;
    return <QuickResponseGlyph id="needsomething" className={className} />;
  }

  // Water category options
  if (domainId === "water") {
    if (t === "water") {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#E0F2FE" />
          <path d="M14 12h16l-2.2 22H16.2L14 12z" fill="#7DD3FC" stroke="#0284C7" strokeWidth="2.2" />
          <path d="M16 21c2.5 1 5 1 8 0s5.5 1 6 0" stroke="#0369A1" strokeWidth="1.8" />
          <circle cx="22" cy="7.5" r="2" fill="#0284C7" />
        </svg>
      );
    }
    if (t.includes("cold")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#E0F2FE" />
          <path d="M14 13h16l-2.2 21H16.2L14 13z" fill="#BAE6FD" stroke="#0284C7" strokeWidth="2" />
          <rect x="18" y="19" width="5" height="5" rx="1.5" fill="#FFFFFF" stroke="#0284C7" strokeWidth="1.6" />
          <rect x="25" y="22" width="5" height="5" rx="1.5" fill="#FFFFFF" stroke="#0284C7" strokeWidth="1.6" />
          <path d="M9 16l2 2M9 18l2-2M33 16l2 2M33 18l2-2" stroke="#0284C7" strokeWidth="1.6" />
        </svg>
      );
    }
    if (t.includes("warm")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#FFEDD5" />
          <path d="M13 17h16v12a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 13 29V17z" fill="#FDBA74" stroke="#EA580C" strokeWidth="2.2" />
          <path d="M29 20h3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-3" stroke="#EA580C" strokeWidth="2.2" />
          <path d="M18 10c0 2.5-1.5 3-1.5 5M23 9c0 2.5-1.5 3-1.5 5" stroke="#C2410C" strokeWidth="1.8" />
        </svg>
      );
    }
    if (t.includes("drink") || t.includes("beverage")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#E0F7FA" />
          <rect x="13" y="15" width="8" height="20" rx="2" fill="#4DD0E1" stroke="#00838F" strokeWidth="2" />
          <path d="M25 19h10l-1.2 16H26.2L25 19z" fill="#80DEEA" stroke="#00838F" strokeWidth="2" />
          <path d="M31 11l-3 10" stroke="#006064" strokeWidth="2" />
        </svg>
      );
    }
    if (t.includes("juice")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#FEF3C7" />
          <path d="M14 16h16l-2 19H16L14 16z" fill="#FCD34D" stroke="#D97706" strokeWidth="2.2" />
          <circle cx="29" cy="13" r="5" fill="#FBBF24" stroke="#D97706" strokeWidth="1.8" />
          <path d="M29 10v6M26 13h6" stroke="#B45309" strokeWidth="1.4" />
        </svg>
      );
    }
    if (t.includes("electrolyte")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#D1FAE5" />
          <rect x="14" y="12" width="16" height="23" rx="4" fill="#6EE7B7" stroke="#059669" strokeWidth="2" />
          <path d="M23 17l-3 5h3.5l-2 6 5.5-7H23.5l2.5-4h-3z" fill="#047857" stroke="#065F46" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    }
  }

  // Food / Meals options
  if (domainId === "food") {
    if (t.includes("rice")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#FFEDD5" />
          <path d="M12 25c0 7 4.5 11 10 11s10-4 10-11H12z" fill="#FDBA74" stroke="#EA580C" strokeWidth="2.2" />
          <path d="M14 25c0-4 3.5-7 8-7s8 3 8 7H14z" fill="#FFFFFF" stroke="#EA580C" strokeWidth="2" />
          <circle cx="19" cy="22" r="1" fill="#EA580C" />
          <circle cx="22" cy="20" r="1" fill="#EA580C" />
          <circle cx="25" cy="22" r="1" fill="#EA580C" />
        </svg>
      );
    }
    if (t.includes("dal") || t.includes("soup") || t.includes("khichdi") || t.includes("upma")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#FEF3C7" />
          <path d="M11 24c0 7.5 5 12 11 12s11-4.5 11-12H11z" fill="#FCD34D" stroke="#D97706" strokeWidth="2.2" />
          <path d="M8 24h28" stroke="#D97706" strokeWidth="2.4" />
          <path d="M18 16c0-3 2.5-4.5 2.5-6.5M24 16c0-3 2.5-4.5 2.5-6.5" stroke="#F59E0B" strokeWidth="1.8" />
        </svg>
      );
    }
    if (t.includes("roti") || t.includes("chapati") || t.includes("bread") || t.includes("dosa")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#FFEDD5" />
          <circle cx="22" cy="22" r="12" fill="#FED7AA" stroke="#EA580C" strokeWidth="2.2" />
          <circle cx="22" cy="22" r="7" stroke="#F97316" strokeDasharray="3 3" strokeWidth="1.5" />
          <circle cx="18" cy="19" r="1.2" fill="#C2410C" />
          <circle cx="24" cy="24" r="1.2" fill="#C2410C" />
        </svg>
      );
    }
    if (t.includes("idli")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#F1F5F9" />
          <ellipse cx="20" cy="23" rx="8" ry="6" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="2" />
          <ellipse cx="25" cy="20" rx="8" ry="6" fill="#F8FAFC" stroke="#64748B" strokeWidth="2" />
          <circle cx="18" cy="22" r="1" fill="#CBD5E1" />
        </svg>
      );
    }
    if (t.includes("vegetable") || t.includes("fruit")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#D1FAE5" />
          <circle cx="22" cy="24" r="10" fill="#6EE7B7" stroke="#059669" strokeWidth="2.2" />
          <path d="M22 14c0-3 2-5 4-5" stroke="#047857" strokeWidth="2.2" />
          <path d="M23 11c3 0 5 1.5 5 3.5s-2 2-5 0.5" fill="#34D399" />
        </svg>
      );
    }
    if (t.includes("breakfast") || t.includes("lunch") || t.includes("dinner")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#FFEDD5" />
          <circle cx="22" cy="22" r="12" fill="#FED7AA" stroke="#EA580C" strokeWidth="2.2" />
          <circle cx="22" cy="22" r="8" fill="#FFFFFF" stroke="#EA580C" strokeWidth="1.6" />
          <path d="M12 16v12M32 16v12" stroke="#EA580C" strokeWidth="2" />
        </svg>
      );
    }
    if (t.includes("tea") || t.includes("coffee") || t.includes("milk")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#FEF3C7" />
          <path d="M12 17h16v11a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4V17z" fill="#FCD34D" stroke="#D97706" strokeWidth="2.2" />
          <path d="M28 20h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-3" stroke="#D97706" strokeWidth="2" />
          <path d="M17 11c0 2-1 2.5-1 4M22 10c0 2-1 2.5-1 4" stroke="#B45309" strokeWidth="1.6" />
        </svg>
      );
    }
    if (t.includes("biscuit") || t.includes("cake") || t.includes("snack") || t.includes("cookie")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#FFEDD5" />
          <circle cx="22" cy="22" r="11" fill="#FED7AA" stroke="#EA580C" strokeWidth="2" />
          <circle cx="18" cy="18" r="1.5" fill="#C2410C" />
          <circle cx="25" cy="19" r="1.5" fill="#C2410C" />
          <circle cx="21" cy="25" r="1.5" fill="#C2410C" />
        </svg>
      );
    }
  }

  // Bathroom options
  if (domainId === "bathroom") {
    if (t.includes("toilet")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#E0F7FA" />
          <path d="M16 14h12v10a6 6 0 0 1-12 0V14z" fill="#B2EBF2" stroke="#00838F" strokeWidth="2.2" />
          <rect x="14" y="9" width="16" height="5" rx="1.5" fill="#80DEEA" stroke="#00838F" strokeWidth="1.8" />
          <path d="M20 28v6M24 28v6" stroke="#00838F" strokeWidth="2" />
        </svg>
      );
    }
    if (t.includes("bath") || t.includes("shower")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#E0F2FE" />
          <path d="M12 24h20v4a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6v-4z" fill="#7DD3FC" stroke="#0284C7" strokeWidth="2.2" />
          <path d="M15 24V14a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v2" stroke="#0284C7" strokeWidth="2" />
          <circle cx="28" cy="18" r="1.5" fill="#0284C7" />
          <circle cx="31" cy="20" r="1.5" fill="#0284C7" />
        </svg>
      );
    }
  }

  // Comfort options
  if (domainId === "comfort") {
    if (t.includes("pillow")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#EDE9FE" />
          <path d="M11 25c0-5 5-9 11-9s11 4 11 9-5 9-11 9-11-4-11-9z" fill="#C4B5FD" stroke="#7C3AED" strokeWidth="2.2" />
          <path d="M17 23c2.5-2 6.5-2.5 10-1" stroke="#6D28D9" strokeWidth="1.8" />
        </svg>
      );
    }
    if (t.includes("position") || t.includes("comfortable")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#EDE9FE" />
          <path d="M14 26l7-7 7 7M21 19v14" stroke="#7C3AED" strokeWidth="2.6" />
        </svg>
      );
    }
    if (t.includes("hot")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#FEF3C7" />
          <circle cx="22" cy="22" r="7" fill="#FCD34D" stroke="#D97706" strokeWidth="2.2" />
          <path d="M22 10v3M22 31v3M10 22h3M31 22h3" stroke="#D97706" strokeWidth="2.2" />
        </svg>
      );
    }
    if (t.includes("cold") || t.includes("blanket")) {
      return (
        <svg viewBox="0 0 44 44" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="40" height="40" rx="12" fill="#E0F2FE" />
          <path d="M22 12v20M12 22h20M15 15l14 14M15 29l14-14" stroke="#0284C7" strokeWidth="2" />
        </svg>
      );
    }
  }

  // Consistent colorful badge fallback
  const colorMap = {
    most_needed: "bg-amber-100 text-amber-800 border-amber-200",
    water: "bg-sky-100 text-sky-800 border-sky-200",
    food: "bg-orange-100 text-orange-800 border-orange-200",
    bathroom: "bg-cyan-100 text-cyan-800 border-cyan-200",
    pain: "bg-rose-100 text-rose-800 border-rose-200",
    unwell: "bg-amber-100 text-amber-800 border-amber-200",
    health: "bg-emerald-100 text-emerald-800 border-emerald-200",
    comfort: "bg-purple-100 text-purple-800 border-purple-200",
    talk: "bg-indigo-100 text-indigo-800 border-indigo-200",
    help: "bg-red-100 text-red-800 border-red-200",
    other: "bg-teal-100 text-teal-800 border-teal-200",
  };

  const scheme = colorMap[domainId] || "bg-sky-100 text-sky-800 border-sky-200";

  return (
    <div className={`flex items-center justify-center rounded-xl p-2 border ${scheme} ${className} shrink-0`}>
      <span className="text-2xl sm:text-3xl leading-none" role="img" aria-hidden="true">
        {emoji || "•"}
      </span>
    </div>
  );
}

// ─── Vibrant, Accessible Quick Response Glyphs ──────────────────────────────
export function QuickResponseGlyph({ id, className = "w-5 h-5" }) {
  switch (id) {
    case "yes":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.5" fill="#D1FAE5" stroke="#059669" strokeWidth="2" />
          <path d="M8.5 12.5l2.5 2.5 5-5" stroke="#047857" strokeWidth="2.5" />
        </svg>
      );
    case "no":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.5" fill="#FEE2E2" stroke="#DC2626" strokeWidth="2" />
          <path d="M15 9l-6 6M9 9l6 6" stroke="#B91C1C" strokeWidth="2.5" />
        </svg>
      );
    case "please":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.5" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
          <path d="M8 14s2-2 4-2 4 2 4 2M12 8v2" stroke="#B45309" strokeWidth="2.2" />
        </svg>
      );
    case "thankyou":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.5" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="2" />
          <path d="M12 15.5l-3-3a2.1 2.1 0 0 1 3-3 2.1 2.1 0 0 1 3 3l-3 3z" fill="#A78BFA" stroke="#6D28D9" strokeWidth="2" />
        </svg>
      );
    case "needhelp":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.5" fill="#FEE2E2" stroke="#DC2626" strokeWidth="2" />
          <path d="M12 7.5v6M12 16.5v.5" stroke="#DC2626" strokeWidth="2.8" />
        </svg>
      );
    case "needsomething":
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.5" fill="#CCFBF1" stroke="#0D9488" strokeWidth="2" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.2c-.8.6-1 1-1 1.8M12 16.5v.5" stroke="#0F766E" strokeWidth="2.2" />
        </svg>
      );
  }
}
