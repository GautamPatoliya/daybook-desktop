"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, I } from "../lib/icons";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { api } from "../lib/api";
import { emitSpiderFx } from "../lib/spiderFx";
import {
  addDays,
  formatDisplayDate,
  formatShortDate,
  formatTime12h,
} from "../lib/format";
import { Select } from "../components/Select";
import { EmailChipInput } from "../components/EmailChipInput";
import { useDialog } from "../components/DialogProvider";
import { DatePicker } from "../components/DatePicker";
import PixelEmptyState from "../components/PixelEmptyState";
import SpideyLoader from "../components/SpideyLoader";
import BoardWebDecor from "../components/spider/BoardWebDecor";
import { TaskDetailsEditor } from "../components/TaskDetailsEditor";
import { Input } from "../components/ui/input";
import Scrollbar from "../components/Scrollbar";
import { consumeBoardAction } from "../components/GlobalActionRouter";
import {
  deriveSubItemsFromHtml,
  loadDetailsHtml,
  sanitizeDetailsHtml,
} from "../lib/detailsHtml";
import {
  mergeSuggestionPool,
  upsertEmailHistory,
} from "../lib/emailRecipients";
import {
  buildGmailComposeUrl,
  renderEmailMarkdownPreview,
} from "../../shared/email";
import type {
  DayPayload,
  EmailDraft,
  ProjectMeta,
  Task,
  TaskPriority,
  TaskStatus,
} from "../../shared/types";
import type { CSSProperties } from "react";

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function priorityLabel(p: TaskPriority) {
  if (p === "high") return "High";
  if (p === "low") return "Low";
  return "Normal";
}

function projectColor(meta: ProjectMeta[] | undefined, name: string) {
  return meta?.find((p) => p.name === name)?.color || "#3b82f6";
}

const STATUS_META: Record<
  TaskStatus,
  { label: string; icon: string; accent: string }
> = {
  none: { label: "Backlog", icon: I.none, accent: "var(--status-none)" },
  wip: { label: "In progress", icon: I.wip, accent: "var(--status-wip)" },
  done: { label: "Done", icon: I.check, accent: "var(--status-done)" },
};

/** Must match DragOverlay dropAnimation.duration - keep overlay mounted until it finishes. */
const DRAG_DROP_MS = 220;

function taskStats(tasks: Task[]) {
  return {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    wip: tasks.filter((t) => t.status === "wip").length,
    none: tasks.filter((t) => t.status === "none").length,
  };
}

function TaskCard({
  task,
  projectMeta,
  onOpen,
  overlay,
  dragSize,
  settling,
}: {
  task: Task;
  projectMeta?: ProjectMeta[];
  onOpen: (task: Task) => void;
  overlay?: boolean;
  /** Measured source size - keeps placeholder/overlay as a true clone. */
  dragSize?: { width: number; height: number } | null;
  /** Hide list instance while drop animation finishes (avoids double-card flicker). */
  settling?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status },
    disabled: overlay,
  });
  const color = projectColor(projectMeta, task.project);
  const priority = task.priority || "medium";
  const meta = STATUS_META[task.status];
  const subs = task.subItems.slice(0, 3);

  /* Keep layout stable: show a slot where the card left, not a broken ghost. */
  if ((isDragging || settling) && !overlay) {
    return (
      <div
        ref={isDragging ? setNodeRef : undefined}
        className={`card-drag-placeholder${settling ? " is-settling" : ""}`}
        aria-hidden
        style={
          {
            "--card-accent": meta.accent,
            ...(dragSize
              ? { height: dragSize.height, minHeight: dragSize.height }
              : null),
          } as CSSProperties
        }
      />
    );
  }

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      data-task-id={overlay ? undefined : task.id}
      className={`card status-${task.status}${overlay ? " card--overlay" : ""}`}
      style={{ "--card-accent": meta.accent } as CSSProperties}
    >
      <div className="card-top">
        <button
          type="button"
          className={`card-grip${overlay ? " is-dragging" : ""}`}
          aria-label="Drag task"
          tabIndex={overlay ? -1 : undefined}
          {...(overlay ? {} : { ...listeners, ...attributes })}
        >
          <Icon icon={I.grip} width={16} />
        </button>
        <button
          type="button"
          className="card-body-btn"
          onClick={() => onOpen(task)}
          tabIndex={overlay ? -1 : undefined}
        >
          <h3 className="card-title">{task.title}</h3>
          <div className="card-meta">
            <span className="tag" style={{ color, borderColor: `${color}44` }}>
              <span className="dot" style={{ background: color }} />
              {task.project}
            </span>
            <span className="tag">
              <Icon icon={I.tag} width={12} />
              {task.category}
            </span>
            {priority === "high" && (
              <span className="tag priority-high">
                <Icon icon={I.flag} width={12} />
                High
              </span>
            )}
          </div>
          {subs.length > 0 && (
            <ul className="card-subs">
              {subs.map((s, i) => (
                <li key={i}>
                  <Icon icon={I.dot} width={8} className="sub-dot" />
                  <span>{s.enhanced || s.text}</span>
                </li>
              ))}
              {task.subItems.length > 3 && (
                <li className="more-subs">
                  +{task.subItems.length - 3} more items
                </li>
              )}
            </ul>
          )}
        </button>
      </div>
      <footer className="card-foot">
        <span className="card-time">
          <Icon icon={I.clock} width={13} />
          {formatTime12h(task.updatedAt)}
        </span>
        {task.carriedFrom && task.status !== "done" ? (
          <span className="carried">
            <Icon icon={I.carry} width={13} />
            from {formatShortDate(task.carriedFrom)}
          </span>
        ) : (
          <span className="card-priority-label">{priorityLabel(priority)}</span>
        )}
      </footer>
    </article>
  );
}

