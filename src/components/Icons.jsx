const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const FlowMark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" {...base} stroke="var(--fg)" strokeWidth="1.6">
    <path d="M3 5h12M3 9h12M3 13h12" />
  </svg>
);

export const BackIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
);

export const PlusIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
);

export const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" {...base} strokeWidth="2.2"><path d="M6 6l12 12M18 6 6 18" /></svg>
);

export const NewWindowIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M7 17 17 7M8 7h9v9" /></svg>
);

export const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...base} strokeWidth="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
);

export const GearIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.8">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const MoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
  </svg>
);

export const SunIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.8">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);

export const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth="1.8">
    <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" />
  </svg>
);

export const JarvisRing =({ on = true, size = 20 }) => {
  const c = on ? 'var(--jarvis)' : 'var(--line-strong)';
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="9" stroke="var(--line-strong)" strokeWidth="1" />
      <circle cx="11" cy="11" r="9" stroke={c} strokeWidth="1.5" strokeDasharray="14 42.5" strokeLinecap="round" />
      <circle cx="11" cy="11" r="3" fill={c} />
    </svg>
  );
};

export const MarksIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M4 6h10M4 12h16M4 18h7" /></svg>
);

export const UnderlineIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" /></svg>
);

export const CommentIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M5 5h14v10H10l-4 4v-4H5z" /></svg>
);

export const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);

export const ExpandIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
);

export const FocusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg>
);

export const BulletsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" /></svg>
);

export const NumbersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 5l1.5-1v5M3.5 13.5a1.5 1.5 0 1 1 2.4 1.2L3.5 17h3" strokeWidth="1.5" /></svg>
);

export const ChecklistIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth="2"><rect x="3" y="4" width="6" height="6" rx="1.5" /><path d="M4.5 7l1.2 1.2L8 5.8" strokeWidth="1.5" /><rect x="3" y="14" width="6" height="6" rx="1.5" /><path d="M13 7h8M13 17h8" /></svg>
);

export const QuoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M5 4v16M10 7h10M10 12h10M10 17h6" /></svg>
);

export const DividerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M3 12h18M7 6h10M7 18h10" strokeOpacity="0.45" /><path d="M3 12h18" /></svg>
);

export const ChevronDownIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" {...base} strokeWidth="2.4"><path d="M6 9l6 6 6-6" /></svg>
);

export const TableIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16M15 4v16" /></svg>
);

export const FileIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
);

export const TakeOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M14 4h6v6M20 4l-8 8M18 14v5H5V6h5" /></svg>
);

export const OverviewIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...base} strokeWidth="2"><rect x="3" y="4" width="8" height="7" rx="1.5" /><rect x="13" y="4" width="8" height="7" rx="1.5" /><rect x="3" y="13" width="8" height="7" rx="1.5" /><rect x="13" y="13" width="8" height="7" rx="1.5" /></svg>
);

export const NoteIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.9"><path d="M5 4h10l4 4v12H5z" /><path d="M15 4v4h4M8.5 12h7M8.5 16h5" /></svg>
);
export const UploadIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.9"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v4h14v-4" /></svg>
);
export const GlobeIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.9"><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5z" /></svg>
);
export const PlayBoxIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.9"><rect x="3" y="5.5" width="18" height="13" rx="3.5" /><path d="M10.2 9.5v5l4.3-2.5z" fill="currentColor" /></svg>
);
export const MicIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.9"><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" /></svg>
);
export const CameraIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.9"><rect x="3" y="6.5" width="13" height="11" rx="2.5" /><path d="m16 10.5 5-3v9l-5-3" /></svg>
);
export const SparkleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.9"><path d="M4 7h7M4 12h11M4 17h7M17 4.5l.9 1.8 1.8.9-1.8.9-.9 1.8-.9-1.8-1.8-.9 1.8-.9zM17.5 14v6M14.5 17h6" /></svg>
);
export const SlidersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M5 6h14M5 12h14M5 18h14" /><circle cx="9" cy="6" r="2" fill="var(--raised)" /><circle cx="15" cy="12" r="2" fill="var(--raised)" /><circle cx="8" cy="18" r="2" fill="var(--raised)" /></svg>
);
// A card leaving the page for the lab (put a highlight or a time note on the lab).
export const ToLabIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth="1.9"><rect x="3.5" y="9" width="12" height="11" rx="2" /><path d="M10 5.5V5a1.5 1.5 0 0 1 1.5-1.5H19A1.5 1.5 0 0 1 20.5 5v7.5A1.5 1.5 0 0 1 19 14h-.5M13 11l7-7M15.5 4H20v4.5" /></svg>
);
export const TimeNoteIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth="1.9"><circle cx="11" cy="12" r="7.5" /><path d="M11 8v4l2.5 1.6M19.5 3.5v5M17 6h5" /></svg>
);
export const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth="2.4"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const BookOpenIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.9"><path d="M12 6.5C10.3 5 7.8 4.5 4 4.8v13.4c3.8-.3 6.3.2 8 1.8 1.7-1.6 4.2-2.1 8-1.8V4.8c-3.8-.3-6.3.2-8 1.7zM12 6.5V20" /></svg>
);
export const ScrollIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.9"><path d="M7 4h10a2 2 0 0 1 2 2v11M7 4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2zM9 7v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1h-8v1a2 2 0 0 1-2 2M12 9h4M12 12.5h4" /></svg>
);
export const DictIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.9"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 13l2.5-6 2.5 6M9.8 11h3.4" /></svg>
);
export const SearchIcon = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth="1.9"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
);
export const DrawIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.8">
    <path d="M15.2 4.3a2 2 0 0 1 2.9 0l1.6 1.6a2 2 0 0 1 0 2.9L9.4 19.1 4.5 20.5l1.4-4.9L15.2 4.3z" />
    <path d="M13.6 5.9l4.5 4.5" />
    <path d="M5.9 15.6l2.5 2.5" />
  </svg>
);
export const IdeaIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="1.9"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></svg>
);
