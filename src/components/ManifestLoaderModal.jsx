import React, { useState } from 'react';
import { 
  X, 
  Globe, 
  Upload, 
  AlertCircle, 
  Loader2, 
  FileText,
  HardDrive
} from 'lucide-react';
import { parseIIIFManifest } from '../lib/iiifParser.js';

export default function ManifestLoaderModal({ isOpen, onClose, onLoadManifest }) {
  const [activeTab, setActiveTab] = useState('file'); // Default: from disk
  const [urlInput, setUrlInput] = useState('');
  const [useCorsProxy, setUseCorsProxy] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleLoadUrl = async (urlToFetch = urlInput) => {
    const targetUrl = urlToFetch.trim();
    if (!targetUrl) {
      setErrorMessage('Please enter a valid IIIF manifest URL.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      let response;

      // Direct fetch attempt
      try {
        response = await fetch(targetUrl, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      } catch (directErr) {
        if (useCorsProxy) {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
          response = await fetch(proxyUrl);
          if (!response.ok) throw new Error(`Proxy error with status ${response.status}`);
        } else {
          throw directErr;
        }
      }

      const json = await response.json();
      const parsed = parseIIIFManifest(json, targetUrl);
      onLoadManifest(parsed);
      onClose();
    } catch (err) {
      console.error('Error loading manifest:', err);
      setErrorMessage(
        `Failed to load manifest: ${err.message}. If the remote server restricts browser access (CORS), keep the "Use CORS proxy" option enabled.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    setIsLoading(true);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const json = JSON.parse(text);
        const parsed = parseIIIFManifest(json, file.name);
        onLoadManifest(parsed);
        setIsLoading(false);
        onClose();
      } catch (err) {
        setIsLoading(false);
        setErrorMessage(`Invalid manifest file: ${err.message}`);
      }
    };
    reader.onerror = () => {
      setIsLoading(false);
      setErrorMessage('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Open IIIF Manifest
              </h2>
              <p className="text-xs text-gray-500">
                Load a manifest.json file from your computer or from a remote URL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-200 bg-white px-6 pt-2">
          <button
            id="tab-load-file"
            onClick={() => { setActiveTab('file'); setErrorMessage(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === 'file'
                ? 'border-gray-900 text-gray-900 bg-white font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Upload className="w-4 h-4 text-gray-600" />
            <span>From computer / disk</span>
          </button>

          <button
            id="tab-load-url"
            onClick={() => { setActiveTab('url'); setErrorMessage(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === 'url'
                ? 'border-gray-900 text-gray-900 bg-white font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Globe className="w-4 h-4 text-gray-600" />
            <span>From URL address</span>
          </button>
        </div>

        {/* Active tab content */}
        <div className="p-6 overflow-y-auto flex-1 text-gray-800 bg-white">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* TAB 1: FILE FROM COMPUTER */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragOver
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
                }`}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 mb-3 shadow-2xs">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Drag and drop <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 text-xs font-mono font-bold">manifest.json</code> file here
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Open any valid IIIF Presentation 2.x or 3.0 manifest from your storage
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium cursor-pointer transition-colors shadow-xs">
                  <FileText className="w-4 h-4" />
                  <span>Select file from disk</span>
                  <input
                    id="file-input-modal"
                    type="file"
                    accept=".json,.jsonld,application/json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="text-[11px] text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="font-medium text-gray-700">Supported formats:</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                  <li>IIIF Presentation API 3.0 manifest.json</li>
                  <li>IIIF Presentation API 2.0 / 2.1 manifest.json (automatically converted to v3)</li>
                  <li>Saved sessions from previous transcription work</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: URL ADDRESS */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="input-modal-manifest-url" className="block text-xs font-medium text-gray-700 mb-1.5">
                  IIIF manifest URL address
                </label>
                <div className="flex gap-2">
                  <input
                    id="input-modal-manifest-url"
                    type="url"
                    placeholder="https://example.org/iiif/manifest.json"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLoadUrl();
                    }}
                    className="flex-1 px-3 py-2 text-xs rounded-lg bg-white border border-gray-300 focus:outline-hidden focus:ring-1 focus:ring-gray-900 text-gray-900 placeholder:text-gray-400"
                  />
                  <button
                    id="btn-modal-load-url"
                    disabled={isLoading || !urlInput.trim()}
                    onClick={() => handleLoadUrl()}
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Load</span>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-gray-900">Use CORS proxy</span>
                  <span className="text-[11px] text-gray-500">
                    Bypasses browser CORS restrictions if the remote server does not send cross-origin headers
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCorsProxy}
                    onChange={(e) => setUseCorsProxy(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gray-900"></div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-end">
          <button
            id="btn-close-loader-modal"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
