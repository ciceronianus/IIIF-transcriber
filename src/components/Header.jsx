import React from 'react';
import { 
  Download, 
  Code, 
  FolderOpen, 
  Layers
} from 'lucide-react';

export default function Header({ 
  manifest, 
  onOpenLoader, 
  onOpenJson, 
  onDownload
}) {
  return (
    <header className="bg-white text-gray-900 border-b border-gray-200 shrink-0 select-none shadow-xs">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Left: Logo and Manifest Name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-900 shrink-0 font-bold">
            <Layers className="w-4 h-4 text-gray-800" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-gray-900">
                IIIF Document Transcriber
              </h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-gray-100 text-gray-700 border border-gray-200">
                IIIF 3.0
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate max-w-md">
              {manifest?.label || 'No manifest loaded'}
            </p>
          </div>
        </div>

        {/* Right: Primary Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-open-manifest"
            onClick={onOpenLoader}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 hover:border-gray-400 transition-colors shadow-xs cursor-pointer"
            title="Open IIIF manifest from disk or URL"
          >
            <FolderOpen className="w-4 h-4 text-gray-600" />
            <span>Open Manifest</span>
          </button>

          {manifest && (
            <>
              <button
                id="btn-view-json"
                onClick={onOpenJson}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer"
                title="View manifest.json"
              >
                <Code className="w-4 h-4 text-gray-600" />
                <span className="hidden sm:inline">JSON</span>
              </button>

              <button
                id="btn-download-manifest"
                onClick={onDownload}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-gray-900 hover:bg-gray-800 text-white transition-colors shadow-xs cursor-pointer"
                title="Save manifest.json with all transcriptions, notes, and bookmarks"
              >
                <Download className="w-4 h-4" />
                <span>Save manifest.json</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
