/**
 * IIIF Manifest Exporter Module (Pure JavaScript)
 * Generates valid IIIF Presentation API 3.0 Manifests according to standard specifications.
 * Ensures transcriptions are modeled as W3C Web Annotations with motivation "supplementing"
 * and bookmarks are modeled with motivation "bookmarking" & IIIF Range structures.
 */

/**
 * Builds a valid IIIF Presentation 3.0 manifest object from the application state.
 */
export function buildIIIFManifest(state) {
  const { id, label, description, canvases, rawManifest } = state;
  const manifestId = id || `https://example.org/iiif/manifest-${Date.now()}`;

  // Keep existing manifest metadata if present
  const baseManifest = rawManifest && typeof rawManifest === 'object' ? { ...rawManifest } : {};

  // Clean up legacy v2 top-level fields if migrating to v3
  delete baseManifest.sequences;
  delete baseManifest['@id'];
  delete baseManifest['@type'];

  // Ensure standard IIIF v3 context
  const context = 'http://iiif.io/api/presentation/3/context.json';

  // Format manifest label according to IIIF v3
  const manifestLabel = typeof label === 'object' && label.en ? label : { en: [label || 'Untitled IIIF Document'] };
  const manifestSummary = description ? (typeof description === 'object' ? description : { en: [description] }) : undefined;

  const bookmarkedCanvasIds = [];

  // Generate Canvases
  const items = canvases.map((canvas, index) => {
    const canvasId = canvas.id || `${manifestId}/canvas/p${index + 1}`;
    const canvasLabel = typeof canvas.label === 'object' ? canvas.label : { en: [canvas.label || `Page ${index + 1}`] };

    // Preserve existing painting annotations or reconstruct standard painting annotation
    let paintingItems = [];
    if (canvas.rawCanvas?.items && Array.isArray(canvas.rawCanvas.items)) {
      paintingItems = canvas.rawCanvas.items;
    } else {
      paintingItems = [
        {
          id: `${canvasId}/page/painting`,
          type: 'AnnotationPage',
          items: [
            {
              id: `${canvasId}/annotation/painting`,
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: canvas.imageUrl || '',
                type: 'Image',
                format: 'image/jpeg',
                width: canvas.width,
                height: canvas.height
              },
              target: canvasId
            }
          ]
        }
      ];
    }

    // Build annotations array (transcriptions and bookmarks)
    const annotationItems = [];

    // 1. Textual Transcriptions (motivation: "supplementing")
    if (canvas.transcriptions && canvas.transcriptions.length > 0) {
      canvas.transcriptions.forEach((t, tIdx) => {
        if (!t.text || !t.text.trim()) return;

        let target = canvasId;
        if (t.targetRegion && typeof t.targetRegion === 'object') {
          const rx = Math.round(t.targetRegion.x);
          const ry = Math.round(t.targetRegion.y);
          const rw = Math.round(t.targetRegion.w);
          const rh = Math.round(t.targetRegion.h);
          if (rw > 0 && rh > 0) {
            target = `${canvasId}#xywh=${rx},${ry},${rw},${rh}`;
          }
        }

        annotationItems.push({
          id: t.id || `${canvasId}/annotation/transcription-${tIdx + 1}`,
          type: 'Annotation',
          motivation: 'supplementing',
          body: {
            type: 'TextualBody',
            value: t.text,
            format: t.format || 'text/plain',
            language: t.language || 'en'
          },
          target: target
        });
      });
    }

    // 2. General Page Note (motivation: "commenting" according to W3C Web Annotation & IIIF Presentation 3.0)
    if (canvas.note && canvas.note.trim()) {
      annotationItems.push({
        id: `${canvasId}/annotation/note`,
        type: 'Annotation',
        motivation: 'commenting',
        body: {
          type: 'TextualBody',
          value: canvas.note.trim(),
          format: 'text/plain',
          language: canvas.noteLanguage || 'en'
        },
        target: canvasId
      });
    }

    // 3. Bookmark annotation (motivation: "bookmarking" according to W3C Web Annotation spec)
    if (canvas.isBookmarked) {
      bookmarkedCanvasIds.push(canvasId);
      annotationItems.push({
        id: `${canvasId}/annotation/bookmark`,
        type: 'Annotation',
        motivation: 'bookmarking',
        body: {
          type: 'TextualBody',
          value: 'Page bookmarked',
          format: 'text/plain'
        },
        target: canvasId
      });
    }

    // Assemble Canvas object
    const canvasObj = {
      id: canvasId,
      type: 'Canvas',
      label: canvasLabel,
      width: canvas.width,
      height: canvas.height,
      items: paintingItems
    };

    // Attach summary if page note exists (standard IIIF Presentation 3.0 canvas summary)
    if (canvas.note && canvas.note.trim()) {
      const noteLang = canvas.noteLanguage || 'en';
      canvasObj.summary = { [noteLang]: [canvas.note.trim()] };
    }

    // If there are annotations (transcriptions or bookmarks), attach AnnotationPage
    if (annotationItems.length > 0) {
      canvasObj.annotations = [
        {
          id: `${canvasId}/annotations/page-1`,
          type: 'AnnotationPage',
          items: annotationItems
        }
      ];
    }

    return canvasObj;
  });

  // Structures for Ranges (e.g. Bookmark collection)
  const structures = [];
  if (baseManifest.structures && Array.isArray(baseManifest.structures)) {
    // Preserve other ranges, but update bookmarks range
    baseManifest.structures.forEach(range => {
      const rangeLabel = range.label?.en ? range.label.en[0] : '';
      if (!rangeLabel.toLowerCase().includes('bookmark')) {
        structures.push(range);
      }
    });
  }

  if (bookmarkedCanvasIds.length > 0) {
    structures.push({
      id: `${manifestId}/range/bookmarks`,
      type: 'Range',
      label: { en: ['Bookmarked Pages'] },
      behavior: ['bookmarks'],
      items: bookmarkedCanvasIds.map(cid => ({
        id: cid,
        type: 'Canvas'
      }))
    });
  }

  const result = {
    '@context': context,
    id: manifestId,
    type: 'Manifest',
    label: manifestLabel,
    items: items
  };

  if (manifestSummary) {
    result.summary = manifestSummary;
  }

  if (structures.length > 0) {
    result.structures = structures;
  }

  // Preserve any top-level metadata or provider fields from original if present
  if (baseManifest.metadata) result.metadata = baseManifest.metadata;
  if (baseManifest.provider) result.provider = baseManifest.provider;
  if (baseManifest.rights) result.rights = baseManifest.rights;
  if (baseManifest.requiredStatement) result.requiredStatement = baseManifest.requiredStatement;

  return result;
}

/**
 * Serializes the manifest into a formatted JSON string.
 */
export function exportManifestJsonString(state, space = 2) {
  const manifestObj = buildIIIFManifest(state);
  return JSON.stringify(manifestObj, null, space);
}

/**
 * Initiates browser download of the manifest as manifest.json
 */
export function downloadManifestJson(state, filename = 'manifest.json') {
  const jsonStr = exportManifestJsonString(state);
  const blob = new Blob([jsonStr], { type: 'application/ld+json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