function Column({
  status,
  tasks,
  projectMeta,
  onOpen,
  activeId,
  settlingId,
  dragSize,
}: {
  status: TaskStatus;
  tasks: Task[];
  projectMeta?: ProjectMeta[];
  onOpen: (t: Task) => void;
  activeId?: string | null;
  settlingId?: string | null;
  dragSize?: { width: number; height: number } | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  const meta = STATUS_META[status];

  return (
    <section
      className={`column col-${status}${isOver ? " is-drop-target" : ""}`}
      data-sv-col={status}
    >
      <header className="column-header">
        <div className="column-header-inner">
          <span className="column-icon" style={{ color: meta.accent }}>
            <Icon icon={meta.icon} width={18} />
          </span>
          <span>{meta.label}</span>
          <span className="column-count">{tasks.length}</span>
        </div>
      </header>
      <div
        ref={setNodeRef}
        className={`column-scroll-host${isOver ? " drag-over" : ""}${tasks.length === 0 ? " is-empty" : ""}`}
      >
        {/* Empty columns fill the host directly - Radix scroll % height cannot stretch reliably. */}
        {tasks.length === 0 ? (
          <div className={`empty-container${isOver ? " is-drop-ready" : ""}`}>
            <div className="empty empty-default">
              <Icon icon={I.empty} width={28} className="empty-icon" />
              <p>{isOver ? "Release to drop" : "Drop tasks here"}</p>
            </div>
            <PixelEmptyState status={status} />
          </div>
        ) : (
          <Scrollbar orientation="vertical" autoHide className="column-body-scroll">
            <div className="column-body">
              {tasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  projectMeta={projectMeta}
                  onOpen={onOpen}
                  dragSize={
                    activeId === t.id || settlingId === t.id ? dragSize : null
                  }
                  settling={settlingId === t.id}
                />
              ))}
              {isOver ? (
                <div className="column-drop-slot" aria-hidden>
                  <Icon icon={I.plus} width={14} />
                  <span>Drop here</span>
                </div>
              ) : null}
            </div>
          </Scrollbar>
        )}
      </div>
    </section>
  );
}

