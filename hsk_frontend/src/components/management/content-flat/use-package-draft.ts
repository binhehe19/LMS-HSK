"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ContentPackage } from "@/types/content";
import type { PackageDraftFields } from "@/lib/api/package-edit-session-client";
import { PACKAGE_HEARTBEAT_MS, PACKAGE_IDLE_MS, type PackageEditDraft } from "./use-package-edit-session";

export type PackageSaveProgress = {
  fieldsSaved: () => void;
  syllabusSaved: (id: string) => void;
};

const same = (a: PackageDraftFields, b: PackageDraftFields) =>
  a.title === b.title && a.description === b.description && a.sessionCount === b.sessionCount;

export function usePackageDraft({ pkg, draft, draftRevision, canWrite, hasLock, busy, onHeartbeat }: {
  pkg: ContentPackage;
  draft?: PackageEditDraft;
  draftRevision: number;
  canWrite: boolean;
  hasLock?: () => boolean;
  busy: boolean;
  onHeartbeat?: (fields?: PackageDraftFields) => Promise<boolean>;
}) {
  const [form, setForm] = useState<PackageDraftFields>(() => ({
    title: draft ? draft.title ?? "" : pkg.name,
    description: draft ? draft.description ?? "" : pkg.description ?? "",
    sessionCount: draft?.sessionCount ?? pkg.sessionCount ?? 1,
  }));
  const [saved, setSaved] = useState(() => ({ ...form, title: form.title.trim() }));
  const [initialRevision] = useState(draftRevision);
  const [exitBaseline, setExitBaseline] = useState(() => ({ fields: saved, draftRevision }));
  const [appliedDraft, setAppliedDraft] = useState(draft);
  const [savedSyllabus, setSavedSyllabus] = useState(pkg.syllabusId ?? undefined);
  const [pendingSyllabus, setPendingSyllabus] = useState<string>();
  const [autosaving, setAutosaving] = useState(false);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const flight = useRef(false);
  const fields = { ...form, title: form.title.trim() };
  const syllabusChanged = !!pendingSyllabus && pendingSyllabus !== savedSyllabus;
  const metadataDirty = !same(fields, saved);
  const dirty = metadataDirty || syllabusChanged || autosaving;
  const hasChanges = dirty || !same(fields, exitBaseline.fields) || draftRevision !== exitBaseline.draftRevision;
  const candidate = draft && draft !== appliedDraft ? {
    title: draft.title?.trim() ?? "",
    description: draft.description ?? "",
    sessionCount: draft.sessionCount ?? pkg.sessionCount ?? 1,
  } : undefined;
  const conflict = !!(candidate && appliedDraft && (metadataDirty || syllabusChanged) &&
    (appliedDraft.id !== draft?.id ||
      (fields.title !== saved.title && candidate.title !== saved.title && candidate.title !== fields.title) ||
      (fields.description !== saved.description && candidate.description !== saved.description && candidate.description !== fields.description) ||
      (fields.sessionCount !== saved.sessionCount && candidate.sessionCount !== saved.sessionCount && candidate.sessionCount !== fields.sessionCount)));
  const acceptRemote = () => {
    if (!candidate) return;
    setAppliedDraft(draft);
    setForm(candidate);
    setSaved(candidate);
    setExitBaseline({ fields: candidate, draftRevision });
    setPendingSyllabus(undefined);
    setAutosaveFailed(false);
  };
  if (candidate && !conflict) {
    if (!appliedDraft || appliedDraft.id !== draft?.id) acceptRemote();
    else {
      setForm({
        title: fields.title === saved.title ? candidate.title : form.title,
        description: fields.description === saved.description ? candidate.description : fields.description,
        sessionCount: fields.sessionCount === saved.sessionCount ? candidate.sessionCount : fields.sessionCount,
      });
      setExitBaseline(previous => ({
        ...previous,
        fields: {
          title: fields.title === previous.fields.title ? candidate.title : previous.fields.title,
          description: fields.description === previous.fields.description ? candidate.description : previous.fields.description,
          sessionCount: fields.sessionCount === previous.fields.sessionCount ? candidate.sessionCount : previous.fields.sessionCount,
        },
      }));
      setSaved(candidate);
      setAppliedDraft(draft);
      setAutosaveFailed(false);
    }
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const tick = useEffectEvent(async () => {
    if (!onHeartbeat || flight.current || (hasLock && !hasLock())) return;
    const snapshot = !busy && !candidate && metadataDirty && fields.title ? fields : undefined;
    flight.current = true;
    if (snapshot) setAutosaving(true);
    try {
      if (await onHeartbeat(snapshot) && snapshot) {
        setSaved(snapshot);
        setAutosaveFailed(false);
      }
    } catch {
      if (snapshot) setAutosaveFailed(true);
    } finally {
      flight.current = false;
      if (snapshot) setAutosaving(false);
    }
  });
  const heartbeatEnabled = canWrite && !!onHeartbeat;
  useEffect(() => {
    if (!heartbeatEnabled) return;
    let lastActivity = Date.now();
    const activity = () => {
      lastActivity = Date.now();
      setIdleWarning(false);
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    for (const event of events) window.addEventListener(event, activity, { passive: true, capture: true });
    const timer = window.setInterval(() => {
      const idle = Date.now() - lastActivity;
      setIdleWarning(idle >= PACKAGE_IDLE_MS - 60_000);
      if (idle < PACKAGE_IDLE_MS) void tick();
    }, PACKAGE_HEARTBEAT_MS);
    const onVisible = () => { if (document.visibilityState === "visible" && Date.now() - lastActivity < PACKAGE_IDLE_MS) void tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      for (const event of events) window.removeEventListener(event, activity, true);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [heartbeatEnabled]);

  const catalogChanged = draftRevision !== initialRevision || savedSyllabus !== (pkg.syllabusId ?? undefined) ||
    (!!draft && pkg.hasDraft === false) ||
    !same(saved, { title: pkg.name.trim(), description: pkg.description ?? "", sessionCount: pkg.sessionCount ?? 1 });
  return {
    form, dirty, hasChanges, catalogChanged, idleWarning, autosaving, autosaveFailed, conflict, acceptRemote,
    setName: (title: string) => setForm(previous => ({ ...previous, title })),
    setDescription: (description: string) => setForm(previous => ({ ...previous, description })),
    setSessionCount: (sessionCount: number) => setForm(previous => ({ ...previous, sessionCount })),
    syllabusId: pendingSyllabus ?? savedSyllabus, savedSyllabus, syllabusChanged, setPendingSyllabus,
    acknowledgeFields: (snapshot: PackageDraftFields) => { setSaved(snapshot); setAutosaveFailed(false); },
    acknowledgeSyllabus: (id: string) => { setSavedSyllabus(id); setPendingSyllabus(undefined); },
    finishSave: (snapshot: PackageDraftFields, explicit: boolean) => {
      setForm(previous => ({ ...previous, sessionCount: snapshot.sessionCount }));
      if (explicit) setExitBaseline({ fields: snapshot, draftRevision });
    },
  };
}
