import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LibrarySelector } from './components/LibrarySelector';
import { BookSelector } from './components/BookSelector';
import { QuestionBox } from './components/QuestionBox';
import { AnswerView } from './components/AnswerView';
import { HistoryPage } from './components/HistoryPage';
import { Book, AskResponse, StudyMode } from './types';
import { fetchCatalogue, fetchLibraries, askQuestion, checkBackendHealth } from './api';
import { ShieldCheck } from 'lucide-react';

type AppPage = 'study' | 'history';

export const App: React.FC = () => {
  // ── Page routing ────────────────────────────────
  const [currentPage, setCurrentPage] = useState<AppPage>('study');

  // ── Catalogue & library data ────────────────────
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [libraries, setLibraries] = useState<string[]>([]);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(true);

  // ── Study-flow state ────────────────────────────
  const [selectedLibrary, setSelectedLibrary] = useState<string | null>(null);
  const [libraryBooks, setLibraryBooks] = useState<Book[]>([]);
  const [isLoadingLibraryBooks, setIsLoadingLibraryBooks] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const [lastMode, setLastMode] = useState<StudyMode>('detailed');

  // ── Backend health ──────────────────────────────
  const [isBackendHealthy, setIsBackendHealthy] = useState(true);

  // ── Computed book counts per library ────────────
  const bookCounts: Record<string, number> = {};
  allBooks.forEach((b) => {
    if (!bookCounts[b.library]) bookCounts[b.library] = 0;
    bookCounts[b.library]++;
  });

  // ── Load initial data ────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsLoadingCatalogue(true);
      try {
        const [booksData, libData] = await Promise.all([fetchCatalogue(), fetchLibraries()]);
        setAllBooks(booksData);
        setLibraries(libData);
      } catch (err) {
        console.error('Error loading catalogue:', err);
      } finally {
        setIsLoadingCatalogue(false);
      }
    };
    load();

    const healthCheck = async () => setIsBackendHealthy(await checkBackendHealth());
    healthCheck();
    const interval = setInterval(healthCheck, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Library selection: load its books ───────────
  const handleSelectLibrary = async (library: string) => {
    setSelectedLibrary(library);
    setSelectedBook(null);
    setAskResponse(null);
    setAskError(null);
    setIsLoadingLibraryBooks(true);
    try {
      const books = await fetchCatalogue({ library });
      setLibraryBooks(books);
    } catch (err) {
      console.error('Error loading library books:', err);
      setLibraryBooks([]);
    } finally {
      setIsLoadingLibraryBooks(false);
    }
  };

  // ── Book selection ───────────────────────────────
  const handleSelectBook = (book: Book) => {
    setSelectedBook(book);
    setAskResponse(null);
    setAskError(null);
  };

  // ── Go back to library selector ──────────────────
  const handleClearBook = () => {
    setSelectedBook(null);
    setAskResponse(null);
    setAskError(null);
  };

  // ── Go back to library list ──────────────────────
  const handleClearLibrary = () => {
    setSelectedLibrary(null);
    setSelectedBook(null);
    setAskResponse(null);
    setAskError(null);
  };

  // ── Ask a question ───────────────────────────────
  const handleAsk = async (question: string, mode: StudyMode) => {
    if (!selectedBook) return;
    setLastQuestion(question);
    setLastMode(mode);
    setIsAsking(true);
    setAskError(null);
    try {
      const resp = await askQuestion(selectedBook.id, question, mode);
      setAskResponse(resp);
    } catch (err: any) {
      setAskError(err.message || 'An error occurred while communicating with the server.');
      setAskResponse(null);
    } finally {
      setIsAsking(false);
    }
  };

  const handleRetry = () => {
    if (lastQuestion) handleAsk(lastQuestion, lastMode);
  };

  // ── Navigate between pages ────────────────────────
  const handleNavigate = (page: AppPage) => {
    setCurrentPage(page);
  };

  // ── Render ────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 selection:bg-teal-500 selection:text-white">
      <Navbar
        selectedBook={selectedBook}
        onClearBook={handleClearLibrary}
        isBackendHealthy={isBackendHealthy}
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />

      <main className="flex-1 pb-16">
        {currentPage === 'history' ? (
          <HistoryPage />
        ) : (
          // Study flow: Library → Book → Questions
          !selectedLibrary ? (
            <LibrarySelector
              libraries={libraries}
              bookCounts={bookCounts}
              onSelectLibrary={handleSelectLibrary}
              isLoading={isLoadingCatalogue}
            />
          ) : !selectedBook ? (
            <div className="max-w-6xl mx-auto px-4 py-8">
              {/* Back to library nav */}
              <button
                onClick={handleClearLibrary}
                className="mb-6 text-sm text-teal-600 hover:text-teal-800 flex items-center gap-1.5 font-medium"
              >
                ← Back to Libraries
              </button>

              <div className="text-center max-w-3xl mx-auto mb-8">
                <div className="inline-flex items-center space-x-2 bg-teal-50 text-teal-800 border border-teal-200 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
                  <span>Library: {selectedLibrary}</span>
                </div>
                <h1 className="text-3xl font-extrabold text-navy-900">Choose a Textbook</h1>
                <p className="mt-2 text-slate-600">
                  Select a book below. Your answers will be grounded only in its indexed pages.
                </p>
              </div>

              <BookSelector
                books={libraryBooks}
                onSelectBook={handleSelectBook}
                isLoading={isLoadingLibraryBooks}
              />
            </div>
          ) : (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
              {/* Back to book selector */}
              <button
                onClick={handleClearBook}
                className="mb-4 text-sm text-teal-600 hover:text-teal-800 flex items-center gap-1.5 font-medium"
              >
                ← Change Textbook
              </button>

              <QuestionBox
                selectedBook={selectedBook}
                onAsk={handleAsk}
                isLoading={isAsking}
                onChangeBook={handleClearBook}
              />

              <AnswerView
                response={askResponse}
                isLoading={isAsking}
                error={askError}
                selectedBook={selectedBook}
                onRetry={handleRetry}
              />
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="bg-navy-950 text-slate-400 border-t border-navy-900 py-8 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-teal-600 flex items-center justify-center text-white font-bold text-xs">
              V
            </div>
            <span className="font-semibold text-slate-200">VERITY Grounded MVP</span>
            <span>• Academic Study Assistant</span>
          </div>

          <div className="flex items-center space-x-6 text-slate-400">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>Strictly Grounded Retrieval</span>
            </span>
            <span>SQLite FTS5 BM25</span>
            <span>No Embeddings</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
