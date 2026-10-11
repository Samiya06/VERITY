import React from 'react';
import { BookOpen, ShieldCheck, CheckCircle2, AlertCircle, Clock, Home } from 'lucide-react';
import { Book } from '../types';

interface NavbarProps {
  selectedBook: Book | null;
  onClearBook: () => void;
  isBackendHealthy: boolean;
  currentPage: 'study' | 'history';
  onNavigate: (page: 'study' | 'history') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  selectedBook,
  onClearBook,
  isBackendHealthy,
  currentPage,
  onNavigate,
}) => {
  return (
    <header className="bg-navy-900 border-b border-navy-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onClearBook}>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-inner">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xl tracking-tight text-white">VERITY</span>
              <span className="text-xs bg-teal-500/20 text-teal-300 border border-teal-500/30 font-medium px-2 py-0.5 rounded-full">
                Grounded MVP
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Textbook-Only Academic Intelligence
            </p>
          </div>
        </div>

        {/* Right area */}
        <div className="flex items-center space-x-3">
          {/* Navigation tabs */}
          <nav className="flex items-center space-x-1 bg-navy-800/60 border border-navy-700/60 rounded-lg p-1">
            <button
              onClick={() => onNavigate('study')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                currentPage === 'study'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-navy-700'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Study</span>
            </button>
            <button
              onClick={() => onNavigate('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                currentPage === 'history'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-navy-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">History</span>
            </button>
          </nav>

          {/* Active book pill if chosen */}
          {selectedBook && currentPage === 'study' && (
            <div className="hidden md:flex items-center bg-navy-800 border border-navy-700 rounded-full px-3 py-1 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-teal-400 mr-2 animate-pulse" />
              <span className="font-medium text-slate-200 truncate max-w-[150px]">
                {selectedBook.title}
              </span>
              <button
                onClick={onClearBook}
                className="ml-2.5 text-slate-400 hover:text-white transition-colors"
                title="Change Textbook"
              >
                ✕
              </button>
            </div>
          )}

          {/* Grounding badge */}
          <div className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-300 bg-navy-800/80 px-2.5 py-1 rounded-md border border-navy-700/60">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>FTS5 Grounded</span>
          </div>

          {/* Backend health */}
          <div className="flex items-center space-x-1.5 text-xs">
            {isBackendHealthy ? (
              <span className="flex items-center text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                API
              </span>
            ) : (
              <span className="flex items-center text-amber-300 bg-amber-950/40 border border-amber-800/50 px-2 py-1 rounded-full">
                <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-400" />
                Offline
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
