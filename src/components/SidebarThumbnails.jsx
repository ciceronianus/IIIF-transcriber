import React, { useState } from 'react';
import { 
  Bookmark, 
  FileText, 
  Search, 
  CheckCircle2, 
  Layers, 
  Filter,
  MessageSquare,
  X 
} from 'lucide-react';

export default function SidebarThumbnails({
  canvases,
  selectedCanvasIndex,
  onSelectCanvas,
  onToggleBookmark
}) {
  const [filterType, setFilterType] = useState('all'); // 'all', 'withText', 'withoutText', 'bookmarked'
  const [searchQuery, setSearchQuery] = useState('');

  // Statistics for filters
  const totalCount = canvases.length;
  const withTextCount = canvases.filter(
    (c) => (c.transcriptions && c.transcriptions.some(t => t.text?.trim())) || (c.note && c.note.trim())
  ).length;
  const withoutTextCount = totalCount - withTextCount;
  const bookmarkedCount = canvases.filter((c) => c.isBookmarked).length;

  // Filter canvases
  const filteredCanvases = canvases.filter((canvas) => {
    const hasText = (canvas.transcriptions && canvas.transcriptions.some((t) => t.text?.trim())) || (canvas.note && canvas.note.trim());
    if (filterType === 'withText' && !hasText) return false;
    if (filterType === 'withoutText' && hasText) return false;
    if (filterType === 'bookmarked' && !canvas.isBookmarked) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const labelMatch = canvas.label?.toLowerCase().includes(q);
      const textMatch = canvas.transcriptions?.some((t) => t.text?.toLowerCase().includes(q));
      const noteMatch = canvas.note?.toLowerCase().includes(q);
      if (!labelMatch && !textMatch && !noteMatch) return false;
    }

    return true;
  });

  return (
    <aside id="sidebar-thumbnails-panel" className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 select-none">
      {/* Search and Filters */}
      <div className="p-3 border-b border-gray-200 space-y-2 bg-white">
        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="input-search-canvases"
            type="text"
            placeholder="Search canvases or text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-gray-900 focus:border-gray-900 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter buttons */}
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          <button
            id="filter-btn-all"
            onClick={() => setFilterType('all')}
            className={`px-2 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer border ${
              filterType === 'all'
                ? 'bg-white text-gray-900 border-gray-400 font-semibold shadow-2xs'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
            }`}
          >
            <span>All canvases</span>
            <span className="font-mono text-[10px] text-gray-500">{totalCount}</span>
          </button>

          <button
            id="filter-btn-with-text"
            onClick={() => setFilterType('withText')}
            className={`px-2 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer border ${
              filterType === 'withText'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-400 font-semibold shadow-2xs'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
            }`}
          >
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-emerald-600" />
              <span>With text</span>
            </span>
            <span className="font-mono text-[10px] text-emerald-700">{withTextCount}</span>
          </button>

          <button
            id="filter-btn-without-text"
            onClick={() => setFilterType('withoutText')}
            className={`px-2 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer border ${
              filterType === 'withoutText'
                ? 'bg-amber-50 text-amber-900 border-amber-400 font-semibold shadow-2xs'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
            }`}
          >
            <span>Without text</span>
            <span className="font-mono text-[10px] text-gray-500">{withoutTextCount}</span>
          </button>

          <button
            id="filter-btn-bookmarked"
            onClick={() => setFilterType('bookmarked')}
            className={`px-2 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer border ${
              filterType === 'bookmarked'
                ? 'bg-amber-50 text-amber-900 border-amber-400 font-semibold shadow-2xs'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
            }`}
          >
            <span className="flex items-center gap-1">
              <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>Bookmarked</span>
            </span>
            <span className="font-mono text-[10px] text-amber-800">{bookmarkedCount}</span>
          </button>
        </div>
      </div>

      {/* Thumbnails list */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-white">
        {filteredCanvases.length === 0 ? (
          <div className="text-center py-10 px-4 text-gray-500 text-xs">
            <Filter className="w-6 h-6 mx-auto mb-2 opacity-40 text-gray-400" />
            <p>No canvases match the selected filter.</p>
            {(filterType !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setFilterType('all');
                  setSearchQuery('');
                }}
                className="mt-2 text-blue-600 hover:underline text-[11px] cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          filteredCanvases.map((canvas) => {
            const isSelected = canvas.index === selectedCanvasIndex;
            const validTranscriptions = canvas.transcriptions?.filter((t) => t.text?.trim()) || [];
            const hasText = validTranscriptions.length > 0;
            const hasNote = Boolean(canvas.note && canvas.note.trim());

            return (
              <div
                key={canvas.id}
                onClick={() => onSelectCanvas(canvas.index)}
                className={`relative group rounded-lg p-2 transition-all cursor-pointer border flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-500 shadow-xs'
                    : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Thumbnail Image */}
                <div className="w-14 h-18 bg-gray-50 rounded border border-gray-200 shrink-0 overflow-hidden flex items-center justify-center relative">
                  {canvas.thumbnailUrl || canvas.imageUrl ? (
                    <img
                      src={canvas.thumbnailUrl || canvas.imageUrl}
                      alt={canvas.label}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentNode.classList.add('flex', 'items-center', 'justify-center');
                      }}
                    />
                  ) : (
                    <Layers className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/75 text-[9px] font-mono text-white">
                    {canvas.index + 1}
                  </span>
                </div>

                {/* Canvas details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h4
                      className={`text-xs font-medium truncate ${
                        isSelected ? 'text-blue-900 font-semibold' : 'text-gray-900 group-hover:text-black'
                      }`}
                      title={canvas.label}
                    >
                      {canvas.label}
                    </h4>

                    {/* Bookmark toggle button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBookmark(canvas.id);
                      }}
                      className={`p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer ${
                        canvas.isBookmarked
                          ? 'text-amber-500 hover:text-amber-600'
                          : 'text-gray-300 hover:text-gray-500'
                      }`}
                      title={canvas.isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
                      aria-label="Toggle bookmark"
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          canvas.isBookmarked ? 'fill-amber-500' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    {canvas.width} × {canvas.height} px
                  </p>

                  {/* Text and Note Layer Indicators */}
                  <div className="mt-2 flex items-center flex-wrap gap-1">
                    {hasText && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Transcribed</span>
                      </span>
                    )}
                    {hasNote && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200" title="Contains page note">
                        <MessageSquare className="w-3 h-3 text-blue-600" />
                        <span>Note</span>
                      </span>
                    )}
                    {!hasText && !hasNote && (
                      <span className="text-[10px] text-gray-400 italic">
                        Not transcribed yet
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-2.5 border-t border-gray-200 bg-white text-[11px] text-gray-500 flex items-center justify-between">
        <span>Showing {filteredCanvases.length} of {totalCount}</span>
        <span className="text-gray-400 font-mono">IIIF Canvases</span>
      </div>
    </aside>
  );
}
