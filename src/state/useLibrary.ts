import { useCallback, useEffect, useReducer, useRef } from "react";
import { baseName, createId } from "../lib/format";
import { normalizeBookmark } from "../lib/bookmarks";
import { importBook, ImportError } from "../lib/importer";
import { DEFAULT_SETTINGS } from "../lib/settings";
import { deleteBookFile, emptyLibrary, loadLibrary, saveLibrary } from "../lib/storage";
import type { Book, Bookmark, LibraryData, Settings } from "../lib/types";

export interface LibraryState {
  status: "loading" | "ready";
  data: LibraryData;
  recovered: boolean;
  /** Last failures from an import, shown to the person and then cleared. */
  issues: ImportError[];
}

type Action =
  | { type: "loaded"; data: LibraryData; recovered: boolean }
  | { type: "books-added"; books: Book[]; issues: ImportError[] }
  | { type: "book-updated"; id: string; patch: Partial<Book> }
  | { type: "book-removed"; id: string }
  | { type: "bookmark-added"; bookmark: Bookmark }
  | { type: "bookmark-removed"; id: string }
  | { type: "bookmark-updated"; id: string; patch: Partial<Bookmark> }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "issues-cleared" };

const initial: LibraryState = {
  status: "loading",
  data: emptyLibrary(),
  recovered: false,
  issues: [],
};

function reducer(state: LibraryState, action: Action): LibraryState {
  switch (action.type) {
    case "loaded":
      return { status: "ready", data: action.data, recovered: action.recovered, issues: [] };
    case "books-added":
      return {
        ...state,
        data: { ...state.data, books: [...action.books, ...state.data.books] },
        issues: action.issues,
      };
    case "book-updated":
      return {
        ...state,
        data: {
          ...state.data,
          books: state.data.books.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)),
        },
      };
    case "book-removed":
      return {
        ...state,
        data: {
          ...state.data,
          books: state.data.books.filter((b) => b.id !== action.id),
          bookmarks: state.data.bookmarks.filter((m) => m.bookId !== action.id),
        },
      };
    case "bookmark-added":
      return { ...state, data: { ...state.data, bookmarks: [...state.data.bookmarks, action.bookmark] } };
    case "bookmark-updated":
      return {
        ...state,
        data: {
          ...state.data,
          bookmarks: state.data.bookmarks.map((m) => (m.id === action.id ? normalizeBookmark({ ...m, ...action.patch }) : m)),
        },
      };
    case "bookmark-removed":
      return {
        ...state,
        data: { ...state.data, bookmarks: state.data.bookmarks.filter((m) => m.id !== action.id) },
      };
    case "settings":
      return { ...state, data: { ...state.data, settings: { ...state.data.settings, ...action.patch } } };
    case "issues-cleared":
      return { ...state, issues: [] };
  }
}

const SAVE_DELAY_MS = 300;

export function useLibrary() {
  const [state, dispatch] = useReducer(reducer, initial);
  const timer = useRef<number | null>(null);
  const pending = useRef<LibraryData | null>(null);
  const booksRef = useRef<Book[]>([]);

  useEffect(() => {
    booksRef.current = state.data.books;
  }, [state.data.books]);

  useEffect(() => {
    let cancelled = false;
    loadLibrary()
      .then(({ data, recovered }) => {
        if (!cancelled) dispatch({ type: "loaded", data, recovered });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "loaded", data: emptyLibrary(), recovered: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced save: position updates arrive on every page turn, so we coalesce them.
  useEffect(() => {
    if (state.status !== "ready") return;
    pending.current = state.data;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const snapshot = pending.current;
      pending.current = null;
      if (snapshot) void saveLibrary(snapshot);
    }, SAVE_DELAY_MS);
  }, [state.status, state.data]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        if (pending.current) void saveLibrary(pending.current);
      }
    };
  }, []);

  const importPaths = useCallback(async (paths: string[]) => {
    const books: Book[] = [];
    const issues: ImportError[] = [];
    // Hashes of what is already in the library plus what this batch has added,
    // so the same file dropped twice in one go is also caught.
    const known = new Set(
      booksRef.current.map((b) => b.contentHash).filter((h): h is string => typeof h === "string"),
    );
    for (const path of paths) {
      try {
        const book = await importBook(path, {
          isDuplicate: (hash) => known.has(hash),
        });
        if (book.contentHash) known.add(book.contentHash);
        books.push(book);
      } catch (error) {
        if (error instanceof ImportError) issues.push(error);
        else issues.push(new ImportError("unreadable", baseName(path)));
      }
    }
    if (books.length > 0 || issues.length > 0) {
      dispatch({ type: "books-added", books, issues });
    }
    return { imported: books.length, issues };
  }, []);

  const updateBook = useCallback((id: string, patch: Partial<Book>) => {
    dispatch({ type: "book-updated", id, patch });
  }, []);

  const removeBook = useCallback(async (book: Book) => {
    dispatch({ type: "book-removed", id: book.id });
    await deleteBookFile(book.storedPath);
    if (book.coverPath) await deleteBookFile(book.coverPath);
  }, []);

  const addBookmark = useCallback((input: Omit<Bookmark, "id" | "createdAt">) => {
    const bookmark: Bookmark = { ...input, id: createId(), createdAt: Date.now() };
    dispatch({ type: "bookmark-added", bookmark });
    return bookmark;
  }, []);

  const updateBookmark = useCallback((id: string, patch: Partial<Bookmark>) => {
    dispatch({ type: "bookmark-updated", id, patch });
  }, []);

  const removeBookmark = useCallback((id: string) => {
    dispatch({ type: "bookmark-removed", id });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    dispatch({ type: "settings", patch });
  }, []);

  const clearIssues = useCallback(() => dispatch({ type: "issues-cleared" }), []);

  return {
    state,
    settings: state.data.settings ?? DEFAULT_SETTINGS,
    importPaths,
    updateBook,
    removeBook,
    addBookmark,
    updateBookmark,
    removeBookmark,
    updateSettings,
    clearIssues,
  };
}

export type LibraryActions = ReturnType<typeof useLibrary>;
