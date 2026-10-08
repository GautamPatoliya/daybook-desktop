'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/button';
import { useDialog } from './DialogProvider';
import { Icon, I } from '../lib/icons';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Fixed editor body height in px (toolbar excluded). Ignored while expanded. */
  height?: number;
};

function ToolBtn({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? 'primary' : 'ghost'}
      className={`tiptap-btn${active ? ' active' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function Sep() {
  return <span className="tiptap-sep" aria-hidden />;
}

/** Gmail-style details editor - bold/italic/underline, color, link, lists, indent, quote. */
export function TaskDetailsEditor({
  value,
  onChange,
  placeholder = 'Write details…',
  height = 180,
}: Props) {
  const { prompt } = useDialog();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Underline,
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        validate: (href) => /^https?:\/\//i.test(href),
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || '';
    if (sanitizeCompare(current) !== sanitizeCompare(next)) {
      editor.commands.setContent(next || '', { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setExpanded(false);
    };
    document.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded || !editor) return;
    const t = window.setTimeout(() => editor.commands.focus('end'), 50);
    return () => window.clearTimeout(t);
  }, [expanded, editor]);

  async function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = await prompt({
      title: 'Link URL',
      message: 'Paste a web address. Leave empty to remove the link.',
      defaultValue: prev || 'https://',
      placeholder: 'https://…',
      confirmLabel: 'Apply',
    });
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  if (!editor) return null;

  const toolbar = (
    <div className="tiptap-toolbar" role="toolbar" aria-label="Formatting">
      <ToolBtn label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Icon icon={I.undo} width={16} />
      </ToolBtn>
      <ToolBtn label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Icon icon={I.redo} width={16} />
      </ToolBtn>
      <Sep />
      <ToolBtn label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Icon icon={I.bold} width={16} />
      </ToolBtn>
      <ToolBtn label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Icon icon={I.italic} width={16} />
      </ToolBtn>
      <ToolBtn
        label="Underline"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Icon icon={I.underline} width={16} />
      </ToolBtn>
      <label className="tiptap-color" title="Text color">
        <span aria-hidden>A</span>
        <input
          type="color"
          value={editor.getAttributes('textStyle').color || '#e8ecf4'}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>
      <Sep />
      <ToolBtn label="Link" active={editor.isActive('link')} onClick={() => void setLink()}>
        <Icon icon={I.link} width={16} />
      </ToolBtn>
      <ToolBtn
        label="Bulleted list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <Icon icon={I.bulletList} width={16} />
      </ToolBtn>
      <ToolBtn
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <Icon icon={I.numberedList} width={16} />
      </ToolBtn>
      <ToolBtn label="Decrease indent" onClick={() => editor.chain().focus().liftListItem('listItem').run()}>
        <Icon icon={I.indentLess} width={16} />
      </ToolBtn>
      <ToolBtn label="Increase indent" onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>
        <Icon icon={I.indentMore} width={16} />
      </ToolBtn>
      <Sep />
      <ToolBtn
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Icon icon={I.quote} width={16} />
      </ToolBtn>
      <ToolBtn label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <Icon icon={I.clearFormat} width={16} />
      </ToolBtn>
      <button
        type="button"
        className="tiptap-expand-btn"
        aria-label={expanded ? 'Exit full editor' : 'Expand editor'}
        title={expanded ? 'Exit full editor' : 'Expand editor'}
        onClick={() => setExpanded((v) => !v)}
      >
        <Icon icon={expanded ? I.collapse : I.expand} width={16} />
      </button>
    </div>
  );

  const dialog =
    expanded && mounted
      ? createPortal(
          <div className="tiptap-dialog-root">
            <div
              className="tiptap-expand-overlay"
              onClick={() => setExpanded(false)}
              aria-hidden
            />
            <div
              className="tiptap-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Details editor"
            >
              <header className="tiptap-expand-head">
                <div>
                  <p className="tiptap-expand-kicker">Details</p>
                  <strong>Write freely</strong>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Close editor"
                  onClick={() => setExpanded(false)}
                >
                  <Icon icon={I.close} width={16} />
                </button>
              </header>
              {toolbar}
              <div className="tiptap-dialog-body">
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {!expanded ? (
        <div
          className="tiptap-shell tiptap-shell-fixed"
          style={{ ['--tiptap-body-h' as string]: `${height}px` }}
        >
          {toolbar}
          <EditorContent editor={editor} />
        </div>
      ) : (
        <button
          type="button"
          className="tiptap-shell tiptap-shell-parked"
          onClick={() => setExpanded(true)}
        >
          <Icon icon={I.expand} width={16} />
          <span>Editing in expanded view — click to reopen</span>
        </button>
      )}
      {dialog}
    </>
  );
}

function sanitizeCompare(html: string): string {
  const t = (html || '').trim();
  if (!t || t === '<p></p>' || t === '<p><br></p>') return '';
  return t;
}
