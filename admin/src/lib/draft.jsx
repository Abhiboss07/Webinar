import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { api } from "./api.js";

/* Immutable nested set: setPath(obj, ["workshop","price"], "₹149"). */
export function setPath(obj, path, value) {
  if (!path.length) return value;
  const [head, ...rest] = path;
  const base = obj && typeof obj === "object" ? obj : {};
  return { ...base, [head]: setPath(base[head], rest, value) };
}
export const getPath = (obj, path) => path.reduce((o, k) => (o == null ? o : o[k]), obj);

const DraftCtx = createContext(null);

/**
 * Owns the editable DRAFT of the site content: load, debounced autosave, and the
 * publish / discard / revert actions. Shared by the Content and Sections pages so
 * edits in either place feed one draft and one publish button.
 */
export function DraftProvider({ children }) {
  const [config, setConfigState] = useState(null);
  const [status, setStatus] = useState("saved");   // saved | dirty | saving | error
  const [hasDraft, setHasDraft] = useState(false);  // an unpublished draft exists
  const [meta, setMeta] = useState({ publishedAt: null, draftUpdatedAt: null, version: null });
  const latest = useRef(null);
  const timer = useRef(null);
  const retryAttempt = useRef(0);

  const load = useCallback(async () => {
    const r = await api.getDraft();
    setConfigState(r.data);
    latest.current = r.data;
    setHasDraft(!!r.hasDraft);
    setMeta({ publishedAt: r.publishedAt, draftUpdatedAt: r.draftUpdatedAt, version: r.version });
    setStatus("saved");
  }, []);

  useEffect(() => { load().catch(() => setStatus("error")); }, [load]);

  // Flush any pending autosave if the provider unmounts (e.g. logout / close).
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); api.saveDraft(latest.current).catch(() => {}); }
  }, []);

  const persist = useCallback(async () => {
    setStatus("saving");
    try {
      const r = await api.saveDraft(latest.current);
      retryAttempt.current = 0;
      setHasDraft(true);
      setMeta((m) => ({ ...m, draftUpdatedAt: r.draftUpdatedAt }));
      setStatus("saved");
    } catch (_) {
      setStatus("error");
      // Transient failures (server cold start, brief network drop) must not
      // strand unsaved edits until the user happens to type again — retry
      // automatically with capped backoff. A new edit supersedes the retry
      // (scheduleSave reuses the same timer slot).
      if (retryAttempt.current < 5) {
        const delay = Math.min(30000, 4000 * 2 ** retryAttempt.current);
        retryAttempt.current += 1;
        clearTimeout(timer.current);
        timer.current = setTimeout(persist, delay);
      }
    }
  }, []);

  const scheduleSave = useCallback(() => {
    setStatus("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(persist, 900);
  }, [persist]);

  // Update a nested value (guided fields).
  const update = useCallback((path, value) => {
    setConfigState((prev) => {
      const next = setPath(prev, path, value);
      latest.current = next;
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  // Replace the whole config (JSON editor, drag-reorder, toggles).
  const setConfig = useCallback((next) => {
    setConfigState(next);
    latest.current = next;
    scheduleSave();
  }, [scheduleSave]);

  const saveNow = useCallback(async () => { clearTimeout(timer.current); await persist(); }, [persist]);

  const publish = useCallback(async () => {
    await saveNow();
    const r = await api.publish();
    setHasDraft(false);
    setMeta((m) => ({ ...m, publishedAt: r.publishedAt, version: r.version, draftUpdatedAt: null }));
    setStatus("saved");
    return r;
  }, [saveNow]);

  const discard = useCallback(async () => {
    clearTimeout(timer.current);
    await api.discardDraft();
    await load();
  }, [load]);

  const revert = useCallback(async (version) => {
    clearTimeout(timer.current);
    await api.revert(version);
    await load();
  }, [load]);

  const value = {
    config, status, hasDraft, meta,
    update, setConfig, saveNow, publish, discard, revert, reload: load,
  };
  return <DraftCtx.Provider value={value}>{children}</DraftCtx.Provider>;
}

export const useDraft = () => useContext(DraftCtx);
