/**
 * IIIF Document Transcriber - Pure Vanilla JavaScript Application
 * Supports IIIF Presentation API 2.0, 2.1, and 3.0.
 * Features: Manifest loader (disk/URL/sample), interactive canvas viewer (zoom, pan, rotate),
 * searchable canvas sidebar with filter tabs and bookmarks, transcription & page notes editor,
 * and JSON preview modal with tabs for Full Manifest vs Current Page Canvas.
 */

import { parseIIIFManifest, SAMPLE_MANIFESTS } from './lib/iiifParser.js';
import { buildIIIFManifest, exportManifestJsonString, downloadJsonFile } from './lib/manifestExporter.js';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import Prism from 'https://esm.sh/prismjs@1.29.0';
import 'https://esm.sh/prismjs@1.29.0/components/prism-json';

let connectedFileHandle = null;

// Application State
let state = {
  manifest: null, // parsed manifest object or null
  activeCanvasIndex: 0,
  searchQuery: '',
  filterType: 'all', // 'all' | 'with-text' | 'without-text' | 'bookmarked'
  // Canvas viewer state
  scale: 1,
  rotation: 0,
  pan: { x: 0, y: 0 },
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  // Modals state
  isLoaderOpen: false,
  isJsonModalOpen: false,
  jsonTab: 'full', // 'full' | 'canvas'
  loaderTab: 'disk', // 'disk' | 'url'
  urlInput: '',
  useCorsProxy: true,
  isLoadingUrl: false,
  loadError: null,
  copiedType: null, // for copy feedback
  isSidebarCollapsed: false,
  editorTab: 'transcription',
  layoutMode: 'sidebar', // 'sidebar' | 'bottom'
  isJumpModalOpen: false,
  isExportModalOpen: false,
  transcriptionFontSize: Number(sessionStorage.getItem('transcriptionFontSize')) || 14,
  isEditingZoom: false,
  fileHandle: null,
  fileName: '',
  isDirty: false,
  saveStatus: ''
};

// Start without loading a manifest so the user can choose one from the loader.
function initApp() {
  render();
}

// State updater helper
function updateState(updater) {
  if (typeof updater === 'function') {
    updater(state);
  } else {
    Object.assign(state, updater);
  }
  render();
}

function getSaveStatusText() {
  if (state.saveStatus) return state.saveStatus;
  if (state.isDirty) return 'Unsaved changes';
  if (state.fileName) return `Saved to ${state.fileName}`;
  return 'Save a local copy to edit';
}

function markManifestDirty() {
  state.isDirty = true;
  state.saveStatus = '';
  const statusEl = document.getElementById('save-status');
  if (statusEl) {
    statusEl.className = 'text-[10px] text-amber-600';
    statusEl.textContent = getSaveStatusText();
  }
}

// --- RENDERING ---

function render() {
  const appEl = document.getElementById('root') || document.getElementById('app');
  if (!appEl) return;

  // Save scroll positions
  const sidebarScroll = document.getElementById('sidebar-canvas-list')?.scrollTop;
  const transcriptionScroll = document.getElementById('textarea-transcription')?.scrollTop;
  const noteScroll = document.getElementById('textarea-note')?.scrollTop;

  const manifest = state.manifest;
  const activeCanvas = manifest && manifest.canvases ? manifest.canvases[state.activeCanvasIndex] : null;

  // Compute stats
  const totalCanvases = manifest ? manifest.canvases.length : 0;
  const withTextCount = manifest ? manifest.canvases.filter(c => c.transcriptions && c.transcriptions.some(t => t.text && t.text.trim())).length : 0;
  const withNoteCount = manifest ? manifest.canvases.filter(c => c.note && c.note.trim()).length : 0;
  const bookmarkedCount = manifest ? manifest.canvases.filter(c => c.isBookmarked).length : 0;

  appEl.innerHTML = `
    <!-- Header -->
    <header class="bg-white text-gray-900 border-b border-gray-200 shrink-0 select-none shadow-2xs">
      <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <button id="btn-toggle-sidebar" class="p-1.5 bg-white border border-gray-200 rounded-md cursor-pointer text-gray-500 hover:text-gray-900 shadow-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${state.isSidebarCollapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}"></path></svg>
          </button>
          <div class="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-sm tracking-wider shrink-0 shadow-xs">
            IIIF
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h1 class="text-sm font-semibold tracking-tight text-gray-900">
                IIIF Document Transcriber
              </h1>
            </div>
            <p class="text-xs text-gray-500 truncate max-w-md">
              ${manifest ? escapeHtml(manifest.label) : 'No manifest loaded'}
            </p>
            ${manifest ? `<p id="save-status" class="text-[10px] ${state.isDirty ? 'text-amber-600' : 'text-gray-400'}">${escapeHtml(getSaveStatusText())}</p>` : ''}
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            id="btn-open-manifest"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 hover:border-gray-400 transition-colors shadow-2xs cursor-pointer"
            title="Open IIIF manifest from disk or URL"
          >
            <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path></svg>
            <span>Open Manifest</span>
          </button>

          ${manifest ? `
            <button
              id="btn-save-manifest"
              class="p-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer transition-colors"
              title="${state.fileHandle ? 'Save manifest to local file' : 'Save a local copy'}"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 20h14a1 1 0 001-1V7.5L16.5 4H5a1 1 0 00-1 1v14a1 1 0 001 1zm3-16v5h7V4M8 20v-5h8v5"></path></svg>
            </button>
            <button
              id="btn-view-json"
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer"
              title="Zobrazit manifest.json"
            >
              <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
              <span class="hidden sm:inline">JSON</span>
            </button>
            <button
              id="btn-open-export"
              class="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-gray-900 hover:bg-gray-800 text-white transition-colors shadow-2xs cursor-pointer"
              title="Exportovat transkripce a manifest"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              <span>Export</span>
            </button>
          ` : ''}
        </div>
      </div>
    </header>

    <!-- Main Workspace -->
    <div class="flex-1 flex overflow-hidden">
      ${manifest ? renderSidebar(manifest, totalCanvases, withTextCount, withNoteCount, bookmarkedCount) : renderEmptyWorkspace()}
      
      ${state.layoutMode === 'sidebar' ? `
        ${manifest && activeCanvas ? renderCanvasViewer(activeCanvas) : ''}
        ${manifest && activeCanvas ? renderTranscriptionEditor(activeCanvas) : ''}
      ` : `
        <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
          ${manifest && activeCanvas ? renderCanvasViewer(activeCanvas) : ''}
          ${manifest && activeCanvas ? renderTranscriptionEditor(activeCanvas) : ''}
        </div>
      `}
    </div>

    <!-- Modals -->
    ${state.isLoaderOpen ? renderLoaderModal() : ''}
    ${state.isJsonModalOpen ? renderJsonModal() : ''}
    ${state.isJumpModalOpen ? renderJumpModal() : ''}
    ${state.isExportModalOpen ? renderExportModal() : ''}
  `;

  attachEventHandlers();

  // Restore scroll positions
  if (sidebarScroll !== undefined) {
    const el = document.getElementById('sidebar-canvas-list');
    if (el) el.scrollTop = sidebarScroll;
  }
  if (transcriptionScroll !== undefined) {
    const el = document.getElementById('textarea-transcription');
    if (el) {
      el.scrollTop = transcriptionScroll;
      updateLineNumbers(el); // Sync gutter
    }
  }
  if (noteScroll !== undefined) {
    const el = document.getElementById('textarea-note');
    if (el) el.scrollTop = noteScroll;
  }
}

