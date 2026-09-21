import React, { useState } from 'react';
import { 
  Bookmark, 
  Copy, 
  Check, 
  FileText, 
  MessageSquare, 
  Info,
  Trash2
} from 'lucide-react';

const COMMON_LANGUAGES = [
  { code: 'en', label: 'English (en)' },
  { code: 'cs', label: 'Czech (cs)' },
  { code: 'la', label: 'Latin (la)' },
  { code: 'de', label: 'German (de)' },
  { code: 'fr', label: 'French (fr)' },
  { code: 'it', label: 'Italian (it)' },
  { code: 'es', label: 'Spanish (es)' },
  { code: 'el', label: 'Greek (el)' },
  { code: 'he', label: 'Hebrew (he)' },
  { code: 'ar', label: 'Arabic (ar)' }
];

export default function TranscriptionEditor({
  canvas,
  onUpdateCanvasData,
  onToggleBookmark
}) {
  const [copiedType, setCopiedType] = useState(null); // 'transcription' | 'note' | 'all'

  if (!canvas) {
    return (
      <div id="transcription-editor-empty" className="w-96 bg-white border-l border-gray-200 p-6 flex flex-col items-center justify-center text-gray-400 text-xs">
        <p>No canvas selected.</p>
      </div>
    );
  }

  const transcriptions = canvas.transcriptions || [];
  const primaryTranscription = transcriptions[0] || null;
  const currentText = primaryTranscription?.text || '';
  const currentLang = primaryTranscription?.language || 'en';

  const currentNote = canvas.note || '';
  const currentNoteLang = canvas.noteLanguage || 'en';

  // Words and characters counting
  const charCount = currentText.length;
  const wordCount = currentText.trim() ? currentText.trim().split(/\s+/).length : 0;

  // Handlers for transcription
  const handleTextChange = (newText) => {
    let updatedTranscriptions;
    if (primaryTranscription) {
      updatedTranscriptions = transcriptions.map((t, idx) => 
        idx === 0 ? { ...t, text: newText } : t
      );
    } else {
      updatedTranscriptions = [
        {
          id: `transcription-${canvas.id}-${Date.now()}`,
          text: newText,
          language: currentLang,
          format: 'text/plain',
          targetRegion: null,
          canvasId: canvas.id
        }
      ];
    }
    onUpdateCanvasData(canvas.id, { transcriptions: updatedTranscriptions });
  };

  const handleLanguageChange = (newLang) => {
    let updatedTranscriptions;
    if (primaryTranscription) {
      updatedTranscriptions = transcriptions.map((t, idx) => 
        idx === 0 ? { ...t, language: newLang } : t
      );
    } else {
      updatedTranscriptions = [
        {
          id: `transcription-${canvas.id}-${Date.now()}`,
          text: '',
          language: newLang,
          format: 'text/plain',
          targetRegion: null,
          canvasId: canvas.id
        }
      ];
    }
    onUpdateCanvasData(canvas.id, { transcriptions: updatedTranscriptions });
  };

  // Handlers for page note
  const handleNoteChange = (newNote) => {
    onUpdateCanvasData(canvas.id, { note: newNote });
  };

  const handleNoteLangChange = (newLang) => {
    onUpdateCanvasData(canvas.id, { noteLanguage: newLang });
  };

  // Copy helper
  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyAll = () => {
    let content = '';
    if (currentText.trim()) {
      content += `=== Page Transcription (${canvas.label}) ===\n${currentText.trim()}\n\n`;
    }
    if (currentNote.trim()) {
      content += `=== General Page Note ===\n${currentNote.trim()}\n`;
    }
    copyToClipboard(content.trim(), 'all');
  };

  return (
    <div id="transcription-editor-panel" className="w-96 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden select-none">
      {/* Canvas Top Bar */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
        <div className="min-w-0 pr-2">
          <h3 className="text-sm font-semibold text-gray-900 truncate" title={canvas.label}>
            {canvas.label}
          </h3>
          <p className="text-[11px] text-gray-400 font-mono">
            {canvas.width} × {canvas.height} px
          </p>
        </div>

        {/* Bookmark Action */}
        <button
          id="btn-toggle-bookmark-editor"
          onClick={() => onToggleBookmark(canvas.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            canvas.isBookmarked
              ? 'bg-amber-50 border-amber-300 text-amber-800'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
          }`}
          title={canvas.isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
        >
          <Bookmark className={`w-3.5 h-3.5 ${canvas.isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
          <span>{canvas.isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
        </button>
      </div>

      {/* Editor Content (Scrollable) */}
      <div className="flex-1 p-4 space-y-5 overflow-y-auto min-h-0 select-text">
        
        {/* SECTION 1: Page Text Transcription */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-700" />
              <label htmlFor="transcription-textarea" className="text-xs font-semibold text-gray-900">
                Page Transcription
              </label>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
              supplementing
            </span>
          </div>

          {/* Controls: Language and copy */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <label htmlFor="transcription-lang-select" className="text-[11px] text-gray-500">
                Language:
              </label>
              <select
                id="transcription-lang-select"
                value={currentLang}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="text-[11px] px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-gray-900 cursor-pointer"
              >
                {COMMON_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              id="btn-copy-transcription"
              onClick={() => copyToClipboard(currentText, 'transcription')}
              disabled={!currentText.trim()}
              className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 transition-colors cursor-pointer"
              title="Copy transcription to clipboard"
            >
              {copiedType === 'transcription' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Text Area */}
          <textarea
            id="transcription-textarea"
            value={currentText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Enter the text transcription of this page (folio) here..."
            rows={10}
            className="w-full p-3 text-xs leading-relaxed rounded-xl bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-gray-900 focus:border-gray-900 resize-y font-sans transition-all shadow-2xs"
          />

          {/* Stats Bar */}
          <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1 px-1 font-mono">
            <span>{charCount} characters</span>
            <span>{wordCount} words</span>
          </div>
        </div>

        {/* SECTION 2: General Page Note */}
        <div className="flex flex-col pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <label htmlFor="note-textarea" className="text-xs font-semibold text-gray-900">
                General Page Note
              </label>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono">
              commenting
            </span>
          </div>

          <p className="text-[11px] text-gray-500 mb-2 leading-tight">
            Scholarly, curatorial, or editorial note for this folio (condition, provenance, marginalia).
          </p>

          {/* Language & Copy for note */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <label htmlFor="note-lang-select" className="text-[11px] text-gray-500">
                Language:
              </label>
              <select
                id="note-lang-select"
                value={currentNoteLang}
                onChange={(e) => handleNoteLangChange(e.target.value)}
                className="text-[11px] px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-gray-900 cursor-pointer"
              >
                {COMMON_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              id="btn-copy-note"
              onClick={() => copyToClipboard(currentNote, 'note')}
              disabled={!currentNote.trim()}
              className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 transition-colors cursor-pointer"
              title="Copy note to clipboard"
            >
              {copiedType === 'note' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <textarea
            id="note-textarea"
            value={currentNote}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Enter general notes or comments for this page..."
            rows={5}
            className="w-full p-3 text-xs leading-relaxed rounded-xl bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 resize-y font-sans transition-all shadow-2xs"
          />

          <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1 px-1 font-mono">
            <span>{currentNote.length} characters</span>
          </div>

          {/* IIIF Specification explanation note */}
          <div className="mt-3 p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 text-[11px] flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            <p className="leading-normal">
              According to the <strong>IIIF Presentation 3.0</strong> and <strong>W3C Web Annotation</strong> specifications, notes are stored with the motivation <code className="text-gray-700 bg-gray-200/60 px-1 py-0.5 rounded font-mono">commenting</code> and as canvas <code className="text-gray-700 bg-gray-200/60 px-1 py-0.5 rounded font-mono">summary</code>.
            </p>
          </div>
        </div>

      </div>

      {/* Editor Footer / Global Actions */}
      <div className="p-3 border-t border-gray-200 bg-gray-50/70 flex items-center justify-between gap-2 shrink-0">
        <button
          id="btn-copy-all"
          onClick={handleCopyAll}
          disabled={!currentText.trim() && !currentNote.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
        >
          {copiedType === 'all' ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-600 font-semibold">All copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy All</span>
            </>
          )}
        </button>

        {(currentText || currentNote) && (
          <button
            id="btn-clear-canvas-texts"
            onClick={() => {
              if (window.confirm('Are you sure you want to clear the transcription and note for this page?')) {
                handleTextChange('');
                handleNoteChange('');
              }
            }}
            className="flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
            title="Clear texts for this page"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>
    </div>
  );
}
