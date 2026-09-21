import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  Code, 
  CheckCircle2 
} from 'lucide-react';
import { exportManifestJsonString, downloadManifestJson } from '../lib/manifestExporter.js';

export default function JsonPreviewModal({ isOpen, onClose, state }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !state) return null;

  const jsonString = exportManifestJsonString(state);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadManifestJson(state, 'manifest.json');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <Code className="w-5 h-5 text-gray-700" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span>manifest.json</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 border border-gray-200 font-mono">
                  IIIF Presentation 3.0
                </span>
              </h2>
              <p className="text-[11px] text-gray-500">
                Generated strictly according to IIIF Presentation 3.0 and W3C Web Annotation specifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-copy-json"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>

            <button
              id="btn-download-json-modal"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-gray-900 hover:bg-gray-800 text-white transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download manifest.json</span>
            </button>

            <button
              id="btn-close-json-modal"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ml-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* JSON Content */}
        <div className="flex-1 overflow-auto bg-gray-50 p-4 font-mono text-xs text-gray-800 leading-relaxed select-text border-b border-gray-200">
          <pre className="whitespace-pre">{jsonString}</pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-white flex items-center justify-between text-[11px] text-gray-500 shrink-0">
          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ready for GitHub Pages, Mirador 3, Universal Viewer, and digital repositories</span>
          </div>
          <span className="font-mono">Size: {(new Blob([jsonString]).size / 1024).toFixed(1)} KB</span>
        </div>
      </div>
    </div>
  );
}
