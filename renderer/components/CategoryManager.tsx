'use client';

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon, I } from '../lib/icons';
import { Select } from './Select';
import { useDialog } from './DialogProvider';
import { api } from '../lib/api';

type Props = {
  categories: string[];
  defaultCategory: string;
  onChange: (next: { categories: string[]; defaultCategory: string }) => void;
  showToast: (msg: string) => void;
  /** When false, default category is rendered by the parent (e.g. paired with Default Project). */
  showDefaultSelect?: boolean;
};

function SortableCategory({
  name,
  busy,
  editing,
  editName,
  canDelete,
  onEdit,
  onEditName,
  onRename,
  onCancelEdit,
  onDelete,
}: {
  name: string;
  busy: boolean;
  editing: boolean;
  editName: string;
  canDelete: boolean;
  onEdit: () => void;
  onEditName: (v: string) => void;
  onRename: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: name,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="category-row">
      <button
        type="button"
        className="icon-btn category-drag"
        aria-label={`Drag ${name}`}
        disabled={busy}
        {...attributes}
        {...listeners}
      >
        <Icon icon={I.grip} width={16} />
      </button>
      {editing ? (
        <input
          className="category-edit-input"
          value={editName}
          maxLength={60}
          autoFocus
          onChange={(e) => onEditName(e.target.value)}
          onBlur={() => onRename()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRename();
            if (e.key === 'Escape') onCancelEdit();
          }}
        />
      ) : (
        <button type="button" className="category-name-btn" onClick={onEdit}>
          <Icon icon={I.tag} width={14} />
          {name}
        </button>
      )}
      <button
        type="button"
        className="icon-btn"
        aria-label={`Delete ${name}`}
        disabled={busy || !canDelete}
        onClick={onDelete}
      >
        <Icon icon={I.trash} width={14} />
      </button>
    </li>
  );
}

export function CategoryManager({
  categories,
  defaultCategory,
  onChange,
  showToast,
  showDefaultSelect = true,
}: Props) {
  const { confirm } = useDialog();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function addCategory() {
    const name = draft.trim();
    if (!name) return;
    if (name.length > 60) {
      showToast('Category names max 60 characters');
      return;
    }
    setBusy(true);
    try {
      const res = await api.categoriesAdd(name);
      onChange(res);
      setDraft('');
      showToast('Category added');
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function renameCategory(from: string) {
    const name = editName.trim();
    if (!name || name === from) {
      setEditing(null);
      return;
    }
    setBusy(true);
    try {
      const res = await api.categoriesRename(from, name);
      onChange(res);
      setEditing(null);
      showToast('Category renamed');
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.indexOf(String(active.id));
    const newIndex = categories.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const order = arrayMove(categories, oldIndex, newIndex);
    setBusy(true);
    try {
      const res = await api.categoriesReorder(order);
      onChange(res);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(name: string) {
    setBusy(true);
    try {
      const res = await api.setDefaultCategory(name);
      onChange(res);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function requestDeleteCategory(name: string) {
    const ok = await confirm({
      title: 'Delete category',
      message: `Delete “${name}”? Tasks using this category will be moved to “Other”.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api.categoriesDelete(name);
      onChange(res);
      showToast('Category deleted - tasks moved to Other');
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="category-manager">
      {showDefaultSelect ? (
        <div className="field category-default-field">
          <Select
            label="Default category"
            icon={I.tag}
            value={defaultCategory}
            onChange={(v) => void setDefault(v)}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
        </div>
      ) : null}

      <label className="settings-label">Task Categories</label>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
        <SortableContext items={categories} strategy={verticalListSortingStrategy}>
          <ul className="category-list">
            {categories.map((name) => (
              <SortableCategory
                key={name}
                name={name}
                busy={busy}
                editing={editing === name}
                editName={editName}
                canDelete={categories.length > 1}
                onEdit={() => {
                  setEditing(name);
                  setEditName(name);
                }}
                onEditName={setEditName}
                onRename={() => void renameCategory(name)}
                onCancelEdit={() => setEditing(null)}
                onDelete={() => void requestDeleteCategory(name)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="category-add-row">
        <input
          value={draft}
          maxLength={60}
          placeholder="New category name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addCategory();
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !draft.trim()}
          onClick={() => void addCategory()}
        >
          Add category
        </button>
      </div>
    </div>
  );
}
