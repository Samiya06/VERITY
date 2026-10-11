import React from 'react';
import { ShieldAlert, CheckCircle, Info, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { AskResponse, Book } from '../types';
import { CitationPanel } from './CitationPanel';

interface AnswerViewProps {
  response: AskResponse | null;
  isLoading: boolean;
  error: string | null;
  selectedBook: Book;
  onRetry?: () => void;
}

const REFUSAL_TEXT = "This textbook's indexed content doesn't answer this question.";

export const AnswerView: React.FC<AnswerViewProps> = ({
  response,
  isLoading,
  error,
  selectedBook,
  onRetry,
}) => {
  const [activeCitationPage, setActiveCitationPage] = React.useState<number | null>(null);

  const handleCitationClick = (pageNum: number) => {
    setActiveCitationPage(pageNum);
    const element = document.getElementById(`citation-page-${pageNum}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  // 1. Loading State
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center animate-pulse">
        <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6 text-teal-600 animate-spin" />
        </div>
        <h3 className="text-lg font-bold text-navy-900 mb-2">
          Grounded Retrieval & Synthesis in Progress
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          Querying SQLite FTS5 BM25 index across {selectedBook.title} pages and strictly verifying citations...
        </p>

        <div className="space-y-3 max-w-lg mx-auto">
          <div className="h-4 bg-slate-200 rounded w-full" />
          <div className="h-4 bg-slate-100 rounded w-5/6 mx-auto" />
          <div className="h-4 bg-slate-200 rounded w-4/6 mx-auto" />
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-900 shadow-sm">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-rose-900">Query Failed</h3>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Question</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Empty State (before first question)
  if (!response) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Info className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-sm font-bold text-navy-900">Ready for Questions</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Type a study question above or select one of the sample textbook questions.
          Answers will be synthesized strictly from verified passages with exact page citations.
        </p>
      </div>
    );
  }

  // 4. "Not Answered by this Textbook" State
  const isRefusal = !response.is_grounded || response.answer.trim() === REFUSAL_TEXT;

  if (isRefusal) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200">
                Grounded Refusal Triggered
              </span>
              <h3 className="text-base font-extrabold text-amber-950 mt-2 font-mono">
                "{REFUSAL_TEXT}"
              </h3>
              <p className="text-xs text-amber-900 mt-2 leading-relaxed">
                VERITY's strict grounding protocol confirmed that the indexed passages in{' '}
                <strong>{selectedBook.title}</strong> do not contain sufficient evidence to answer this question.
                Outside knowledge was intentionally withheld to prevent hallucinations.
              </p>
              <div className="mt-3 text-xs text-amber-800 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200">
                💡 <strong>Study Tip:</strong> Try asking about topics covered in this textbook's specific chapters,
                or switch to another textbook in the catalogue.
              </div>
            </div>
          </div>
        </div>

        {/* Citation panel showing what was actually retrieved, if any */}
        {response.retrieved_passages && response.retrieved_passages.length > 0 && (
          <CitationPanel
            passages={response.retrieved_passages}
            bookTitle={selectedBook.title}
          />
        )}
      </div>
    );
  }

  // Helper to format citations into interactive buttons and render structured headers
  const renderFormattedAnswer = (text: string) => {
    const lines = text.split('\n');

    return lines.map((line, lineIdx) => {
      const headerMatch = line.match(/^###\s+(.*)/);
      const isHeader = !!headerMatch;
      const contentLine = isHeader ? headerMatch[1] : line;

      // Regex for [Page X] citations
      const parts = contentLine.split(/(\[Page\s+[\d\-, ]+\])/g);

      const renderedParts = parts.map((part, index) => {
        const match = part.match(/^\[Page\s+([\d\-, ]+)\]$/);
        if (match) {
          const rawPages = match[1];
          const firstPageMatch = rawPages.match(/\d+/);
          const firstPageNum = firstPageMatch ? parseInt(firstPageMatch[0], 10) : null;

          return (
            <button
              key={index}
              type="button"
              onClick={() => firstPageNum && handleCitationClick(firstPageNum)}
              className="inline-flex items-center font-mono font-bold text-xs bg-teal-100 hover:bg-teal-200 text-teal-800 border border-teal-300 px-2 py-0.5 rounded mx-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title={`Click to view retrieved textbook excerpt on Page ${rawPages}`}
            >
              📄 Page {rawPages}
            </button>
          );
        }
        return <span key={index}>{part}</span>;
      });

      if (isHeader) {
        return (
          <h4 key={lineIdx} className="text-navy-900 font-bold text-sm sm:text-base mt-4 mb-1.5 border-b border-slate-100 pb-1">
            {renderedParts}
          </h4>
        );
      }

      return (
        <div key={lineIdx} className="min-h-[1.25rem]">
          {renderedParts}
        </div>
      );
    });
  };

  // 5. Grounded Answer State
  return (
    <div className="space-y-6">
      {/* Answer Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Answer Header */}
        <div className="bg-navy-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-teal-400" />
            <h3 className="font-bold text-sm tracking-tight">
              Verified Textbook Answer
            </h3>
            <span className="text-xs font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full capitalize">
              {response.mode.replace('_', ' ')}
            </span>
          </div>

          <span className="text-xs text-slate-400">
            Source: <strong className="text-slate-200">{selectedBook.title}</strong>
          </span>
        </div>

        {/* Answer Content */}
        <div className="p-6 sm:p-8">
          <div className="prose prose-slate max-w-none text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-line font-normal space-y-1">
            {renderFormattedAnswer(response.answer)}
          </div>

          {/* Mandatory Safety Notice as specified:
              "A visible note: answers are AI-generated from the retrieved passages and should be checked against the book." */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex items-start space-x-2.5 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border">
            <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <p>
              <strong className="text-slate-700">Notice for Students:</strong> Answers are AI-generated solely from the retrieved textbook passages and should always be verified against the official book pages cited above.
            </p>
          </div>
        </div>
      </div>

      {/* Citation Panel */}
      <CitationPanel
        passages={response.retrieved_passages}
        bookTitle={selectedBook.title}
        activeCitationPage={activeCitationPage}
      />
    </div>
  );
};