export default function BoardPage() {
  const { confirm } = useDialog();
  const [day, setDay] = useState<DayPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | "all">("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [mailOpen, setMailOpen] = useState(false);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [recipientHistory, setRecipientHistory] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Snapshot kept through drop animation (activeId clears earlier). */
  const [dragOverlayTask, setDragOverlayTask] = useState<Task | null>(null);
  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const dragClearTimer = useRef<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [composerDetailsHtml, setComposerDetailsHtml] = useState("");
  const [drawerDetailsHtml, setDrawerDetailsHtml] = useState("");
  const [project, setProject] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<TaskStatus>("wip");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [busy, setBusy] = useState(false);
  const [mailBusy, setMailBusy] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectTarget, setNewProjectTarget] = useState<"composer" | "edit">(
    "composer",
  );
  const [projectBusy, setProjectBusy] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const defaultProjectRef = useRef("General");
  const defaultCategoryRef = useRef("Other");
  /** Live composer snapshot - reminders must not wipe an in-progress draft. */
  const composerSnapshotRef = useRef({
    open: false,
    title: "",
    detailsHtml: "",
  });

  const resetComposerFields = useCallback(() => {
    setTaskTitle("");
    setComposerDetailsHtml("");
    setProject(defaultProjectRef.current);
    setCategory(defaultCategoryRef.current);
    setStatus("wip");
    setPriority("medium");
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const reminderLock = useRef(false);

  useEffect(() => {
    composerSnapshotRef.current = {
      open: composerOpen,
      title: taskTitle,
      detailsHtml: composerDetailsHtml,
    };
  }, [composerOpen, taskTitle, composerDetailsHtml]);

  useEffect(() => {
    return () => {
      if (dragClearTimer.current != null) {
        window.clearTimeout(dragClearTimer.current);
      }
    };
  }, []);

  const load = useCallback(async (date?: string) => {
    try {
      setError(null);
      const settings = await api.getSettings();
      if (!settings.onboardingComplete) {
        window.location.href = "/onboarding/";
        return;
      }
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: settings.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const g = (t: string) => parts.find((p) => p.type === t)?.value || "00";
      const today = `${g("year")}-${g("month")}-${g("day")}`;
      const payload = await api.initDay(date || today);
      setDay(payload);
      setTo(payload.config.emailTo || "");
      setCc(payload.config.emailCc || "");
      setRecipientHistory(settings.emailRecipientHistory || []);
      defaultProjectRef.current = payload.config.defaultProject || payload.config.projects[0] || "General";
      defaultCategoryRef.current = payload.config.defaultCategory || payload.config.categories[0] || "Other";
      setProject((prev) => prev || defaultProjectRef.current);
      setCategory((prev) => prev || defaultCategoryRef.current);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function applyReminder(mode?: string | null) {
      if (!mode || cancelled || reminderLock.current) return;
      reminderLock.current = true;
      try {
        if (mode === "hourly") {
          const snap = composerSnapshotRef.current;
          const dirty =
            snap.open &&
            (snap.title.trim().length > 0 ||
              sanitizeDetailsHtml(snap.detailsHtml).replace(/<[^>]*>/g, "").trim()
                .length > 0);
          if (dirty) {
            // Keep the user's draft; only surface that a check-in fired.
            showToast("Hourly reminder - finish your draft, then save");
            return;
          }
          if (!snap.open) {
            resetComposerFields();
            setComposerOpen(true);
          } else {
            // Empty composer already open - leave fields alone.
            setComposerOpen(true);
          }
          return;
        }
        if (mode === "eod") {
          setDraft(null);
          setMailBusy(true);
          setMailOpen(true);
          try {
            const settings = await api.getSettings();
            const parts = new Intl.DateTimeFormat("en-CA", {
              timeZone: settings.timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).formatToParts(new Date());
            const g = (t: string) => parts.find((p) => p.type === t)?.value || "00";
            const today = `${g("year")}-${g("month")}-${g("day")}`;
            const payload = await api.initDay(today);
            if (cancelled) return;
            setDay(payload);
            setTo(payload.config.emailTo || "");
            setCc(payload.config.emailCc || "");
            setRecipientHistory(settings.emailRecipientHistory || []);
            const d = await api.emailDraft(today, false);
            if (cancelled) return;
            setDraft(d);
          } catch (err) {
            if (!cancelled) showToast((err as Error).message);
          } finally {
            if (!cancelled) setMailBusy(false);
          }
        }
      } finally {
        window.setTimeout(() => {
          reminderLock.current = false;
        }, 1500);
      }
    }

    void load();
    void api.consumeReminder().then((r) => applyReminder(r?.mode));

    const off = window.wtt?.on("reminder:open", (payload) => {
      const mode = (payload as { mode?: string })?.mode;
      void applyReminder(mode);
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [load, showToast, resetComposerFields]);

  useEffect(() => {
    if (editing) {
      setDrawerDetailsHtml(loadDetailsHtml(editing));
    } else {
      setDrawerDetailsHtml("");
    }
  }, [editing?.id]);

  const openComposer = useCallback(() => {
    resetComposerFields();
    setComposerOpen(true);
  }, [resetComposerFields]);

  useEffect(() => {
    function handleBoardAction(action: string) {
      if (!day) return;

      if (action === 'new-task') {
        openComposer();
        return;
      }
      if (action === 'eod') {
        void openMail(false);
        return;
      }
      if (action === 'open-yesterday') {
        void (async () => {
          try {
            const dates = await api.listDates();
            const prev = dates.filter((d) => d < day.date).sort().pop();
            if (prev) {
              await load(prev);
              await openMail(false);
            } else showToast('No previous day found');
          } catch (err) {
            showToast((err as Error).message);
          }
        })();
      }
    }

    function runPending() {
      const pending = consumeBoardAction();
      if (pending?.action) handleBoardAction(pending.action);
    }

    runPending();
    const onPending = () => runPending();
    window.addEventListener('daybook:pending-action', onPending);
    return () => {
      window.removeEventListener('daybook:pending-action', onPending);
    };
  }, [day, openComposer, showToast, load]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const filtered = useMemo(() => {
    if (!day) return [];
    return day.tasks.filter(
      (t) => projectFilter === "all" || t.project === projectFilter,
    );
  }, [day, projectFilter]);

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { none: [], wip: [], done: [] };
    for (const t of filtered) map[t.status].push(t);
    return map;
  }, [filtered]);

  function clearDragState(immediate = true) {
    if (dragClearTimer.current != null) {
      window.clearTimeout(dragClearTimer.current);
      dragClearTimer.current = null;
    }
    setActiveId(null);
    if (immediate) {
      setDragOverlayTask(null);
      setDragSize(null);
      return;
    }
    // Let DragOverlay finish its drop animation before unmounting the clone.
    dragClearTimer.current = window.setTimeout(() => {
      setDragOverlayTask(null);
      setDragSize(null);
      dragClearTimer.current = null;
    }, DRAG_DROP_MS);
  }

  function onDragStart(event: DragStartEvent) {
    if (dragClearTimer.current != null) {
      window.clearTimeout(dragClearTimer.current);
      dragClearTimer.current = null;
    }
    const id = String(event.active.id);
    setActiveId(id);
    const task = day?.tasks.find((t) => t.id === id) || null;
    setDragOverlayTask(task);
    const initial = event.active.rect.current.initial;
    if (initial?.width && initial?.height) {
      setDragSize({
        width: Math.round(initial.width),
        height: Math.round(initial.height),
      });
      return;
    }
    const el = document.querySelector(`[data-task-id="${id.replace(/"/g, "")}"]`);
    if (el instanceof HTMLElement) {
      const r = el.getBoundingClientRect();
      setDragSize({ width: Math.round(r.width), height: Math.round(r.height) });
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    if (!day || !event.over) {
      clearDragState(true);
      return;
    }
    const taskId = String(event.active.id);
    const overId = String(event.over.id);
    let next: TaskStatus | null = null;
    if (overId.startsWith("col-"))
      next = overId.replace("col-", "") as TaskStatus;
    else {
      const overTask = day.tasks.find((t) => t.id === overId);
      if (overTask) next = overTask.status;
    }
    const task = day.tasks.find((t) => t.id === taskId);
    if (!next || !task || task.status === next) {
      clearDragState(true);
      return;
    }

    const previous = day;
    const optimisticTasks = day.tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: next!, updatedAt: new Date().toISOString() }
        : t,
    );
    // Move the card in the board first so the drop animation lands on the real target.
    setDay({ ...day, tasks: optimisticTasks, stats: taskStats(optimisticTasks) });
    clearDragState(false);

    try {
      const payload = await api.updateTask(day.date, taskId, { status: next });
      setDay(payload);
      if (next === "done") {
        emitSpiderFx("land", { toSelector: ".col-done .column-header" });
      }
    } catch (err) {
      setDay(previous);
      showToast((err as Error).message);
    }
  }

  async function createTask() {
    if (!day) return;
    const title = taskTitle.trim();
    if (!title) return;
    setBusy(true);
    try {
      const detailsHtml = sanitizeDetailsHtml(composerDetailsHtml);
      const subItems = deriveSubItemsFromHtml(detailsHtml);

      const payload = await api.createTask(day.date, {
        title,
        project,
        category,
        status,
        priority,
        detailsHtml,
        subItems,
      });
      const fromEl = addBtnRef.current;
      const createdStatus = status;
      setDay(payload);
      resetComposerFields();
      setComposerOpen(false);
      showToast("Task added");
      if (createdStatus === "done") {
        emitSpiderFx("land", { fromEl, toSelector: ".col-done .column-header" });
      } else {
        emitSpiderFx("thwip", {
          fromEl,
          toSelector: `.col-${createdStatus} .column-scroll-host`,
        });
      }
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!day || !editing) return;
    setBusy(true);
    try {
      const detailsHtml = sanitizeDetailsHtml(drawerDetailsHtml);
      const subItems = deriveSubItemsFromHtml(detailsHtml, editing.subItems);

      const prevStatus = day.tasks.find((t) => t.id === editing.id)?.status;
      const payload = await api.updateTask(day.date, editing.id, {
        title: editing.title,
        project: editing.project,
        category: editing.category,
        status: editing.status,
        priority: editing.priority || "medium",
        dueDate: null,
        detailsHtml,
        subItems,
      });
      const landed = editing.status === "done" && prevStatus !== "done";
      setDay(payload);
      setEditing(null);
      showToast("Task saved");
      if (landed) {
        emitSpiderFx("land", { toSelector: ".col-done .column-header" });
      }
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openMail(enhance = false) {
    if (!day) return;
    setMailBusy(true);
    setMailOpen(true);
    try {
      // Only seed recipients when opening fresh — Polish must not wipe To/Cc edits
      if (!enhance) {
        const settings = await api.getSettings();
        setTo(settings.emailTo || "");
        setCc(settings.emailCc || "");
        setRecipientHistory(settings.emailRecipientHistory || []);
      }
      const d = await api.emailDraft(day.date, enhance);
      setDraft(d);
      if (enhance) {
        if (d.enhanceMode === 'llm') showToast('Draft polished with Local AI');
        else showToast('Draft polished (basic wording)');
      }
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setMailBusy(false);
    }
  }

  const recipientSuggestions = useMemo(
    () => mergeSuggestionPool(recipientHistory, to, cc),
    [recipientHistory, to, cc],
  );

  function commitRecipient(email: string) {
    const next = upsertEmailHistory(recipientHistory, email);
    setRecipientHistory(next);
    void api.saveSettings({ emailRecipientHistory: next });
  }

  async function createProjectInline() {
    const name = newProjectName.trim();
    if (!name || !day) return;
    setProjectBusy(true);
    try {
      const res = await api.addProject(name);
      const names = res.projects.filter((p) => !p.archived).map((p) => p.name);
      setDay({
        ...day,
        config: {
          ...day.config,
          projects: names,
          projectMeta: res.projects.filter((p) => !p.archived),
        },
      });
      if (newProjectTarget === "composer") setProject(res.added);
      else if (editing) setEditing({ ...editing, project: res.added });
      setNewProjectOpen(false);
      setNewProjectName("");
      showToast(`Project “${res.added}” created`);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setProjectBusy(false);
    }
  }

  if (error && !day) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Couldn’t load your board</h1>
          <p className="page-sub">{error}</p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => void load()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!day) {
    return (
      <div className="page">
        <SpideyLoader label="Loading your day…" />
        {mailOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <>
              <div className="overlay mail-overlay" />
              <aside className="drawer mail-drawer" role="dialog" aria-label="Daily email draft">
                <header className="drawer-header">
                  <strong>Daily Email Draft</strong>
                </header>
                <div className="drawer-body">
                  <Scrollbar orientation="vertical" autoHide className="drawer-body-scroll">
                    <div className="drawer-body-pad">
                      <p className="page-sub">Preparing your draft…</p>
                    </div>
                  </Scrollbar>
                </div>
              </aside>
            </>,
            document.body,
          )}
      </div>
    );
  }

  const meta = day.config.projectMeta;
  const settlingId =
    dragOverlayTask && !activeId ? dragOverlayTask.id : null;

  return (
    <div className="board-shell">
      <div className="filters">
        <div className="filters-left">
          <div className="date-nav">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous day"
              onClick={() => void load(addDays(day.date, -1))}
            >
              <Icon icon={I.chevronLeft} width={18} />
            </button>
            <div className="date-picker-anchor">
              <button
                type="button"
                className="date-pill"
                onClick={() => setDatePickerOpen((o) => !o)}
                aria-expanded={datePickerOpen}
              >
                <Icon icon={I.calendar} width={16} />
                <span>{formatDisplayDate(day.date)}</span>
              </button>
              {datePickerOpen && (
                <DatePicker
                  value={day.date}
                  today={day.today}
                  onChange={(iso) => {
                    void load(iso);
                    setDatePickerOpen(false);
                  }}
                  onClose={() => setDatePickerOpen(false)}
                />
              )}
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next day"
              disabled={day.date === day.today}
              onClick={() => void load(addDays(day.date, 1))}
              style={{
                opacity: day.date === day.today ? 0.25 : 1,
                cursor: day.date === day.today ? "not-allowed" : "pointer",
              }}
            >
              <Icon icon={I.chevronRight} width={18} />
            </button>
            {day.date !== day.today && (
              <button
                type="button"
                className="btn btn-today"
                onClick={() => void load(day.today)}
              >
                <Icon icon={I.today} width={14} />
                Today
              </button>
            )}
          </div>
          <span className="stat-pill">
            <strong>{plural(day.stats.total, 'task')}</strong>
          </span>
          <span className="stat-pill wip">
            <strong>{day.stats.wip}</strong> in progress
          </span>
          <span className="stat-pill done">
            <strong>{day.stats.done}</strong> done
          </span>
        </div>

        <div className="filters-projects">
          <button
            type="button"
            className={`chip filters-projects-pin${projectFilter === "all" ? " active" : ""}`}
            onClick={() => setProjectFilter("all")}
          >
            <span className="chip-label">All projects</span>
          </button>

          <Scrollbar
            orientation="horizontal"
            autoHide
            className="filters-projects-scroll"
            aria-label="Project filters"
          >
            {day.config.projects.map((p) => {
              const color = projectColor(meta, p);
              return (
                <button
                  key={p}
                  type="button"
                  className={`chip${projectFilter === p ? " active" : ""}`}
                  onClick={() => setProjectFilter(p)}
                  title={p}
                >
                  <span className="dot" style={{ background: color }} />
                  <span className="chip-label">{p}</span>
                </button>
              );
            })}
          </Scrollbar>

          <Link href="/projects/" className="chip filters-projects-pin">
            <Icon icon={I.plus} width={12} />
            <span className="chip-label">Manage projects</span>
          </Link>
        </div>

        <div className="filters-actions">
          <button
            type="button"
            className="btn"
            onClick={() => void openMail(false)}
          >
            <Icon icon={I.mail} width={16} /> Email draft
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openComposer()}
          >
            <Icon icon={I.plus} width={16} /> New task
          </button>
        </div>
      </div>

      <div className="main">
        <BoardWebDecor />
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={(e) => void onDragEnd(e)}
          onDragCancel={() => clearDragState(true)}
        >
          <div className="board">
            <Column
              status="none"
              tasks={byStatus.none}
              projectMeta={meta}
              onOpen={setEditing}
              activeId={activeId}
              settlingId={settlingId}
              dragSize={dragSize}
            />
            <Column
              status="wip"
              tasks={byStatus.wip}
              projectMeta={meta}
              onOpen={setEditing}
              activeId={activeId}
              settlingId={settlingId}
              dragSize={dragSize}
            />
            <Column
              status="done"
              tasks={byStatus.done}
              projectMeta={meta}
              onOpen={setEditing}
              activeId={activeId}
              settlingId={settlingId}
              dragSize={dragSize}
            />
          </div>
          <DragOverlay
            dropAnimation={{
              duration: DRAG_DROP_MS,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {dragOverlayTask ? (
              <div
                className="card-drag-overlay-wrap"
                style={
                  dragSize
                    ? { width: dragSize.width, height: dragSize.height }
                    : undefined
                }
              >
                <TaskCard
                  task={dragOverlayTask}
                  projectMeta={meta}
                  onOpen={() => undefined}
                  overlay
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {composerOpen && (
        <>
          <div className="overlay" onClick={() => setComposerOpen(false)} />
          <div className="composer composer-task" role="dialog" aria-label="New task">
            <header className="composer-header">
              <strong>New task</strong>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close"
                onClick={() => setComposerOpen(false)}
              >
                <Icon icon={I.close} width={16} />
              </button>
            </header>
            <div className="composer-body">
              <Scrollbar orientation="vertical" autoHide className="composer-body-scroll">
                <div className="composer-body-pad">
              <div className="composer-fields">
                <Select
                  label="Project"
                  icon={I.folder}
                  value={project}
                  onChange={setProject}
                  options={day.config.projects.map((p) => ({
                    value: p,
                    label: p,
                  }))}
                  allowAdd
                  addLabel="New project…"
                  onRequestAdd={() => {
                    setNewProjectTarget("composer");
                    setNewProjectName("");
                    setNewProjectOpen(true);
                  }}
                />
                <Select
                  label="Category"
                  icon={I.tag}
                  value={category}
                  onChange={setCategory}
                  options={day.config.categories.map((c) => ({
                    value: c,
                    label: c,
                  }))}
                />
                <Select
                  label="Status"
                  icon={I.layers}
                  value={status}
                  onChange={(v) => setStatus(v as TaskStatus)}
                  options={[
                    { value: "wip", label: "In progress" },
                    { value: "none", label: "Backlog" },
                    { value: "done", label: "Done" },
                  ]}
                />
                <Select
                  label="Priority"
                  icon={I.flag}
                  value={priority}
                  onChange={(v) => setPriority(v as TaskPriority)}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Normal" },
                    { value: "high", label: "High" },
                  ]}
                />
              </div>
              <div className="field" style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Task Title
                </label>
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="What are you working on?"
                  autoFocus
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "0.6rem 0.8rem",
                    fontSize: "0.9rem",
                    color: "var(--text)",
                    width: "100%",
                    marginTop: "0.3rem",
                  }}
                />
              </div>
              <div className="field">
                <label
                  style={{
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Details
                </label>
                <TaskDetailsEditor
                  value={composerDetailsHtml}
                  onChange={setComposerDetailsHtml}
                  placeholder="Bullets, nested points, links…"
                  height={180}
                />
              </div>
                </div>
              </Scrollbar>
            </div>
            <footer className="composer-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setComposerOpen(false)}
              >
                Cancel
              </button>
              <button
                ref={addBtnRef}
                type="button"
                className="btn btn-primary"
                disabled={busy || !taskTitle.trim()}
                onClick={() => void createTask()}
              >
                {busy ? "Adding…" : "Add task"}
              </button>
            </footer>
          </div>
        </>
      )}

      {editing &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="overlay drawer-overlay" onClick={() => setEditing(null)} />
            <aside className="drawer drawer-wide drawer-task" role="dialog" aria-label="Edit task">
            <header className="drawer-header">
              <strong>Edit task</strong>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close"
                onClick={() => setEditing(null)}
              >
                <Icon icon={I.close} width={16} />
              </button>
            </header>
            <div className="drawer-body">
              <Scrollbar orientation="vertical" autoHide className="drawer-body-scroll">
                <div className="drawer-body-pad">
              <div className="field">
                <label>Title</label>
                <input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <Select
                  label="Project"
                  icon={I.folder}
                  value={editing.project}
                  onChange={(v) => setEditing({ ...editing, project: v })}
                  options={day.config.projects.map((p) => ({
                    value: p,
                    label: p,
                  }))}
                  allowAdd
                  addLabel="New project…"
                  onRequestAdd={() => {
                    setNewProjectTarget("edit");
                    setNewProjectName("");
                    setNewProjectOpen(true);
                  }}
                />
              </div>
              <div className="field">
                <Select
                  label="Category"
                  icon={I.tag}
                  value={editing.category}
                  onChange={(v) => setEditing({ ...editing, category: v })}
                  options={day.config.categories.map((c) => ({
                    value: c,
                    label: c,
                  }))}
                />
              </div>
              <div className="composer-fields">
                <Select
                  label="Status"
                  icon={I.layers}
                  value={editing.status}
                  onChange={(v) =>
                    setEditing({ ...editing, status: v as TaskStatus })
                  }
                  options={[
                    { value: "none", label: "Backlog" },
                    { value: "wip", label: "In progress" },
                    { value: "done", label: "Done" },
                  ]}
                />
                <Select
                  label="Priority"
                  icon={I.flag}
                  value={editing.priority || "medium"}
                  onChange={(v) =>
                    setEditing({ ...editing, priority: v as TaskPriority })
                  }
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Normal" },
                    { value: "high", label: "High" },
                  ]}
                />
              </div>
              <div className="field">
                <label
                  style={{
                    fontWeight: 650,
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Details
                </label>
                <TaskDetailsEditor
                  value={drawerDetailsHtml}
                  onChange={setDrawerDetailsHtml}
                  placeholder="Bullets, nested points, links…"
                  height={180}
                />
              </div>
              <p className="field-hint">
                Priority: {priorityLabel(editing.priority || "medium")}
              </p>
                </div>
              </Scrollbar>
            </div>
            <footer className="drawer-footer">
              <button
                type="button"
                className="btn btn-danger"
                style={{ marginRight: "auto" }}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete task',
                    message: 'Delete this task? This can’t be undone.',
                    confirmLabel: 'Delete',
                    variant: 'danger',
                  });
                  if (!ok) return;
                  const payload = await api.deleteTask(day.date, editing.id);
                  setDay(payload);
                  setEditing(null);
                  showToast("Task deleted");
                }}
              >
                <Icon icon={I.trash} width={16} /> Delete
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void saveEdit()}
              >
                <Icon icon={I.save} width={16} /> Save
              </button>
            </footer>
          </aside>
          </>,
          document.body,
        )}

      {mailOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="overlay mail-overlay" onClick={() => setMailOpen(false)} />
            <aside
              className="drawer drawer-wide mail-drawer"
              role="dialog"
              aria-label="Daily email draft"
            >
              <header className="drawer-header">
                <strong>Daily Email Draft</strong>
                <div className="drawer-header-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={!draft || mailBusy}
                    onClick={async () => {
                      if (!draft) return;
                      await api.emailCopy(draft);
                      showToast("Copied to clipboard");
                    }}
                  >
                    <Icon icon={I.copy} width={16} /> Copy
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Close"
                    onClick={() => setMailOpen(false)}
                  >
                    <Icon icon={I.close} width={16} />
                  </button>
                </div>
              </header>
              <div className="drawer-body mail-drawer-body">
                <Scrollbar orientation="vertical" autoHide className="drawer-body-scroll">
                  <div className="drawer-body-pad">
                {mailBusy && !draft ? (
                  <p className="page-sub">Preparing your draft…</p>
                ) : null}
                {!mailBusy && !draft ? (
                  <p className="page-sub">Couldn’t prepare the draft. Close and try Email draft again.</p>
                ) : null}
                {draft && (
                  <div className="mail-compose">
                    <div className="mail-compose-row">
                      <label htmlFor="mail-to">To</label>
                      <EmailChipInput
                        id="mail-to"
                        value={to}
                        suggestions={recipientSuggestions}
                        placeholder="manager@company.com"
                        onChange={setTo}
                        onCommitEmail={commitRecipient}
                      />
                    </div>
                    <div className="mail-compose-row">
                      <label htmlFor="mail-cc">Cc</label>
                      <EmailChipInput
                        id="mail-cc"
                        value={cc}
                        suggestions={recipientSuggestions}
                        placeholder="optional@company.com"
                        onChange={setCc}
                        onCommitEmail={commitRecipient}
                      />
                    </div>
                    <div className="mail-compose-row">
                      <label htmlFor="mail-subject">Subject</label>
                      <Input id="mail-subject" type="text" value={draft.subject} readOnly />
                    </div>
                    <div className="mail-compose-preview-label">Preview</div>
                    <div
                      className="mail-md-preview"
                      dangerouslySetInnerHTML={{
                        __html: renderEmailMarkdownPreview(draft.body),
                      }}
                    />
                  </div>
                )}
                  </div>
                </Scrollbar>
              </div>
              <footer className="drawer-footer mail-drawer-footer">
                <button
                  type="button"
                  className="btn"
                  disabled={mailBusy}
                  onClick={() => void openMail(true)}
                >
                  <Icon icon={I.sparkles} width={16} /> Polish wording
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!draft || mailBusy}
                  onClick={async () => {
                    if (!draft || !day) return;
                    const gmailUrl = buildGmailComposeUrl(draft.gmailUrl, {
                      to,
                      cc,
                      subject: draft.subject,
                    });
                    const res = await api.emailOpen({ ...draft, gmailUrl });
                    await api.markEmailSent(day.date);
                    if (res.pasted) {
                      showToast("Opened Gmail - marked as sent");
                    } else {
                      showToast(res.pasteHint || "Opened Gmail - marked as sent");
                    }
                  }}
                >
                  <Icon icon={I.external} width={16} /> Open Gmail
                </button>
              </footer>
            </aside>
          </>,
          document.body,
        )}

      {newProjectOpen && (
        <>
          <div
            className="overlay"
            style={{ zIndex: 50 }}
            onClick={() => setNewProjectOpen(false)}
          />
          <div
            className="composer"
            style={{
              zIndex: 51,
              top: "22%",
              width: "min(400px, calc(100vw - 2rem))",
            }}
            role="dialog"
            aria-label="New project"
          >
            <header className="composer-header">
              <strong>New project</strong>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close"
                onClick={() => setNewProjectOpen(false)}
              >
                <Icon icon={I.close} width={16} />
              </button>
            </header>
            <div className="composer-body">
              <div className="field">
                <label>Project name</label>
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Website redesign"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createProjectInline();
                  }}
                />
              </div>
            </div>
            <footer className="composer-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setNewProjectOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={projectBusy || !newProjectName.trim()}
                onClick={() => void createProjectInline()}
              >
                {projectBusy ? "Creating…" : "Create & select"}
              </button>
            </footer>
          </div>
        </>
      )}

      {toast && (
        <div className="toast" role="status">
          <Icon icon={I.toastCheck} width={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
