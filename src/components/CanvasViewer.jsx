import React, { useState, useRef, useEffect } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCw, 
  Layers, 
  Upload, 
  FileText, 
  Globe, 
  AlertCircle 
} from 'lucide-react';
import { parseIIIFManifest } from '../lib/iiifParser.js';

export default function CanvasViewer({
  canvas,
  onLoadManifest
}) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Transform: zoom, pan, rotation
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Drag and drop file to empty stage
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  // Dimensions
  const naturalWidth = canvas?.width || 1200;
  const naturalHeight = canvas?.height || 1600;

  // Reset position when canvas changes
  useEffect(() => {
    fitToContainer();
  }, [canvas?.id]);

  const fitToContainer = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const scaleX = (clientWidth - 40) / naturalWidth;
    const scaleY = (clientHeight - 40) / naturalHeight;
    const initialScale = Math.min(scaleX, scaleY, 1);

    setScale(Math.max(0.1, initialScale));
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleZoom = (delta) => {
    setScale((prev) => Math.min(Math.max(prev + delta, 0.1), 5));
  };

  const handleZoom100 = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale((prev) => Math.min(Math.max(prev * zoomFactor, 0.1), 5));
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleFileDropOrPick = (file) => {
    if (!file) return;
    setLoadError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const json = JSON.parse(text);
        const parsed = parseIIIFManifest(json, file.name);
        if (onLoadManifest) {
          onLoadManifest(parsed);
        }
      } catch (err) {
        setLoadError(`Error reading file: ${err.message}`);
      }
    };
    reader.onerror = () => {
      setLoadError('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    setLoadError('');
    setIsLoadingUrl(true);

    try {
      let resp;
      try {
        resp = await fetch(url, { mode: 'cors' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      } catch {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        resp = await fetch(proxyUrl);
        if (!resp.ok) throw new Error(`Proxy error: ${resp.status}`);
      }
      const json = await resp.json();
      const parsed = parseIIIFManifest(json, url);
      if (onLoadManifest) {
        onLoadManifest(parsed);
      }
    } catch (err) {
      setLoadError(`Failed to download manifest: ${err.message}`);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // EMPTY STATE: WHEN NO MANIFEST IS LOADED
  if (!canvas) {
    return (
      <div 
        id="empty-canvas-stage"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileDropOrPick(e.dataTransfer.files[0]);
          }
        }}
        className="flex-1 bg-white flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto"
      >
        <div className="max-w-xl w-full p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-800 mb-5 shadow-2xs">
            <Upload className="w-8 h-8 text-gray-700" />
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Open IIIF Document (manifest.json)
          </h2>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed max-w-md mx-auto">
            Load your local <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 font-mono font-semibold">manifest.json</code> file directly from your computer or enter a remote IIIF manifest URL.
          </p>

          {loadError && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{loadError}</span>
            </div>
          )}

          {/* Drag and drop box */}
          <div className={`p-8 border-2 border-dashed rounded-xl transition-all ${
            dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
          }`}>
            <p className="text-xs text-gray-600 mb-4 font-medium">
              Drag and drop manifest.json file from your computer here
            </p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs">
              <FileText className="w-4 h-4" />
              <span>Select manifest.json from disk</span>
              <input
                id="file-input-canvas"
                type="file"
                accept=".json,.jsonld,application/json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileDropOrPick(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] text-gray-400 uppercase font-medium">or enter URL</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Load from URL */}
          <form onSubmit={handleUrlSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="url-input-canvas"
                type="url"
                placeholder="https://example.org/iiif/manifest.json"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-gray-900"
              />
            </div>
            <button
              id="btn-load-url-canvas"
              type="submit"
              disabled={!urlInput.trim() || isLoadingUrl}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isLoadingUrl ? 'Loading...' : 'Load URL'}
            </button>
          </form>

          <p className="text-[11px] text-gray-400 mt-5">
            Supports IIIF Presentation API 2.0, 2.1, and 3.0 specifications with text layers and W3C Web Annotation notes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      id="canvas-viewer-stage"
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`relative flex-1 bg-white overflow-hidden flex items-center justify-center select-none border-r border-gray-200 ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 p-1.5 rounded-lg bg-white border border-gray-200 shadow-md text-gray-700">
        <button
          id="btn-zoom-in"
          onClick={() => handleZoom(0.2)}
          className="p-1.5 rounded hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
          title="Zoom in (+)"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          id="btn-zoom-out"
          onClick={() => handleZoom(-0.2)}
          className="p-1.5 rounded hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
          title="Zoom out (-)"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          id="btn-zoom-fit"
          onClick={fitToContainer}
          className="p-1.5 rounded hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
          title="Fit to window"
          aria-label="Fit to window"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          id="btn-zoom-100"
          onClick={handleZoom100}
          className="px-2 py-1 text-xs font-mono rounded hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer font-medium"
          title="Original size 1:1"
          aria-label="Original size 1:1"
        >
          1:1
        </button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button
          id="btn-rotate"
          onClick={handleRotate}
          className="p-1.5 rounded hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
          title="Rotate 90°"
          aria-label="Rotate 90 degrees"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Manuscript Canvas Stage */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale}) rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : 'transform 0.1s ease-out'
        }}
        className="relative shadow-lg"
      >
        {canvas?.imageUrl ? (
          <div className="relative inline-block">
            <img
              ref={imgRef}
              src={canvas.imageUrl}
              alt={canvas.label}
              draggable={false}
              style={{
                width: `${naturalWidth}px`,
                height: `${naturalHeight}px`,
                maxWidth: 'none'
              }}
              className="block rounded bg-white border border-gray-300 pointer-events-none select-none"
            />
          </div>
        ) : (
          <div className="w-[800px] h-[1000px] bg-white border border-gray-300 rounded flex flex-col items-center justify-center text-gray-500 gap-3">
            <Layers className="w-12 h-12 text-gray-300" />
            <p className="text-sm">No image available for this canvas</p>
          </div>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-mono shadow-sm">
        <span>Zoom: {Math.round(scale * 100)}%</span>
        <span className="text-gray-300">|</span>
        <span>
          {naturalWidth} × {naturalHeight} px
        </span>
      </div>
    </div>
  );
}
