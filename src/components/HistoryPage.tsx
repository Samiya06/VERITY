import React, { useState, useEffect } from 'react';
import { Search, Trash2, Trash, X, ChevronDown, ChevronUp, Clock, BookOpen, ShieldCheck, ShieldX } from 'lucide-react';
import { HistoryEntry, HistoryPassage } from '../types';
import { fetchHistory, deleteHistoryEntry, deleteAllHistory } from '../api';

const STUDY_MODE_LABELS: Record<string, string> = {
  detailed: 'Detailed',
  short_notes: 'Short Notes',
  exam_style: 'Exam Style',
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// Render answer text with [Page X] citations highlighted
function renderAnswerText(text: string) {
  const parts = text.split(/(\[Page \d+\])/g);
  return parts.map((part, i) => {
    if (/^\[Page \d+\]$/.test(part)) {
      return (
        <span key={i} className="inline-block bg-teal-100 text-teal-800 text-xs font-semibold px-1.5 py-0.5 rounded mx-0.5">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface SessionModalProps {
  entry: HistoryEntry;
  onClose: () => void;
}

const SessionModal: React.FC<SessionModalProps> = ({ entry, onClose }) => {
  let passages: HistoryPassage[] = [];
  try {
    passages = JSON.parse(entry.passages_json) || [];
  } catch {}

  return (
    <div className="fixed inset-0 bg-navy-950/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="bg-navy-900 text-white p-5 rounded-t-2xl flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-teal-300" />
              <span className="text-xs text-teal-300 font-semibold">{entry.book_title}</span>
              <span className="text-xs text-slate-400">• {entry.library}</span>
            </div>
            <p className="text-sm font-bold text-white leading-snug">{entry.question}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs bg-navy-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                {STUDY_MODE_LABELS[entry.mode] || entry.mode}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />{formatDate(entry.created_at)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-slate-400 hover:text-white transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Answer */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            {entry.is_grounded ? (
              <span className="flex items-center gap-1 text-xs text-teal-700 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> Grounded Answer
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-700 font-semibold">
                <ShieldX className="w-3.5 h-3.5" /> Not Answered by Textbook
              </span>
            )}
          </div>
          {!entry.is_grounded ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 font-medium">
              {entry.answer}
            </div>
          ) : (
            <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {renderAnswerText(entry.answer)}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-3">
            ⚠ AI-generated from retrieved passages — check against the book.
          </p>
        </div>

        {/* Citations */}
        {passages.length > 0 && (
          <div className="p-5">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Retrieved Passages ({passages.length})
            </h4>
            <div className="space-y-2">
              {passages.map((p, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">
                      Page {p.page}
                    </span>
                    <span className="text-xs text-slate-500">{p.section}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{p.short_excerpt}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const HistoryPage: React.FC = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [openEntry, setOpenEntry] = useState<HistoryEntry | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async (kw?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchHistory({ keyword: kw });
      setEntries(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyword(searchInput);
    load(searchInput);
  };

  const handleDelete = async (id: number) => {
    if (deletingId !== null) return;
    setDeletingId(id);
    try {
      await deleteHistoryEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert('Failed to delete entry. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    try {
      await deleteAllHistory();
      setEntries([]);
      setConfirmClearAll(false);
    } catch {
      alert('Failed to clear history. Please try again.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Study History</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Every question you asked — click any entry to reopen the full answer.
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={() => setConfirmClearAll(true)}
            className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-400 px-3 py-1.5 rounded-lg transition"
          >
            <Trash className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search questions or answers…"
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition"
        >
          Search
        </button>
        {keyword && (
          <button
            type="button"
            onClick={() => { setSearchInput(''); setKeyword(''); load(); }}
            className="px-3 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {keyword && (
        <p className="text-xs text-slate-500 mb-4">
          Showing results for <strong>"{keyword}"</strong> — {entries.length} found
        </p>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse h-20" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <p className="text-rose-800 font-medium">{error}</p>
          <button onClick={() => load()} className="mt-3 text-sm text-teal-600 hover:underline">Retry</button>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            {keyword ? 'No results found' : 'No study sessions yet'}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {keyword
              ? 'Try a different keyword.'
              : 'Ask a question from any textbook — it will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-sm transition group"
            >
              <button
                className="w-full text-left p-5"
                onClick={() => setOpenEntry(entry)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Book + library badge */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                        {entry.library}
                      </span>
                      <span className="text-xs text-slate-500">{entry.book_title}</span>
                      <span className="text-xs text-slate-400 font-mono">
                        {STUDY_MODE_LABELS[entry.mode] || entry.mode}
                      </span>
                    </div>

                    {/* Question */}
                    <p className="text-sm font-semibold text-navy-900 truncate">
                      {entry.question}
                    </p>

                    {/* Answer preview */}
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      {entry.is_grounded ? entry.answer.slice(0, 120) + '…' : '⚠ Refused — not in textbook'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(entry.created_at)}
                    </span>
                    {entry.is_grounded ? (
                      <span className="text-xs text-teal-600 flex items-center gap-0.5">
                        <ShieldCheck className="w-3 h-3" /> Cited
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 flex items-center gap-0.5">
                        <ShieldX className="w-3 h-3" /> Refused
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Delete button — separate row */}
              <div className="px-5 pb-3 flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                  disabled={deletingId === entry.id}
                  className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3 h-3" />
                  {deletingId === entry.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clear All Confirmation */}
      {confirmClearAll && (
        <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-navy-900 mb-2">Clear All History?</h3>
            <p className="text-sm text-slate-600 mb-5">
              This will permanently delete all {entries.length} study session{entries.length !== 1 ? 's' : ''}. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmClearAll(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg transition"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {openEntry && (
        <SessionModal entry={openEntry} onClose={() => setOpenEntry(null)} />
      )}
    </div>
  );
};
