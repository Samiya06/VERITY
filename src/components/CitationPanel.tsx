import React, { useState } from 'react';
import { FileText, Bookmark, ExternalLink, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { Passage } from '../types';

interface CitationPanelProps {
  passages: Passage[];
  bookTitle: string;
  activeCitationPage?: number | null;
}

export const CitationPanel: React.FC<CitationPanelProps> = ({
  passages,
  bookTitle,
  activeCitationPage,
}) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!passages || passages.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-500">
        <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-medium">No textbook passages retrieved</p>
        <p className="text-xs text-slate-400 mt-1">
          When a query is executed, the top 5 FTS5 indexed excerpts will appear here.
        </p>
      </div>
    );
  }

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Panel Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bookmark className="w-4 h-4 text-teal-600" />
          <h3 className="font-bold text-sm text-navy-900">
            Retrieved Passages & Citations ({passages.length})
          </h3>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Source: <strong className="text-slate-700">{bookTitle}</strong>
        </span>
      </div>

      <div className="p-4 bg-teal-50/50 border-b border-slate-200 text-xs text-teal-900 flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
        <span>
          Showing short retrieved excerpts from indexed pages. Compare these against the answer to verify page citations.
        </span>
      </div>

      {/* List of Passages */}
      <div className="divide-y divide-slate-100">
        {passages.map((p, index) => {
          const isExpanded = expandedId === p.chunk_id;
          const isActive = activeCitationPage === p.page;

          return (
            <div
              key={p.chunk_id || index}
              id={`citation-page-${p.page}`}
              className={`p-5 transition-all duration-300 ${
                isActive
                  ? 'bg-teal-50/80 ring-2 ring-teal-500 rounded-xl m-2'
                  : 'hover:bg-slate-50/70'
              }`}
            >
              {/* Passage Meta bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs font-mono shadow-sm ${
                    isActive
                      ? 'bg-teal-600 text-white ring-2 ring-teal-300'
                      : 'bg-navy-900 text-teal-300'
                  }`}>
                    Page {p.page}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {p.section || 'General Textbook Section'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {isActive && (
                    <span className="text-xs font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                      Referenced Citation
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-mono">
                    Rank #{index + 1} Match
                  </span>
                </div>
              </div>

              {/* Short Excerpt */}
              <blockquote className="text-xs sm:text-sm text-slate-700 leading-relaxed italic bg-slate-50 border-l-4 border-teal-500 rounded-r-lg p-3">
                "{p.short_excerpt || p.text}"
              </blockquote>

              {/* Expand Toggle */}
              {p.text && p.text !== p.short_excerpt && (
                <div className="mt-3">
                  <button
                    onClick={() => toggleExpand(p.chunk_id)}
                    className="text-xs text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center space-x-1"
                  >
                    <span>{isExpanded ? 'Collapse Full Passage' : 'View Full Passage Excerpt'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed font-mono">
                      {p.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
