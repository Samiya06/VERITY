import React, { useState, useMemo } from 'react';
import { Search, Filter, Lock, CheckCircle, ExternalLink, BookCheck, Info } from 'lucide-react';
import { Book } from '../types';

interface BookSelectorProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  isLoading: boolean;
}

export const BookSelector: React.FC<BookSelectorProps> = ({
  books,
  onSelectBook,
  isLoading,
}) => {
  const [selectedField, setSelectedField] = useState<string>('All');
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingBook, setPendingBook] = useState<Book | null>(null);

  // Derive unique fields
  const fields = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.field) set.add(b.field);
    });
    return ['All', ...Array.from(set)];
  }, [books]);

  // Derive unique subjects based on selected field
  const subjects = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (selectedField === 'All' || b.field === selectedField) {
        if (b.subject) set.add(b.subject);
      }
    });
    return ['All', ...Array.from(set)];
  }, [books, selectedField]);

  // Filter books
  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      // Field filter
      if (selectedField !== 'All' && book.field !== selectedField) return false;
      // Subject filter
      if (selectedSubject !== 'All' && book.subject !== selectedSubject) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = book.title.toLowerCase().includes(q);
        const matchesAuthor = book.author.toLowerCase().includes(q);
        const matchesSubject = book.subject.toLowerCase().includes(q);
        if (!matchesTitle && !matchesAuthor && !matchesSubject) return false;
      }
      return true;
    });
  }, [books, selectedField, selectedSubject, searchQuery]);

  const handleFieldChange = (field: string) => {
    setSelectedField(field);
    setSelectedSubject('All'); // Reset subject when field changes
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Intro Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center space-x-2 bg-teal-50 text-teal-800 border border-teal-200 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
          <span>Step 1: Choose Your Textbook</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
          Select Your Grounding Textbook
        </h1>
        <p className="mt-3 text-base text-slate-600">
          VERITY answers questions strictly from the chosen textbook's indexed pages.
          Select an indexed volume below to begin your study session.
        </p>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Field Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              1. Academic Field
            </label>
            <select
              value={selectedField}
              onChange={(e) => handleFieldChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            >
              {fields.map((f) => (
                <option key={f} value={f}>
                  {f === 'All' ? 'All Fields' : f}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Subject Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              2. Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All Subjects' : s}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Search input */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              3. Search Title or Author
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Biology, Newton, Clark..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Book Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-4" />
              <div className="h-10 bg-slate-100 rounded mb-4" />
              <div className="h-8 bg-slate-200 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-8">
          <Filter className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-800">No textbooks match your filters</h3>
          <p className="text-sm text-slate-500 mt-1">
            Try resetting your field or search term to see all available textbooks.
          </p>
          <button
            onClick={() => {
              setSelectedField('All');
              setSelectedSubject('All');
              setSearchQuery('');
            }}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredBooks.map((book) => {
            const isIndexed = book.access_status === 'indexed';

            return (
              <div
                key={book.id}
                className={`flex flex-col justify-between bg-white rounded-xl border transition-all duration-200 ${
                  isIndexed
                    ? 'border-slate-200 hover:border-teal-400 hover:shadow-md'
                    : 'border-slate-200 bg-slate-50/60 opacity-80'
                } p-6 relative`}
              >
                <div>
                  {/* Subject badge and status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {book.subject} • {book.field}
                    </span>

                    {isIndexed ? (
                      <span className="inline-flex items-center text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3 mr-1 text-teal-600" />
                        Indexed & Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                        <Lock className="w-3 h-3 mr-1 text-rose-500" />
                        Unavailable
                      </span>
                    )}
                  </div>

                  {/* Title & Author */}
                  <h3 className="text-lg font-bold text-navy-900 leading-snug">
                    {book.title}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    By <span className="font-medium text-slate-800">{book.author}</span>
                  </p>

                  {/* Edition & Year info */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 font-mono">
                    {book.edition && <span>Edition: <strong className="text-slate-700">{book.edition}</strong></span>}
                    {book.year && <span>Year: <strong className="text-slate-700">{book.year}</strong></span>}
                  </div>

                  {/* License Notice */}
                  {book.licence && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-1" title={book.licence}>
                      Licence: {book.licence}
                    </p>
                  )}

                  {/* Unavailable warning notice */}
                  {!isIndexed && (
                    <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start space-x-2">
                      <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">
                          Unavailable: not indexed (permission or licence required)
                        </strong>
                        <p className="text-rose-700 mt-0.5">
                          This copyrighted textbook is registered in the catalogue but cannot be queried without licensing authorization.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action button */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  {book.source_url ? (
                    <a
                      href={book.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-teal-700 flex items-center hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      View Publisher
                    </a>
                  ) : (
                    <span />
                  )}

                  {isIndexed ? (
                    <button
                      onClick={() => setPendingBook(book)}
                      className="px-4 py-2 bg-navy-900 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center space-x-1.5"
                    >
                      <span>Select Edition</span>
                      <BookCheck className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      disabled
                      aria-disabled="true"
                      className="px-4 py-2 bg-slate-200 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed flex items-center space-x-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Unavailable (Cannot Select)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {pendingBook && (
        <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-teal-700 mb-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                <BookCheck className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy-900">Confirm Textbook Edition</h3>
                <p className="text-xs text-slate-500">Step 4: Confirm edition details before asking</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 my-4 border border-slate-200 text-sm space-y-2">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Title</span>
                <span className="font-semibold text-navy-900">{pendingBook.title}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Edition</span>
                  <span className="text-slate-800">{pendingBook.edition || 'Official Edition'}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Publication Year</span>
                  <span className="text-slate-800">{pendingBook.year || 'N/A'}</span>
                </div>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Authors</span>
                <span className="text-slate-700 text-xs">{pendingBook.author}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Licence</span>
                <span className="text-slate-600 text-xs">{pendingBook.licence || 'Public / Open Access'}</span>
              </div>
            </div>

            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs text-teal-900 flex items-start space-x-2 mb-5">
              <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <span>
                All questions asked during this session will be grounded <strong>ONLY</strong> in this confirmed volume.
              </span>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setPendingBook(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const bookToSelect = pendingBook;
                  setPendingBook(null);
                  onSelectBook(bookToSelect);
                }}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow transition"
              >
                Confirm & Begin Study
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
