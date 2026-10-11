import React from 'react';
import { BookOpen, GraduationCap, Microscope, Atom } from 'lucide-react';

interface LibrarySelectorProps {
  libraries: string[];
  bookCounts: Record<string, number>;
  onSelectLibrary: (library: string) => void;
  isLoading: boolean;
}

const LIBRARY_META: Record<string, { icon: React.ReactNode; desc: string; color: string }> = {
  'UPSC Prelims GS': {
    icon: <GraduationCap className="w-7 h-7" />,
    desc: 'NCERT textbooks for General Studies — Polity, Geography, History',
    color: 'from-amber-600 to-amber-700',
  },
  'Science Samples': {
    icon: <Atom className="w-7 h-7" />,
    desc: 'OpenStax open-licensed Physics and Biology textbooks',
    color: 'from-teal-600 to-teal-700',
  },
  'Engineering (CS)': {
    icon: <Microscope className="w-7 h-7" />,
    desc: 'Computer Science and Networking textbooks',
    color: 'from-blue-600 to-blue-700',
  },
  'Medical': {
    icon: <BookOpen className="w-7 h-7" />,
    desc: 'Anatomy, Physiology and Medical Sciences',
    color: 'from-rose-600 to-rose-700',
  },
};

// Canonical display order
const DISPLAY_ORDER = ['UPSC Prelims GS', 'Science Samples', 'Engineering (CS)', 'Medical'];

export const LibrarySelector: React.FC<LibrarySelectorProps> = ({
  libraries,
  bookCounts,
  onSelectLibrary,
  isLoading,
}) => {
  // Show all canonical libraries, but only clickable ones that exist in DB
  const displayLibraries = DISPLAY_ORDER.filter(
    (l) => libraries.includes(l) || bookCounts[l] !== undefined
  );
  // Always show at least what the DB has
  const extra = libraries.filter((l) => !DISPLAY_ORDER.includes(l));
  const allDisplayed = [...displayLibraries, ...extra];

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-navy-900">Choose a Library</h1>
          <p className="text-slate-500 mt-2">Loading available libraries…</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-8 animate-pulse h-36" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center space-x-2 bg-teal-50 text-teal-800 border border-teal-200 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
          <span>Step 1 of 2 — Choose Your Library</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
          Select a Library
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Each library contains textbooks for a specific exam or subject area.
          Your questions will be grounded exclusively in the book you choose.
        </p>
      </div>

      {/* Library Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {allDisplayed.map((lib) => {
          const meta = LIBRARY_META[lib] ?? {
            icon: <BookOpen className="w-7 h-7" />,
            desc: 'Textbooks in this library',
            color: 'from-slate-600 to-slate-700',
          };
          const count = bookCounts[lib] ?? 0;
          const available = libraries.includes(lib) && count > 0;

          return (
            <button
              key={lib}
              onClick={() => available && onSelectLibrary(lib)}
              disabled={!available}
              className={`text-left w-full rounded-2xl border transition-all duration-200 overflow-hidden group ${
                available
                  ? 'border-slate-200 hover:border-teal-400 hover:shadow-lg cursor-pointer bg-white'
                  : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className={`bg-gradient-to-r ${meta.color} p-5 flex items-center space-x-4`}>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  {meta.icon}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{lib}</h2>
                  <span className="text-xs text-white/80">
                    {available ? `${count} book${count !== 1 ? 's' : ''} indexed` : 'Coming soon'}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm text-slate-600">{meta.desc}</p>
                {available && (
                  <p className="text-xs text-teal-600 font-semibold mt-3 group-hover:underline">
                    Open library →
                  </p>
                )}
                {!available && (
                  <p className="text-xs text-slate-400 mt-3">No indexed books yet</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Note about grounding */}
      <div className="mt-8 text-center text-xs text-slate-500">
        ⚠ Answers are AI-generated from retrieved textbook passages and should be checked against the book.
      </div>
    </div>
  );
};
