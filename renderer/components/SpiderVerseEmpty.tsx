'use client';

import React from 'react';

type Status = 'none' | 'wip' | 'done';

export default function SpiderVerseEmpty({ status }: { status: Status }) {
  let content;
  let text = '';

  if (status === 'none') {
    text = 'THWIP IT HERE';
    content = (
      <svg width="60" height="60" viewBox="0 0 60 60" className="sv-web-anim">
        {/* Web strand from top */}
        <line x1="30" y1="0" x2="30" y2="40" stroke="#df2a2f" strokeWidth="2" />
        {/* Buildings */}
        <rect x="10" y="30" width="15" height="30" fill="var(--bg-raised)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="35" y="20" width="15" height="40" fill="var(--bg-raised)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="13" y="35" width="4" height="4" fill="var(--accent-glow)" />
        <rect x="40" y="25" width="4" height="4" fill="var(--accent-glow)" />
      </svg>
    );
  } else if (status === 'wip') {
    text = 'SPINNING...';
    content = (
      <svg width="60" height="60" viewBox="0 0 60 60">
        {/* Spider sense lines */}
        <line x1="30" y1="30" x2="10" y2="10" stroke="#d4a017" strokeWidth="2" />
        <line x1="30" y1="30" x2="30" y2="5" stroke="#d4a017" strokeWidth="2" />
        <line x1="30" y1="30" x2="50" y2="10" stroke="#d4a017" strokeWidth="2" />
        <rect x="25" y="25" width="10" height="10" fill="#df2a2f" />
        <rect x="20" y="15" width="4" height="4" fill="#d4a017" />
        <rect x="36" y="15" width="4" height="4" fill="#d4a017" />
      </svg>
    );
  } else {
    text = 'DONE!';
    content = (
      <svg width="60" height="60" viewBox="0 0 60 60">
        <line x1="0" y1="0" x2="60" y2="60" stroke="#1a7fc4" strokeWidth="2" />
        <line x1="60" y1="0" x2="0" y2="60" stroke="#1a7fc4" strokeWidth="2" />
        <line x1="30" y1="0" x2="30" y2="60" stroke="#1a7fc4" strokeWidth="2" />
        <line x1="0" y1="30" x2="60" y2="30" stroke="#1a7fc4" strokeWidth="2" />
        <rect x="20" y="20" width="20" height="20" fill="none" stroke="#1a7fc4" strokeWidth="2" />
        <rect x="10" y="10" width="40" height="40" fill="none" stroke="#1a7fc4" strokeWidth="2" />
        {/* Checkmark style center */}
        <rect x="25" y="25" width="10" height="10" fill="#df2a2f" />
      </svg>
    );
  }

  return (
    <div className="spider-verse-empty">
      {content}
      <p className="spider-verse-empty-text">{text}</p>
    </div>
  );
}
