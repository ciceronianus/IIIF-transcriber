import React, { useState } from 'react';
import Header from './components/Header.jsx';
import SidebarThumbnails from './components/SidebarThumbnails.jsx';
import CanvasViewer from './components/CanvasViewer.jsx';
import TranscriptionEditor from './components/TranscriptionEditor.jsx';
import ManifestLoaderModal from './components/ManifestLoaderModal.jsx';
import JsonPreviewModal from './components/JsonPreviewModal.jsx';
import { downloadManifestJson } from './lib/manifestExporter.js';

export default function App() {
  // Application State: starts empty (no default sample IIIF is displayed)
  const [manifestState, setManifestState] = useState(null);
  const [selectedCanvasIndex, setSelectedCanvasIndex] = useState(0);

  // Modals state
  const [isLoaderOpen, setIsLoaderOpen] = useState(false);
  const [isJsonOpen, setIsJsonOpen] = useState(false);

  // Safe selected canvas
  const currentCanvas =
    manifestState?.canvases && manifestState.canvases[selectedCanvasIndex]
      ? manifestState.canvases[selectedCanvasIndex]
      : manifestState?.canvases?.[0] || null;

  // Handler: Select a canvas
  const handleSelectCanvas = (index) => {
    setSelectedCanvasIndex(index);
  };

  // Handler: Toggle bookmark for a canvas
  const handleToggleBookmark = (canvasIdOrIndex) => {
    setManifestState((prev) => {
      if (!prev || !prev.canvases) return prev;
      const updatedCanvases = prev.canvases.map((c, i) => {
        if (c.id === canvasIdOrIndex || i === canvasIdOrIndex) {
          return { ...c, isBookmarked: !c.isBookmarked };
        }
        return c;
      });
      return { ...prev, canvases: updatedCanvases };
    });
  };

  // Handler: Update canvas properties (transcriptions, note, noteLanguage)
  const handleUpdateCanvasData = (canvasId, updatedFields) => {
    setManifestState((prev) => {
      if (!prev || !prev.canvases) return prev;
      const updatedCanvases = prev.canvases.map((c) => {
        if (c.id === canvasId) {
          return { ...c, ...updatedFields };
        }
        return c;
      });
      return { ...prev, canvases: updatedCanvases };
    });
  };

  // Handler: Load new manifest from loader modal or drag-and-drop
  const handleLoadManifest = (newManifest) => {
    setManifestState(newManifest);
    setSelectedCanvasIndex(0);
  };

  // Handler: Save / Download manifest.json
  const handleDownload = () => {
    if (!manifestState) return;
    downloadManifestJson(manifestState, 'manifest.json');
  };

  // Statistics
  const totalCanvases = manifestState?.canvases?.length || 0;
  const withTextCount =
    manifestState?.canvases?.filter(
      (c) => (c.transcriptions && c.transcriptions.some((t) => t.text?.trim())) || (c.note && c.note.trim())
    ).length || 0;
  const bookmarkedCount =
    manifestState?.canvases?.filter((c) => c.isBookmarked).length || 0;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white font-sans text-gray-900">
      {/* Top Application Bar */}
      <Header
        manifest={manifestState}
        onOpenLoader={() => setIsLoaderOpen(true)}
        onOpenJson={() => setIsJsonOpen(true)}
        onDownload={handleDownload}
        stats={{ totalCanvases, withTextCount, bookmarkedCount }}
      />

      {/* Main Workspace */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {manifestState ? (
          <>
            {/* Left: Canvases list with text-layer filters and bookmarks */}
            <SidebarThumbnails
              canvases={manifestState.canvases || []}
              selectedCanvasIndex={selectedCanvasIndex}
              onSelectCanvas={handleSelectCanvas}
              onToggleBookmark={handleToggleBookmark}
            />

            {/* Center: Canvas Image Pan/Zoom Viewer */}
            <CanvasViewer
              canvas={currentCanvas}
              onLoadManifest={handleLoadManifest}
            />

            {/* Right: Transcription & General Page Note Editor */}
            <TranscriptionEditor
              canvas={currentCanvas}
              onUpdateCanvasData={handleUpdateCanvasData}
              onToggleBookmark={handleToggleBookmark}
            />
          </>
        ) : (
          /* Empty State when no manifest is loaded */
          <CanvasViewer
            canvas={null}
            onLoadManifest={handleLoadManifest}
          />
        )}
      </main>

      {/* Modals */}
      <ManifestLoaderModal
        isOpen={isLoaderOpen}
        onClose={() => setIsLoaderOpen(false)}
        onLoadManifest={handleLoadManifest}
      />

      <JsonPreviewModal
        isOpen={isJsonOpen}
        onClose={() => setIsJsonOpen(false)}
        state={manifestState}
      />
    </div>
  );
}
