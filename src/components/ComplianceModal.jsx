import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  FileCode, 
  Ban
} from 'lucide-react';
import { validateIIIFCompliance, checkIIIFProposal } from '../lib/iiifValidator.js';
import { buildIIIFManifest } from '../lib/manifestExporter.js';

export default function ComplianceModal({ isOpen, onClose, state }) {
  const [testFeatureKey, setTestFeatureKey] = useState('');
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const manifestObj = buildIIIFManifest(state);
  const audit = validateIIIFCompliance(manifestObj);

  const handleTestFeature = (e) => {
    e.preventDefault();
    if (!testFeatureKey.trim()) return;
    const res = checkIIIFProposal(testFeatureKey.trim().toLowerCase());
    setTestResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                IIIF Presentation 3.0 Compliance Audit
              </h2>
              <p className="text-xs text-gray-500">
                Structure validation according to IIIF and W3C Web Annotation standards
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-gray-800 text-xs bg-white">
          {/* Audit Summary */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 ${
              audit.valid
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                : 'bg-red-50/70 border-red-300 text-red-900'
            }`}
          >
            {audit.valid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-sm">
                {audit.valid ? 'Valid IIIF Presentation 3.0 Document' : 'Validation Issues Detected'}
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                {audit.valid
                  ? 'All canvases, annotations, motivations, and media fragments conform to the official IIIF specification.'
                  : 'The current manifest contains elements that deviate from standard specifications.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-white border border-gray-300 text-gray-800">
                  Canvases: {audit.stats.canvasCount}
                </span>
                <span className="px-2 py-0.5 rounded bg-white border border-emerald-300 text-emerald-800">
                  Transcriptions (supplementing): {audit.stats.transcriptionCount}
                </span>
                <span className="px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-800">
                  Bookmarks (bookmarking): {audit.stats.bookmarkCount}
                </span>
                <span className="px-2 py-0.5 rounded bg-white border border-blue-300 text-blue-800">
                  Regions of Interest (#xywh): {audit.stats.roiCount}
                </span>
              </div>
            </div>
          </div>

          {/* Errors and Warnings */}
          {audit.errors.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-lg bg-red-50 border border-red-200">
              <h4 className="font-semibold text-red-700 flex items-center gap-1.5">
                <Ban className="w-4 h-4" />
                <span>Critical Errors:</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-red-600 pl-1">
                {audit.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {audit.warnings.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <h4 className="font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Recommendations:</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-amber-700 pl-1">
                {audit.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Standards Mapping Overview */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-gray-700" />
              <span>Mapping of App Features to IIIF Standards:</span>
            </h4>

            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">Manual Text Transcription</span>
                  <span className="font-mono text-[10px] text-emerald-700 font-semibold">motivation: "supplementing"</span>
                </div>
                <p className="text-[11px] text-gray-600">
                  Transcribed text is stored in an <code className="bg-white px-1 py-0.5 rounded border text-gray-800 font-mono">AnnotationPage</code> as a <code className="bg-white px-1 py-0.5 rounded border text-gray-800 font-mono">TextualBody</code> following the W3C Web Annotation data model.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">Regions of Interest (ROI)</span>
                  <span className="font-mono text-[10px] text-blue-700 font-semibold">#xywh=x,y,w,h</span>
                </div>
                <p className="text-[11px] text-gray-600">
                  Specific transcription lines reference spatial coordinates using the W3C Media Fragments URI 1.0 specification (<code className="bg-white px-1 py-0.5 rounded border text-gray-800 font-mono">target: canvas.id#xywh=...</code>).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">Bookmarking</span>
                  <span className="font-mono text-[10px] text-amber-700 font-semibold">motivation: "bookmarking" & Range</span>
                </div>
                <p className="text-[11px] text-gray-600">
                  Bookmarked canvases are persisted as W3C annotations with <code className="bg-white px-1 py-0.5 rounded border text-gray-800 font-mono">motivation: "bookmarking"</code> as well as grouped in an IIIF <code className="bg-white px-1 py-0.5 rounded border text-gray-800 font-mono">Range</code>.
                </p>
              </div>
            </div>
          </div>

          {/* Proposal Feature Validator */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
            <div>
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <Ban className="w-4 h-4 text-gray-700" />
                <span>Feature Compatibility Checker</span>
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Check whether any proposed feature complies with IIIF specifications:
              </p>
            </div>

            <form onSubmit={handleTestFeature} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. bookmarking, transcription_region, custom_prop..."
                value={testFeatureKey}
                onChange={(e) => setTestFeatureKey(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-md bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-gray-900 font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-gray-900 hover:bg-gray-800 text-white transition-colors cursor-pointer"
              >
                Validate
              </button>
            </form>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                  testResult.allowed
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-red-50 border-red-300 text-red-800'
                }`}
              >
                {testResult.allowed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Ban className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-end">
          <button
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