// --- SIDEBAR RENDER ---

function renderSidebar(manifest, totalCount, withTextCount, withNoteCount, bookmarkedCount) {
  const withoutTextCount = totalCount - withTextCount;

  // Filter canvases
  const query = state.searchQuery.toLowerCase();
  const filteredCanvases = manifest.canvases.map((c, idx) => ({ c, idx })).filter(({ c }) => {
    const labelStr = escapeHtml(typeof c.label === 'string' ? c.label : (c.label.en ? c.label.en.join(' ') : ''));
    const matchesSearch = !query || labelStr.toLowerCase().includes(query) || (c.transcriptions && c.transcriptions.some(t => t.text.toLowerCase().includes(query)));
    
    const hasText = c.transcriptions && c.transcriptions.some(t => t.text && t.text.trim());
    const hasNote = c.note && c.note.trim();
    if (state.filterType === 'with-text' && !hasText) return false;
    if (state.filterType === 'with-note' && !hasNote) return false;
    if (state.filterType === 'bookmarked' && !c.isBookmarked) return false;
    if (state.filterType === 'without-text' && hasText) return false;

    return matchesSearch;
  });

  return `
    <aside class="${state.isSidebarCollapsed ? 'w-12' : 'w-80'} bg-gray-50/80 border-r border-gray-200 flex flex-col shrink-0 select-none relative transition-all duration-300">
      
      ${!state.isSidebarCollapsed ? `
        <!-- Filters -->
        <div class="p-3 border-b border-gray-200 space-y-2.5 bg-white">
          <!-- Filter Tabs -->
          <div class="grid grid-cols-5 gap-1 bg-gray-100 p-1 rounded-lg text-[11px] font-medium">
            <button
              class="filter-tab px-1 py-1 rounded text-center transition-colors cursor-pointer ${state.filterType === 'all' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'}"
              data-filter="all"
            >
              <span class="block">All</span>
              <span class="block font-bold">${totalCount}</span>
            </button>
            <button
              class="filter-tab px-1 py-1 rounded text-center transition-colors cursor-pointer ${state.filterType === 'with-text' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'}"
              data-filter="with-text"
            >
              <span class="block">Text</span>
              <span class="block font-bold">${withTextCount}</span>
            </button>
            <button
              class="filter-tab px-1 py-1 rounded text-center transition-colors cursor-pointer ${state.filterType === 'with-note' ? 'bg-white text-blue-800 shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'}"
              data-filter="with-note"
            >
              <span class="block">Note</span>
              <span class="block font-bold">${withNoteCount}</span>
            </button>
            <button
              class="filter-tab px-1 py-1 rounded text-center transition-colors cursor-pointer ${state.filterType === 'bookmarked' ? 'bg-white text-amber-800 shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'}"
              data-filter="bookmarked"
            >
              <span class="flex justify-center"><svg class="w-3.5 h-3.5 ${state.filterType === 'bookmarked' ? 'fill-amber-500 text-amber-500' : 'text-gray-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg></span>
              <span class="block font-bold mt-0.5">${bookmarkedCount}</span>
            </button>
            <button
              class="filter-tab px-1 py-1 rounded text-center transition-colors cursor-pointer ${state.filterType === 'without-text' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'}"
              data-filter="without-text"
            >
              <span class="block">Empty</span>
              <span class="block font-bold">${withoutTextCount}</span>
            </button>
          </div>
        </div>

        <!-- Canvases List -->
        <div id="sidebar-canvas-list" class="flex-1 overflow-y-auto p-2.5 space-y-2">
          ${filteredCanvases.length === 0 ? `
            <div class="text-center py-10 px-4 text-gray-500 text-xs">
              <svg class="w-6 h-6 mx-auto mb-2 opacity-40 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
              <p>No canvases match the selected filter.</p>
            </div>
          ` : filteredCanvases.map(({ c, idx }) => {
            const isSelected = idx === state.activeCanvasIndex;
            const hasText = c.transcriptions && c.transcriptions.some(t => t.text && t.text.trim());
            const hasNote = c.note && c.note.trim();
            const label = typeof c.label === 'string' ? c.label : (c.label.en ? c.label.en.join(' ') : `Page ${idx + 1}`);

            return `
              <div
                class="canvas-card group relative flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white border-gray-900 shadow-xs ring-1 ring-gray-900'
                    : 'bg-white/80 hover:bg-white border-gray-200 hover:border-gray-300'
                }"
                data-index="${idx}"
              >
                <!-- Thumbnail -->
                <div class="w-12 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200 relative flex items-center justify-center">
                  ${c.thumbnailUrl || c.imageUrl ? `
                    <img src="${escapeHtml(c.thumbnailUrl || c.imageUrl)}" alt="${escapeHtml(label)}" class="w-full h-full object-cover" loading="lazy" />
                  ` : `
                    <svg class="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  `}
                  <span class="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/60 text-white text-[9px] font-mono">
                    ${idx + 1}
                  </span>
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1 mb-1">
                    <h3 class="text-xs font-medium text-gray-900 truncate">
                      ${escapeHtml(label)}
                    </h3>
                    <button
                      class="btn-toggle-bookmark p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-amber-500 transition-colors cursor-pointer ${c.isBookmarked ? 'text-amber-500' : ''}"
                      data-index="${idx}"
                      title="${c.isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}"
                    >
                      <svg class="w-3.5 h-3.5 ${c.isBookmarked ? 'fill-amber-500 text-amber-500' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                    </button>
                  </div>

                  <div class="flex items-center gap-1.5 flex-wrap">
                    ${hasText ? `
                      <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <svg class="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        <span>Transcribed</span>
                      </span>
                    ` : ''}
                    ${hasNote ? `
                      <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200" title="Contains page note">
                        <svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
                        <span>Note</span>
                      </span>
                    ` : ''}
                    ${!hasText && !hasNote ? '<span class="text-[10px] text-gray-400">Not transcribed yet</span>' : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    </aside>
  `;
}

function renderEmptyWorkspace() {
  return `
    <div class="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 text-center">
      <div class="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 mb-4 shadow-sm">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      </div>
      <h2 class="text-lg font-semibold text-gray-900 mb-1">No IIIF Manifest Loaded</h2>
      <p class="text-xs text-gray-500 max-w-sm mb-6">Open a valid IIIF Presentation manifest from your computer or URL, or load a sample document to start transcribing pages.</p>
      <button
        id="btn-open-manifest-empty"
        class="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
      >
        Open Manifest
      </button>
    </div>
  `;
}

// --- CANVAS VIEWER RENDER ---

function renderCanvasViewer(canvas) {
  const label = typeof canvas.label === 'string' ? canvas.label : (canvas.label.en ? canvas.label.en.join(' ') : 'Canvas');
  const imageUrl = canvas.imageUrl;
  const naturalWidth = canvas.width || 1200;
  const naturalHeight = canvas.height || 1600;

  return `
    <div class="flex-1 flex flex-col bg-gray-950 relative overflow-hidden select-none">
      <!-- Top Toolbar -->
      <div class="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-white/20 shadow-lg text-gray-700">
        <button id="btn-zoom-in" class="p-1.5 rounded hover:bg-gray-100 transition-colors cursor-pointer" title="Zoom in (+)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        </button>
        <button id="btn-zoom-out" class="p-1.5 rounded hover:bg-gray-100 transition-colors cursor-pointer" title="Zoom out (-)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
        </button>
        <button id="btn-zoom-fit" class="p-1.5 rounded hover:bg-gray-100 transition-colors cursor-pointer" title="Fit to window">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
        </button>
        <button id="btn-zoom-100" class="px-2 py-1 text-xs font-mono rounded hover:bg-gray-100 transition-colors cursor-pointer font-medium" title="Original size 1:1">1:1</button>
        <div class="w-px h-4 bg-gray-300 mx-1"></div>
        ${state.isEditingZoom ? `
          <input id="input-zoom-value" type="number" min="5" max="500" value="${Math.round(state.scale * 100)}" class="w-14 text-xs font-mono px-1 py-0.5 border border-gray-300 rounded text-center" />
        ` : `
          <span id="zoom-display" class="text-xs font-mono px-2 cursor-pointer hover:bg-gray-100 rounded" title="Click to type an exact zoom level">Zoom: ${Math.round(state.scale * 100)}%</span>
        `}
        <div class="w-px h-4 bg-gray-300 mx-1"></div>
        <button id="btn-rotate" class="p-1.5 rounded hover:bg-gray-100 transition-colors cursor-pointer" title="Rotate 90°">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        </button>
      </div>

      <!-- Canvas Stage -->
      <div
        id="canvas-stage"
        class="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
      >

        <div
          id="canvas-transform-wrapper"
          class="absolute transition-transform duration-75 ease-out flex items-center justify-center"
          style="transform: translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.scale}) rotate(${state.rotation}deg);"
        >
          ${imageUrl ? `
            <img
              src="${escapeHtml(imageUrl)}"
              alt="${escapeHtml(label)}"
              class="max-w-none shadow-2xl rounded-sm"
              style="width: ${naturalWidth}px; height: ${naturalHeight}px;"
              draggable="false"
            />
          ` : `
            <div class="w-[800px] h-[1000px] bg-white border border-gray-300 rounded flex flex-col items-center justify-center text-gray-500 gap-3">
              <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              <p class="text-sm">No image available for this canvas</p>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

// --- TRANSCRIPTION EDITOR RENDER ---

function renderTranscriptionEditor(canvas) {
  const transcriptions = canvas.transcriptions || [];
  const primaryTranscription = transcriptions[0] || null;
  const currentText = primaryTranscription ? primaryTranscription.text : '';
  const currentLang = primaryTranscription ? primaryTranscription.language || 'en' : 'en';

  const naturalWidth = canvas.width || 1200;
  const naturalHeight = canvas.height || 1600;
  const label = typeof canvas.label === 'string' ? canvas.label : (canvas.label.en ? canvas.label.en.join(' ') : 'Canvas');

  const currentNote = canvas.note || '';
  const currentNoteLang = canvas.noteLanguage || 'en';

  const charCount = currentText.length;
  const wordCount = currentText.trim() ? currentText.trim().split(/\s+/).length : 0;

  const languages = [
    { code: 'en', label: 'English (en)' },
    { code: 'cs', label: 'Czech (cs)' },
    { code: 'la', label: 'Latin (la)' },
    { code: 'de', label: 'German (de)' },
    { code: 'fr', label: 'French (fr)' },
    { code: 'it', label: 'Italian (it)' },
    { code: 'es', label: 'Spanish (es)' },
    { code: 'el', label: 'Greek (el)' }
  ];

  const containerClasses = state.layoutMode === 'sidebar'
    ? 'w-96 border-l border-gray-200'
    : 'h-80 border-t border-gray-200 w-full';

  return `
    <div class="${containerClasses} bg-white flex flex-col shrink-0 overflow-hidden select-none">
      <!-- Editor Header -->
      <div class="px-4 py-2 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
            <div id="btn-jump-to-page" class="cursor-pointer hover:bg-gray-50 px-1 -mx-1 rounded transition-colors" title="Jump to page...">
              <p class="text-sm font-semibold text-gray-900 truncate max-w-[250px]">
                ${String(state.activeCanvasIndex + 1) === String(label) 
                  ? escapeHtml(label) 
                  : `${state.activeCanvasIndex + 1} (${escapeHtml(label)})`}
              </p>
              <p class="text-[10px] text-gray-500 font-mono">${naturalWidth} x ${naturalHeight} px</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              id="btn-toggle-layout"
              class="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
              title="Toggle Layout (Sidebar / Bottom)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                ${state.layoutMode === 'sidebar' 
                  ? '<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 15h18" />' 
                  : '<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" />'}
              </svg>
            </button>
            <button
              id="btn-toggle-bookmark-active"
              class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                canvas.isBookmarked
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }"
            >
              <svg class="w-3.5 h-3.5 ${canvas.isBookmarked ? 'fill-amber-500 text-amber-500' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Editor Tabs -->
      <div class="flex border-b border-gray-200 shrink-0 bg-gray-50/50">
        <button
          data-tab="transcription"
          class="editor-tab flex-1 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${state.editorTab === 'transcription' ? 'border-gray-900 text-gray-900 bg-white shadow-sm' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'}"
        >
          Transcription
        </button>
        <button
          data-tab="note"
          class="editor-tab flex-1 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${state.editorTab === 'note' ? 'border-gray-900 text-gray-900 bg-white shadow-sm' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'}"
        >
          Note
        </button>
      </div>

      <div class="p-4 flex-1 overflow-y-auto">
        ${state.editorTab === 'transcription' ? `
          <!-- SECTION 1: Page Transcription -->
          <div class="flex flex-col h-full">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5">
                <svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <label class="text-xs font-semibold text-gray-900">Transcription</label>
              </div>
              <div class="flex items-center gap-1">
                <button id="btn-font-size-down" class="px-1.5 py-0.5 text-xs font-semibold rounded hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer" title="Decrease font size">A-</button>
                <button id="btn-font-size-up" class="px-1.5 py-0.5 text-xs font-semibold rounded hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer" title="Increase font size">A+</button>
              </div>
            </div>

            <div class="relative flex font-mono border border-gray-300 rounded-xl bg-white shadow-2xs overflow-hidden h-full min-h-[200px]">
              <div id="transcription-line-numbers" style="font-size: ${state.transcriptionFontSize}px;" class="w-10 bg-gray-50 text-gray-400 py-3 text-right pr-2 border-r border-gray-200 select-none leading-relaxed overflow-hidden h-full">
                1
              </div>
              <textarea
                id="textarea-transcription"
                placeholder="Enter the text transcription of this page (folio) here..."
                style="font-size: ${state.transcriptionFontSize}px;"
                class="flex-1 p-3 leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-hidden resize-none font-junicode h-full overflow-auto whitespace-pre"
                wrap="off"
              >${escapeHtml(currentText)}</textarea>
            </div>
          </div>
        ` : `
          <!-- SECTION 2: General Page Note -->
          <div class="flex flex-col h-full">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5">
                <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
                <label class="text-xs font-semibold text-gray-900">Note</label>
              </div>
            </div>

            <textarea
              id="textarea-note"
              placeholder="Enter general notes or comments for this page..."
              class="w-full p-4 text-xs leading-relaxed rounded-xl bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 resize-none font-sans shadow-2xs h-full min-h-[200px]"
            >${escapeHtml(currentNote)}</textarea>
          </div>
        `}
      </div>
    </div>
  `;
}

// --- MODALS RENDER ---

function renderExportModal() {
  return `
    <div id="export-modal-overlay" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-900">Export Options</h3>
            <button id="btn-close-export" class="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          
          <div class="space-y-6">
            <!-- Option 1: Full Manifest -->
            <div class="p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors bg-gray-50/30">
              <div class="flex items-start gap-3 mb-3">
                <div class="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </div>
                <div>
                  <p class="text-sm font-bold text-gray-900">Complete IIIF Manifest</p>
                  <p class="text-[11px] text-gray-500">Saves everything (transcriptions, notes, bookmarks) into a single JSON file.</p>
                </div>
              </div>
              <button 
                id="btn-export-manifest"
                class="w-full py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer shadow-xs"
              >
                Download manifest.json
              </button>
            </div>

            <!-- Option 2: Individual TXT files -->
            <div class="p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors bg-blue-50/20">
              <div class="flex items-start gap-3 mb-4">
                <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <div>
                  <p class="text-sm font-bold text-gray-900">Individual TXT files</p>
                  <p class="text-[11px] text-gray-500">Exports each page as a separate text file in a ZIP archive.</p>
                </div>
              </div>
              
              <div class="space-y-3">
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">File Naming</label>
                <div class="grid grid-cols-2 gap-2">
                  <button 
                    id="btn-export-txt-label"
                    class="py-2.5 px-3 bg-white border border-gray-300 text-gray-700 rounded-lg text-[11px] font-bold hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer shadow-xs flex flex-col items-center gap-1"
                  >
                    <span>By Label</span>
                    <span class="text-[9px] font-normal text-gray-400 font-mono">label.txt</span>
                  </button>
                  <button 
                    id="btn-export-txt-index"
                    class="py-2.5 px-3 bg-white border border-gray-300 text-gray-700 rounded-lg text-[11px] font-bold hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer shadow-xs flex flex-col items-center gap-1"
                  >
                    <span>By Index</span>
                    <span class="text-[9px] font-normal text-gray-400 font-mono">001.txt</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderJumpModal() {
  const total = state.manifest ? state.manifest.canvases.length : 0;
  return `
    <div id="jump-modal-overlay" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-900">Jump to Page</h3>
            <button id="btn-close-jump" class="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Page Number (1 - ${total})</label>
              <input 
                type="number" 
                id="input-jump-page" 
                min="1" 
                max="${total}" 
                value="${state.activeCanvasIndex + 1}"
                class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-gray-900 focus:border-transparent text-lg font-bold"
              />
            </div>
            
            <button 
              id="btn-confirm-jump"
              class="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200 cursor-pointer"
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLoaderModal() {
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div class="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-sm">
              IIIF
            </div>
            <div>
              <h2 class="text-sm font-semibold text-gray-900">Open IIIF Manifest</h2>
              <p class="text-xs text-gray-500">Load a manifest.json file or remote URL</p>
            </div>
          </div>
          <button id="btn-close-loader" class="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-gray-200 bg-gray-50 px-6 pt-3 gap-2">
          <button
            class="loader-tab px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer ${state.loaderTab === 'disk' ? 'bg-white text-gray-900 border-t border-x border-gray-200' : 'text-gray-500 hover:text-gray-900'}"
            data-tab="disk"
          >
            From Computer / Disk
          </button>
          <button
            class="loader-tab px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer ${state.loaderTab === 'url' ? 'bg-white text-gray-900 border-t border-x border-gray-200' : 'text-gray-500 hover:text-gray-900'}"
            data-tab="url"
          >
            From URL Address
          </button>
        </div>

        <div class="p-6 space-y-6">
          ${state.loadError ? `
            <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <svg class="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <span>${escapeHtml(state.loadError)}</span>
            </div>
          ` : ''}

          ${(!window.showOpenFilePicker || !window.showSaveFilePicker || window.location.protocol === 'file:') ? `
            <div class="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              Direct saving requires a Chromium browser with File System Access enabled. Open this app from a local web server, for example <strong>http://127.0.0.1:8000</strong>. Firefox-based browsers can only download a copy.
            </div>
          ` : ''}

          ${state.loaderTab === 'disk' ? `
            <div class="space-y-4">
              <div
                id="dropzone"
                class="border-2 border-dashed border-gray-300 hover:border-gray-900 rounded-2xl p-8 text-center bg-gray-50/50 transition-colors cursor-pointer flex flex-col items-center justify-center"
              >
                <div class="w-12 h-12 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center text-gray-600 mb-3">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                </div>
                <p class="text-sm font-semibold text-gray-900 mb-1">Drag and drop manifest.json file here</p>
                <p class="text-xs text-gray-500 mb-4">Open any valid IIIF Presentation 2.x or 3.0 manifest</p>
                <button id="btn-pick-file" type="button" class="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                  Open file from disk
                </button>
                <label class="text-xs text-gray-500 underline cursor-pointer">
                  Use browser fallback
                  <input id="file-input" type="file" accept=".json,application/json" class="hidden" />
                </label>
              </div>
            </div>
          ` : `
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1.5">IIIF manifest URL address</label>
                <div class="flex gap-2">
                  <input
                    id="input-url"
                    type="url"
                    placeholder="https://example.org/iiif/manifest.json"
                    value="${escapeHtml(state.urlInput)}"
                    class="flex-1 px-3 py-2 text-xs rounded-lg bg-white border border-gray-300 text-gray-900 focus:outline-hidden focus:ring-1 focus:ring-gray-900"
                  />
                  <button
                    id="btn-fetch-url"
                    class="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-900 hover:bg-gray-800 text-white transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                    ${state.isLoadingUrl ? 'disabled' : ''}
                  >
                    ${state.isLoadingUrl ? 'Loading...' : 'Load'}
                  </button>
                </div>
              </div>

              <div class="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between text-xs">
                <div>
                  <span class="font-medium text-gray-900 block">Use CORS proxy</span>
                  <span class="text-[11px] text-gray-500">Bypasses browser CORS restrictions</span>
                </div>
                <input id="checkbox-cors" type="checkbox" ${state.useCorsProxy ? 'checked' : ''} class="w-4 h-4 rounded text-gray-900 focus:ring-gray-900 cursor-pointer" />
              </div>
            </div>
          `}

          <!-- Sample Manifests -->
          <div class="pt-4 border-t border-gray-200">
            <p class="text-xs font-medium text-gray-700 mb-2.5">Or load a sample IIIF document:</p>
            <div class="grid grid-cols-2 gap-2">
              ${SAMPLE_MANIFESTS.map((sample, sIdx) => `
                <button
                  class="btn-sample p-2.5 rounded-xl border border-gray-200 hover:border-gray-900 hover:bg-gray-50 text-left transition-all cursor-pointer flex flex-col justify-between"
                  data-url="${sample.url}"
                >
                  <span class="text-xs font-semibold text-gray-900 line-clamp-1">${escapeHtml(sample.title)}</span>
                  <span class="text-[10px] text-gray-500 mt-1">${escapeHtml(sample.institution)}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderJsonModal() {
  const manifest = state.manifest;
  let jsonString = '';

  if (state.jsonTab === 'full') {
    jsonString = exportManifestJsonString(manifest);
  } else {
    // Current page canvas JSON with user edits included
    const fullManifestObj = buildIIIFManifest(manifest);
    const canvasObj = fullManifestObj.items && fullManifestObj.items[state.activeCanvasIndex] ? fullManifestObj.items[state.activeCanvasIndex] : manifest.canvases[state.activeCanvasIndex];
    jsonString = JSON.stringify(canvasObj, null, 2);
  }

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div class="bg-white border border-gray-200 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh]">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0 bg-white">
          <div class="flex items-center gap-2.5">
            <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
            <div>
              <h2 class="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span>${state.jsonTab === 'full' ? 'manifest.json (Full)' : `Canvas JSON (Page ${state.activeCanvasIndex + 1})`}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 border border-gray-200 font-mono">IIIF 3.0</span>
              </h2>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Tabs Switcher requested by user -->
            <div class="bg-gray-100 p-1 rounded-lg flex text-xs font-medium">
              <button
                class="json-tab px-3 py-1 rounded transition-colors cursor-pointer ${state.jsonTab === 'full' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'}"
                data-tab="full"
              >
                Whole Manifest
              </button>
              <button
                class="json-tab px-3 py-1 rounded transition-colors cursor-pointer ${state.jsonTab === 'canvas' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'}"
                data-tab="canvas"
              >
                Current Page
              </button>
            </div>

            <button
              id="btn-download-json-modal"
              class="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-gray-900 hover:bg-gray-800 text-white transition-colors cursor-pointer shadow-2xs"
            >
              <span>Download manifest.json</span>
            </button>

            <button id="btn-close-json" class="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ml-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>

        <!-- JSON Content -->
        <div class="flex-1 overflow-auto bg-gray-50 p-4 font-mono text-xs text-gray-800 leading-relaxed select-text border-b border-gray-200">
          <pre class="language-json"><code>${Prism.highlight(jsonString, Prism.languages.json, 'json')}</code></pre>
        </div>
      </div>
    </div>
  `;
}

// --- EVENT HANDLERS ---

function attachEventHandlers() {
  // Header buttons
  const btnOpen = document.getElementById('btn-open-manifest');
  if (btnOpen) btnOpen.onclick = () => updateState({ isLoaderOpen: true, loadError: null });

  const btnSaveManifest = document.getElementById('btn-save-manifest');
  if (btnSaveManifest) btnSaveManifest.onclick = saveCurrentManifest;

  const btnToggleLayout = document.getElementById('btn-toggle-layout');
  if (btnToggleLayout) {
    btnToggleLayout.onclick = () => {
      updateState({ layoutMode: state.layoutMode === 'sidebar' ? 'bottom' : 'sidebar' });
    };
  }

  const btnOpenEmpty = document.getElementById('btn-open-manifest-empty');
  if (btnOpenEmpty) btnOpenEmpty.onclick = () => updateState({ isLoaderOpen: true, loadError: null });

  const btnViewJson = document.getElementById('btn-view-json');
  if (btnViewJson) btnViewJson.onclick = () => updateState({ isJsonModalOpen: true });

  const btnOpenExport = document.getElementById('btn-open-export');
  if (btnOpenExport) btnOpenExport.onclick = () => updateState({ isExportModalOpen: true });

  const btnCloseExport = document.getElementById('btn-close-export');
  if (btnCloseExport) btnCloseExport.onclick = () => updateState({ isExportModalOpen: false });

  const exportOverlay = document.getElementById('export-modal-overlay');
  if (exportOverlay) {
    exportOverlay.onclick = (e) => {
      if (e.target === exportOverlay) updateState({ isExportModalOpen: false });
    };
  }

  const btnExportManifest = document.getElementById('btn-export-manifest');
  if (btnExportManifest) btnExportManifest.onclick = () => {
    if (state.manifest) downloadJsonFile(exportManifestJsonString(state.manifest), 'manifest.json');
    updateState({ isExportModalOpen: false });
  };

  const btnExportTxtLabel = document.getElementById('btn-export-txt-label');
  if (btnExportTxtLabel) btnExportTxtLabel.onclick = () => handleExportZip('label');

  const btnExportTxtIndex = document.getElementById('btn-export-txt-index');
  if (btnExportTxtIndex) btnExportTxtIndex.onclick = () => handleExportZip('index');

  async function handleExportZip(namingType) {
    if (!state.manifest) return;
    
    const zip = new JSZip();
    const canvases = state.manifest.canvases;
    let addedCount = 0;

    canvases.forEach((canvas, idx) => {
      const transcriptions = canvas.transcriptions || [];
      const text = transcriptions[0]?.text || '';
      
      if (text.trim()) {
        let filename = '';
        if (namingType === 'label') {
          const labelStr = typeof canvas.label === 'string' ? canvas.label : (canvas.label.en ? canvas.label.en.join(' ') : `Page_${idx + 1}`);
          filename = `${labelStr.replace(/[^a-z0-9\Czech\s_-]/gi, '_').trim()}.txt`;
        } else {
          filename = `${String(idx + 1).padStart(3, '0')}.txt`;
        }
        zip.file(filename, text);
        addedCount++;
      }
    });

    if (addedCount === 0) {
      alert('No transcriptions to export.');
      return;
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcriptions_${namingType}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    updateState({ isExportModalOpen: false });
  }

  // Jump to page modal handlers
  const btnJumpToPage = document.getElementById('btn-jump-to-page');
  if (btnJumpToPage) btnJumpToPage.onclick = () => updateState({ isJumpModalOpen: true });

  const btnCloseJump = document.getElementById('btn-close-jump');
  if (btnCloseJump) btnCloseJump.onclick = () => updateState({ isJumpModalOpen: false });

  const btnConfirmJump = document.getElementById('btn-confirm-jump');
  const inputJump = document.getElementById('input-jump-page');
  
  const handleJump = () => {
    const val = parseInt(inputJump.value, 10);
    const total = state.manifest ? state.manifest.canvases.length : 0;
    if (!isNaN(val) && val >= 1 && val <= total) {
      updateState({ activeCanvasIndex: val - 1, isJumpModalOpen: false });
    }
  };

  if (btnConfirmJump) btnConfirmJump.onclick = handleJump;
  if (inputJump) {
    inputJump.onkeydown = (e) => {
      if (e.key === 'Enter') handleJump();
      if (e.key === 'Escape') updateState({ isJumpModalOpen: false });
    };
    if (state.isJumpModalOpen) {
      inputJump.focus();
      inputJump.select();
    }
  }

  // Global key listener for Escape to close modals
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      if (state.isJumpModalOpen) updateState({ isJumpModalOpen: false });
      if (state.isLoaderOpen) updateState({ isLoaderOpen: false });
      if (state.isJsonModalOpen) updateState({ isJsonModalOpen: false });
      if (state.isExportModalOpen) updateState({ isExportModalOpen: false });
    }
  };
  window.onkeydown = handleKeydown;

  const jumpOverlay = document.getElementById('jump-modal-overlay');
  if (jumpOverlay) {
    jumpOverlay.onclick = (e) => {
      if (e.target === jumpOverlay) updateState({ isJumpModalOpen: false });
    };
  }



  // Sidebar search & filters
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  if (btnToggleSidebar) {
    btnToggleSidebar.onclick = () => updateState({ isSidebarCollapsed: !state.isSidebarCollapsed });
  }

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.onclick = () => updateState({ filterType: tab.dataset.filter });
  });

  // Canvas selection & bookmark toggle in sidebar
  document.querySelectorAll('.canvas-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.btn-toggle-bookmark')) return;
      const idx = parseInt(card.dataset.index, 10);
      updateState({ activeCanvasIndex: idx });
    };
  });

  document.querySelectorAll('.btn-toggle-bookmark').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      if (state.manifest && state.manifest.canvases[idx]) {
        state.manifest.canvases[idx].isBookmarked = !state.manifest.canvases[idx].isBookmarked;
        markManifestDirty();
        render();
      }
    };
  });

  // Canvas Viewer controls
  const btnZoomIn = document.getElementById('btn-zoom-in');
  if (btnZoomIn) btnZoomIn.onclick = () => updateState({ scale: Math.min(state.scale + 0.1, 5) });

  const btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomOut) btnZoomOut.onclick = () => updateState({ scale: Math.max(state.scale - 0.1, 0.05) });

  const btnZoomFit = document.getElementById('btn-zoom-fit');
  if (btnZoomFit) btnZoomFit.onclick = () => {
    const stageEl = document.getElementById('canvas-stage');
    const imgEl = document.querySelector('#canvas-transform-wrapper img');
    if (stageEl && imgEl) {
      const stageRect = stageEl.getBoundingClientRect();
      const padding = 40;
      const fitScale = Math.min(
        (stageRect.width - padding) / imgEl.offsetWidth,
        (stageRect.height - padding) / imgEl.offsetHeight
      );
      updateState({ scale: Math.max(Math.min(fitScale, 5), 0.05), pan: { x: 0, y: 0 } });
    } else {
      updateState({ scale: 1, pan: { x: 0, y: 0 } });
    }
  };

  const btnZoom100 = document.getElementById('btn-zoom-100');
  if (btnZoom100) btnZoom100.onclick = () => updateState({ scale: 1, pan: { x: 0, y: 0 } });

  const zoomDisplay = document.getElementById('zoom-display');
  if (zoomDisplay) zoomDisplay.onclick = () => updateState({ isEditingZoom: true });

  const inputZoomValue = document.getElementById('input-zoom-value');
  if (inputZoomValue) {
    inputZoomValue.focus();
    inputZoomValue.select();
    const commitZoom = () => {
      const parsed = parseFloat(inputZoomValue.value);
      const clamped = Number.isFinite(parsed) ? Math.max(Math.min(parsed, 500), 5) : Math.round(state.scale * 100);
      updateState({ scale: clamped / 100, isEditingZoom: false });
    };
    inputZoomValue.onblur = commitZoom;
    inputZoomValue.onkeydown = (e) => {
      if (e.key === 'Enter') commitZoom();
      if (e.key === 'Escape') updateState({ isEditingZoom: false });
    };
  }

  const btnRotate = document.getElementById('btn-rotate');
  if (btnRotate) btnRotate.onclick = () => updateState({ rotation: (state.rotation + 90) % 360 });

  // Transcription font size controls
  const btnFontSizeUp = document.getElementById('btn-font-size-up');
  if (btnFontSizeUp) btnFontSizeUp.onclick = () => {
    const size = Math.min(state.transcriptionFontSize + 1, 32);
    sessionStorage.setItem('transcriptionFontSize', size);
    updateState({ transcriptionFontSize: size });
  };

  const btnFontSizeDown = document.getElementById('btn-font-size-down');
  if (btnFontSizeDown) btnFontSizeDown.onclick = () => {
    const size = Math.max(state.transcriptionFontSize - 1, 10);
    sessionStorage.setItem('transcriptionFontSize', size);
    updateState({ transcriptionFontSize: size });
  };

  // Pan / Drag stage
  const stage = document.getElementById('canvas-stage');
  if (stage) {
    stage.onmousedown = (e) => {
      state.isDragging = true;
      state.dragStart = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
    };
    window.onmousemove = (e) => {
      if (!state.isDragging) return;
      state.pan = { x: e.clientX - state.dragStart.x, y: e.clientY - state.dragStart.y };
      const wrapper = document.getElementById('canvas-transform-wrapper');
      if (wrapper) {
        wrapper.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.scale}) rotate(${state.rotation}deg)`;
      }
    };
    window.onmouseup = () => { state.isDragging = false; };

    stage.onwheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      const newScale = Math.max(Math.min(state.scale * zoomFactor, 5), 0.05);
      updateState({ scale: newScale });
    };
  }

  // Transcription editor controls
  const activeCanvas = state.manifest && state.manifest.canvases ? state.manifest.canvases[state.activeCanvasIndex] : null;

  const btnToggleBookmarkActive = document.getElementById('btn-toggle-bookmark-active');
  if (btnToggleBookmarkActive && activeCanvas) {
    btnToggleBookmarkActive.onclick = () => {
      activeCanvas.isBookmarked = !activeCanvas.isBookmarked;
      markManifestDirty();
      render();
    };
  }

  const textareaTranscription = document.getElementById('textarea-transcription');
  if (textareaTranscription && activeCanvas) {
    // Initial update
    updateLineNumbers(textareaTranscription);

    textareaTranscription.oninput = (e) => {
      const val = e.target.value;
      if (!activeCanvas.transcriptions) activeCanvas.transcriptions = [];
      if (activeCanvas.transcriptions.length === 0) {
        activeCanvas.transcriptions.push({ id: `${activeCanvas.id}/transcription/1`, text: val, language: 'en', format: 'text/plain' });
      } else {
        activeCanvas.transcriptions[0].text = val;
      }
      markManifestDirty();
      updateLineNumbers(textareaTranscription);
    };

    textareaTranscription.onscroll = () => {
      updateLineNumbers(textareaTranscription);
    };
  }

  // Tab switching
  document.querySelectorAll('.editor-tab').forEach(tab => {
    tab.onclick = () => updateState({ editorTab: tab.dataset.tab });
  });

  const textareaNote = document.getElementById('textarea-note');
  if (textareaNote && activeCanvas) {
    textareaNote.oninput = (e) => {
      const val = e.target.value;
      activeCanvas.note = val;
      markManifestDirty();
    };
  }







  // Loader Modal handlers
  const btnCloseLoader = document.getElementById('btn-close-loader');
  if (btnCloseLoader) btnCloseLoader.onclick = () => updateState({ isLoaderOpen: false });

  document.querySelectorAll('.loader-tab').forEach(tab => {
    tab.onclick = () => updateState({ loaderTab: tab.dataset.tab, loadError: null });
  });

  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) handleFileLoad(file);
    };
  }

  const btnPickFile = document.getElementById('btn-pick-file');
  if (btnPickFile) btnPickFile.onclick = pickLocalManifest;

  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('border-gray-900', 'bg-gray-100'); };
    dropzone.ondragleave = () => { dropzone.classList.remove('border-gray-900', 'bg-gray-100'); };
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-gray-900', 'bg-gray-100');
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFileLoad(file);
    };
  }

  const btnFetchUrl = document.getElementById('btn-fetch-url');
  if (btnFetchUrl) {
    btnFetchUrl.onclick = () => {
      const urlInput = document.getElementById('input-url');
      const corsCheckbox = document.getElementById('checkbox-cors');
      if (urlInput) {
        loadManifestFromUrl(urlInput.value, corsCheckbox ? corsCheckbox.checked : true);
      }
    };
  }

  document.querySelectorAll('.btn-sample').forEach(btn => {
    btn.onclick = () => {
      loadManifestFromUrl(btn.dataset.url, true);
    };
  });

  // JSON Modal handlers
  const btnCloseJson = document.getElementById('btn-close-json');
  if (btnCloseJson) btnCloseJson.onclick = () => updateState({ isJsonModalOpen: false });

  document.querySelectorAll('.json-tab').forEach(tab => {
    tab.onclick = () => updateState({ jsonTab: tab.dataset.tab });
  });

  const btnDownloadJsonModal = document.getElementById('btn-download-json-modal');
  if (btnDownloadJsonModal) btnDownloadJsonModal.onclick = () => {
    if (state.jsonTab === 'full') {
      downloadJsonFile(exportManifestJsonString(state.manifest), 'manifest.json');
    } else {
      const activeCanvas = state.manifest.canvases[state.activeCanvasIndex];
      const blob = new Blob([JSON.stringify(activeCanvas.rawCanvas || activeCanvas, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `canvas-${state.activeCanvasIndex + 1}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
}

// --- FILE & URL LOADING HELPERS ---

function updateLineNumbers(textarea) {
  const gutter = document.getElementById('transcription-line-numbers');
  if (!textarea || !gutter) return;
  const lines = textarea.value.split('\n');
  const count = lines.length;
  let html = '';
  for (let i = 1; i <= count; i++) {
    html += `<div>${i}</div>`;
  }
  gutter.innerHTML = html;
  gutter.scrollTop = textarea.scrollTop;
}

async function pickLocalManifest() {
  if (!window.showOpenFilePicker) {
    document.getElementById('file-input')?.click();
    return;
  }

  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [{ description: 'IIIF manifest', accept: { 'application/json': ['.json'] } }],
      multiple: false,
      mode: 'readwrite'
    });
    connectedFileHandle = fileHandle;
    await loadManifestFile(await fileHandle.getFile(), fileHandle);
  } catch (err) {
    if (err.name !== 'AbortError') updateState({ loadError: `Failed to open manifest: ${err.message}` });
  }
}

function handleFileLoad(file) {
  loadManifestFile(file, null);
}

async function loadManifestFile(file, fileHandle) {
  try {
    const json = JSON.parse(await file.text());
    const parsed = parseIIIFManifest(json, file.name);
    connectedFileHandle = fileHandle;
    updateState({
      manifest: parsed,
      fileHandle,
      fileName: file.name,
      isDirty: false,
      saveStatus: '',
      isLoaderOpen: false,
      activeCanvasIndex: 0,
      loadError: null
    });
  } catch (err) {
    updateState({ loadError: `Error parsing manifest file: ${err.message}` });
  }
}

async function saveManifestToFile() {
  const fileHandle = connectedFileHandle || state.fileHandle;
  if (!state.manifest || !fileHandle) return;

  try {
    const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      throw new Error('Write permission was not granted for this file.');
    }
    state.saveStatus = 'Saving...';
    render();
    const writable = await fileHandle.createWritable();
    await writable.write(exportManifestJsonString(state.manifest));
    await writable.close();
    updateState({ isDirty: false, saveStatus: '' });
  } catch (err) {
    updateState({ saveStatus: `Save failed: ${err.message}` });
  }
}

async function saveCurrentManifest() {
  if (connectedFileHandle || state.fileHandle) {
    await saveManifestToFile();
  } else {
    await saveManifestAsLocalCopy();
  }
}

async function saveManifestAsLocalCopy() {
  if (!state.manifest) return false;
  if (!window.showSaveFilePicker) {
    downloadJsonFile(exportManifestJsonString(state.manifest), state.fileName || 'manifest.json');
    updateState({ saveStatus: 'Downloaded local copy', isDirty: false });
    return false;
  }

  try {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: state.fileName || 'manifest.json',
      types: [{ description: 'IIIF manifest', accept: { 'application/json': ['.json'] } }]
    });
    state.fileHandle = fileHandle;
    connectedFileHandle = fileHandle;
    state.fileName = fileHandle.name;
    await saveManifestToFile();
    return true;
  } catch (err) {
    if (err.name !== 'AbortError') updateState({ saveStatus: `Save failed: ${err.message}` });
    return false;
  }
}

async function loadManifestFromUrl(url, useProxy) {
  if (!url || !url.trim()) {
    updateState({ loadError: 'Please enter a valid IIIF manifest URL.' });
    return;
  }
  updateState({ isLoadingUrl: true, loadError: null, urlInput: url });

  let fetchUrl = url.trim();
  try {
    let response;
    try {
      response = await fetch(fetchUrl, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    } catch (directErr) {
      if (useProxy) {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(fetchUrl)}`;
        response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Proxy error ${response.status}`);
      } else {
        throw directErr;
      }
    }

    const json = await response.json();
    const parsed = parseIIIFManifest(json, fetchUrl);
    connectedFileHandle = null;
    updateState({ manifest: parsed, fileHandle: null, fileName: 'manifest.json', isDirty: true, saveStatus: 'Save a local copy to continue', isLoaderOpen: false, activeCanvasIndex: 0, isLoadingUrl: false, loadError: null });
  } catch (err) {
    updateState({ isLoadingUrl: false, loadError: `Failed to load manifest: ${err.message}. Try enabling CORS proxy.` });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Boot
window.addEventListener('DOMContentLoaded', initApp);
