import React, { useState } from 'react';
import { Send, Sparkles, BookOpen, ArrowLeftRight, HelpCircle, FileText, CheckCircle2 } from 'lucide-react';
import { Book, StudyMode } from '../types';

interface QuestionBoxProps {
  selectedBook: Book;
  onAsk: (question: string, mode: StudyMode) => void;
  isLoading: boolean;
  onChangeBook: () => void;
}

export const QuestionBox: React.FC<QuestionBoxProps> = ({
  selectedBook,
  onAsk,
  isLoading,
  onChangeBook,
}) => {
  const [question, setQuestion] = useState<string>('');
  const [mode, setMode] = useState<StudyMode>('detailed');

  const suggestedQuestions = (() => {
    if (selectedBook.id.includes('constitution')) {
      return [
        "What is the Preamble of the Indian Constitution and what does it proclaim?",
        "What are Fundamental Rights and which article guarantees Right to Equality?",
        "What is the difference between a federal and unitary form of government?",
        "What are the functions of the Prime Minister in the parliamentary system?",
        "Who won the IPL in 2020?", // Out-of-scope refusal test
      ];
    }
    if (selectedBook.id.includes('geography')) {
      return [
        "What is the structure of the atmosphere and name its layers?",
        "What causes the seasons on Earth?",
        "Explain the rock cycle and the three types of rocks.",
        "What is the water cycle and what are its main stages?",
        "What is the GDP of France?", // Out-of-scope refusal test
      ];
    }
    if (selectedBook.id.includes('biology')) {
      return [
        "How does the sodium-potassium pump work and how many ions are moved?",
        "What is the fluid mosaic model according to Singer and Nicolson?",
        "What are the three stages of the Calvin cycle in photosynthesis?",
        "What is the net ATP yield of glycolysis in cellular respiration?",
        "Who led the storming of the Bastille in 1789?", // Out-of-scope test
      ];
    }
    // Default: physics
    return [
      "What is Newton's first law and how does mass relate to inertia?",
      "State Newton's second law and define the Newton unit.",
      "Why do action-reaction force pairs never cancel each other out?",
      "What is the work-energy theorem?",
      "Explain the process of meiosis in plant gametes.", // Out-of-scope test
    ];
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;
    onAsk(question.trim(), mode);
  };

  const modeOptions: { id: StudyMode; label: string; desc: string }[] = [
    {
      id: 'detailed',
      label: 'Detailed',
      desc: 'Deep conceptual breakdown with page citations',
    },
    {
      id: 'short_notes',
      label: 'Short Notes',
      desc: 'Concise bullet points for rapid revision',
    },
    {
      id: 'exam_style',
      label: 'Exam Style',
      desc: 'Structured with Definition, Key Mechanisms & Summary',
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      {/* Active Textbook Banner */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                Active Grounding Textbook
              </span>
              <span className="text-xs bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded font-mono">
                {selectedBook.edition || 'Confirmed Edition'}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mt-0.5">
              {selectedBook.title}
            </h2>
            <p className="text-xs text-slate-300">
              By {selectedBook.author} ({selectedBook.year || '2020'}) • {selectedBook.subject}
            </p>
          </div>
        </div>

        <button
          onClick={onChangeBook}
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-semibold transition border border-white/10"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Change Textbook</span>
        </button>
      </div>

      {/* Query Form */}
      <form onSubmit={handleSubmit} className="p-6">
        {/* Mode Selector */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Output Format Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {modeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                className={`text-left p-3 rounded-xl border text-xs transition-all ${
                  mode === opt.id
                    ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20 text-navy-900 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-navy-900">{opt.label}</span>
                  {mode === opt.id && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
                </div>
                <p className="text-slate-500 text-xs leading-relaxed">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Question Textarea */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="question-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Your Academic Question
            </label>
            <span className="text-xs text-slate-400">
              Grounded exclusively in {selectedBook.title}
            </span>
          </div>
          <div className="relative">
            <textarea
              id="question-input"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask any question covered by ${selectedBook.title} (e.g. key definitions, mechanisms, equations, or laws)...`}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Suggested Queries */}
        <div className="mb-5">
          <span className="text-xs font-semibold text-slate-500 inline-flex items-center space-x-1 mb-2">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Sample Textbook Queries:</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((sq, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuestion(sq)}
                className="text-xs bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition text-left"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500 hidden sm:block">
            Strict rule: if not clearly answered in indexed pages, VERITY refuses outside knowledge.
          </p>

          <button
            type="submit"
            disabled={!question.trim() || isLoading}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm shadow transition flex items-center space-x-2 ${
              !question.trim() || isLoading
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Searching & Grounding...</span>
              </>
            ) : (
              <>
                <span>Ask Textbook</span>
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
