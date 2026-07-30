"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
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
} from "@dnd-kit/core";
import Link from "next/link";
import { api } from "../lib/api";
import {
  addDays,
  formatDisplayDate,
  formatShortDate,
  formatTime12h,
} from "../lib/format";
import { I } from "../lib/icons";
import { Select } from "../components/Select";
import { DatePicker } from "../components/DatePicker";
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

function TaskCard({
  task,
  projectMeta,
  onOpen,
  overlay,
}: {
  task: Task;
  projectMeta?: ProjectMeta[];
  onOpen: (task: Task) => void;
  overlay?: boolean;
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

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      className={`card status-${task.status}${isDragging && !overlay ? " dragging" : ""}${overlay ? " overlay" : ""}`}
      style={{ "--card-accent": meta.accent } as CSSProperties}
    >
      <div className="card-top">
        {!overlay && (
          <button
            type="button"
            className="card-grip"
            aria-label="Drag task"
            {...listeners}
            {...attributes}
          >
            <Icon icon={I.grip} width={16} />
          </button>
        )}
        <button
          type="button"
          className="card-body-btn"
          onClick={() => onOpen(task)}
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
        {task.carriedFrom ? (
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
}: {
  status: TaskStatus;
  tasks: Task[];
  projectMeta?: ProjectMeta[];
  onOpen: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  const meta = STATUS_META[status];

  return (
    <section className={`column col-${status}`}>
      <header className="column-header">
        <div className="column-title">
          <span className="column-icon" style={{ color: meta.accent }}>
            <Icon icon={meta.icon} width={18} />
          </span>
          <span>{meta.label}</span>
        </div>
        <span className="column-count">{tasks.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={`column-body${isOver ? " drag-over" : ""}`}
      >
        {tasks.length === 0 ? (
          <div className="empty">
            <Icon icon={I.empty} width={28} className="empty-icon" />
            <p>Drop tasks here</p>
          </div>
        ) : (
          tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              projectMeta={projectMeta}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function BoardPage() {
  const [day, setDay] = useState<DayPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | "all">("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [mailOpen, setMailOpen] = useState(false);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [to, setTo] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [composerSubItems, setComposerSubItems] = useState<string[]>([""]);
  const [drawerSubItems, setDrawerSubItems] = useState<string[]>([]);
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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
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
      setProject((prev) => prev || payload.config.defaultProject);
      setCategory((prev) => prev || payload.config.categories[0] || "Other");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    const off = window.wtt?.on("reminder:open", (payload) => {
      const mode = (payload as { mode?: string })?.mode;
      if (mode === "eod") setMailOpen(true);
      void load();
    });
    return () => off?.();
  }, [load]);

  useEffect(() => {
    if (editing) {
      setDrawerSubItems(editing.subItems.map((s) => s.text));
    } else {
      setDrawerSubItems([]);
    }
  }, [editing?.id]);

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

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!day || !event.over) return;
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
    if (!next || !task || task.status === next) return;
    try {
      const payload = await api.updateTask(day.date, taskId, { status: next });
      setDay(payload);
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  function parse(raw: string) {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => /\S/.test(l));
    let title = "";
    const subItems: string[] = [];
    for (const line of lines) {
      const m = line.match(/^\s*[-*•]\s+(.+)$/);
      if (m) subItems.push(m[1].trim());
      else if (!title) title = line.trim();
      else subItems.push(line.trim());
    }
    return { title, subItems };
  }

  async function createTask() {
    if (!day) return;
    const title = taskTitle.trim();
    if (!title) return;
    setBusy(true);
    try {
      const subItems = composerSubItems.map((s) => s.trim()).filter(Boolean);

      const payload = await api.createTask(day.date, {
        title,
        project,
        category,
        status,
        priority,
        subItems,
      });
      setDay(payload);
      setTaskTitle("");
      setComposerSubItems([""]);
      setComposerOpen(false);
      showToast("Task added");
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
      const parsedSubItems = drawerSubItems
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text) => ({ text }));

      const payload = await api.updateTask(day.date, editing.id, {
        title: editing.title,
        project: editing.project,
        category: editing.category,
        status: editing.status,
        priority: editing.priority || "medium",
        dueDate: null,
        subItems: parsedSubItems,
      });
      setDay(payload);
      setEditing(null);
      showToast("Task saved");
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
      const d = await api.emailDraft(day.date, enhance);
      setDraft(d);
      if (enhance) showToast("Draft polished");
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setMailBusy(false);
    }
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
        <p className="page-sub">Loading your day…</p>
      </div>
    );
  }

  const activeTask = day.tasks.find((t) => t.id === activeId) || null;
  const meta = day.config.projectMeta;

  return (
    <>
      <div className="filters">
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
        </span>{" "}
        <span className="stat-pill wip">
          <strong>{day.stats.wip}</strong> in progress
        </span>
        <span className="stat-pill done">
          <strong>{day.stats.done}</strong> done
        </span>
        <button
          type="button"
          className={`chip${projectFilter === "all" ? " active" : ""}`}
          onClick={() => setProjectFilter("all")}
        >
          All projects
        </button>
        {day.config.projects.map((p) => {
          const color = projectColor(meta, p);
          return (
            <button
              key={p}
              type="button"
              className={`chip${projectFilter === p ? " active" : ""}`}
              onClick={() => setProjectFilter(p)}
            >
              <span className="dot" style={{ background: color }} />
              {p}
            </button>
          );
        })}
        <Link href="/projects/" className="chip">
          <Icon icon={I.plus} width={12} /> Manage projects
        </Link>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
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
            onClick={() => setComposerOpen(true)}
          >
            <Icon icon={I.plus} width={16} /> New task
          </button>
        </div>
      </div>

      <div className="main">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={(e) => void onDragEnd(e)}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="board">
            <Column
              status="none"
              tasks={byStatus.none}
              projectMeta={meta}
              onOpen={setEditing}
            />
            <Column
              status="wip"
              tasks={byStatus.wip}
              projectMeta={meta}
              onOpen={setEditing}
            />
            <Column
              status="done"
              tasks={byStatus.done}
              projectMeta={meta}
              onOpen={setEditing}
            />
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <div style={{ width: 320 }}>
                <TaskCard
                  task={activeTask}
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
          <div className="composer" role="dialog" aria-label="New task">
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
                  Details / Bullet Points
                </label>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    marginTop: "0.4rem",
                    maxHeight: "200px",
                    overflowY: "auto",
                    paddingRight: "4px",
                  }}
                >
                  {composerSubItems.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--accent)",
                          fontWeight: "bold",
                          fontSize: "1.1rem",
                        }}
                      >
                        •
                      </span>
                      <input
                        id={`composer-bullet-${index}`}
                        value={item}
                        placeholder="Add details of this task..."
                        onChange={(e) => {
                          const copy = [...composerSubItems];
                          copy[index] = e.target.value;
                          setComposerSubItems(copy);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const copy = [...composerSubItems];
                            copy.splice(index + 1, 0, "");
                            setComposerSubItems(copy);
                            setTimeout(() => {
                              const nextInput = document.getElementById(
                                `composer-bullet-${index + 1}`,
                              );
                              nextInput?.focus();
                            }, 10);
                          } else if (e.key === "Backspace" && !item) {
                            e.preventDefault();
                            if (composerSubItems.length > 1) {
                              const copy = [...composerSubItems];
                              copy.splice(index, 1);
                              setComposerSubItems(copy);
                              setTimeout(() => {
                                const prevInput = document.getElementById(
                                  `composer-bullet-${index - 1 >= 0 ? index - 1 : 0}`,
                                );
                                prevInput?.focus();
                              }, 10);
                            }
                          }
                        }}
                        style={{
                          flexGrow: 1,
                          background: "var(--bg-input)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "0.88rem",
                          color: "var(--text)",
                        }}
                      />
                      {composerSubItems.length > 1 && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Remove bullet"
                          onClick={() => {
                            const copy = [...composerSubItems];
                            copy.splice(index, 1);
                            setComposerSubItems(copy);
                          }}
                          style={{
                            color: "var(--status-high)",
                            padding: "4px",
                          }}
                        >
                          <Icon icon={I.close} width={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setComposerSubItems([...composerSubItems, ""])}
                  style={{
                    alignSelf: "flex-start",
                    fontSize: "0.8rem",
                    padding: "4px 10px",
                    marginTop: "0.6rem",
                    borderRadius: "6px",
                    border: "1px dashed var(--border)",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <Icon icon={I.plus} width={12} /> Add line (Enter)
                </button>
              </div>
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

      {editing && (
        <>
          <div className="overlay" onClick={() => setEditing(null)} />
          <aside className="drawer" role="dialog" aria-label="Edit task">
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
                  Details / Bullet Points
                </label>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    marginTop: "0.4rem",
                    maxHeight: "300px",
                    overflowY: "auto",
                    paddingRight: "4px",
                  }}
                >
                  {drawerSubItems.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--accent)",
                          fontWeight: "bold",
                          fontSize: "1.1rem",
                        }}
                      >
                        •
                      </span>
                      <input
                        id={`drawer-bullet-${index}`}
                        value={item}
                        placeholder="Add details of this task..."
                        onChange={(e) => {
                          const copy = [...drawerSubItems];
                          copy[index] = e.target.value;
                          setDrawerSubItems(copy);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const copy = [...drawerSubItems];
                            copy.splice(index + 1, 0, "");
                            setDrawerSubItems(copy);
                            setTimeout(() => {
                              const nextInput = document.getElementById(
                                `drawer-bullet-${index + 1}`,
                              );
                              nextInput?.focus();
                            }, 10);
                          } else if (e.key === "Backspace" && !item) {
                            e.preventDefault();
                            if (drawerSubItems.length > 1) {
                              const copy = [...drawerSubItems];
                              copy.splice(index, 1);
                              setDrawerSubItems(copy);
                              setTimeout(() => {
                                const prevInput = document.getElementById(
                                  `drawer-bullet-${index - 1 >= 0 ? index - 1 : 0}`,
                                );
                                prevInput?.focus();
                              }, 10);
                            }
                          }
                        }}
                        style={{
                          flexGrow: 1,
                          background: "var(--bg-input)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "0.88rem",
                          color: "var(--text)",
                        }}
                      />
                      {drawerSubItems.length > 1 && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Remove bullet"
                          onClick={() => {
                            const copy = [...drawerSubItems];
                            copy.splice(index, 1);
                            setDrawerSubItems(copy);
                          }}
                          style={{
                            color: "var(--status-high)",
                            padding: "4px",
                          }}
                        >
                          <Icon icon={I.close} width={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setDrawerSubItems([...drawerSubItems, ""])}
                  style={{
                    alignSelf: "flex-start",
                    fontSize: "0.8rem",
                    padding: "4px 10px",
                    marginTop: "0.6rem",
                    borderRadius: "6px",
                    border: "1px dashed var(--border)",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <Icon icon={I.plus} width={12} /> Add line (Enter)
                </button>
              </div>
              <p className="field-hint">
                Priority: {priorityLabel(editing.priority || "medium")}
              </p>
            </div>
            <footer className="drawer-footer">
              <button
                type="button"
                className="btn btn-danger"
                style={{ marginRight: "auto" }}
                onClick={async () => {
                  if (!confirm("Delete this task? This can’t be undone."))
                    return;
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
        </>
      )}

      {mailOpen && (
        <>
          <div className="overlay" onClick={() => setMailOpen(false)} />
          <aside
            className="drawer"
            role="dialog"
            aria-label="Daily email draft"
          >
            <header className="drawer-header">
              <strong>Daily email draft</strong>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close"
                onClick={() => setMailOpen(false)}
              >
                <Icon icon={I.close} width={16} />
              </button>
            </header>
            <div className="drawer-body">
              {mailBusy && !draft ? (
                <p className="page-sub">Preparing your draft…</p>
              ) : null}
              {draft && (
                <>
                  <div className="field">
                    <label>To</label>
                    <textarea
                      rows={2}
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="manager@company.com"
                    />
                  </div>
                  <div className="field">
                    <label>Subject</label>
                    <input value={draft.subject} readOnly />
                  </div>
                  <pre className="mail-body">{draft.body}</pre>
                </>
              )}
            </div>
            <footer className="drawer-footer">
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
                className="btn btn-primary"
                disabled={!draft || mailBusy}
                onClick={async () => {
                  if (!draft) return;
                  const url = new URL(draft.gmailUrl);
                  if (to.trim()) url.searchParams.set("to", to.trim());
                  await api.emailOpen({ ...draft, gmailUrl: url.toString() });
                  showToast("Copied and opened Gmail");
                }}
              >
                <Icon icon={I.external} width={16} /> Open Gmail
              </button>
            </footer>
          </aside>
        </>
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
    </>
  );
}
