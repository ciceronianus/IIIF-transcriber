/**
 * IIIF Manifest Exporter Module (Pure JavaScript)
 */

export function buildIIIFManifest(state) {
  const { id, label, description, canvases, rawManifest } = state;
  const manifestId = id || `https://example.org/iiif/manifest-${Date.now()}`;

  const baseManifest = rawManifest && typeof rawManifest === 'object' ? { ...rawManifest } : {};

  delete baseManifest.sequences;
  delete baseManifest['@id'];
  delete baseManifest['@type'];

  const manifestLabel = typeof label === 'object' && label.en ? label : { en: [label || 'Untitled IIIF Document'] };
  const manifestSummary = description ? (typeof description === 'object' ? description : { en: [description] }) : undefined;

  const bookmarkedCanvasIds = [];

  const items = canvases.map((canvas, index) => {
    const canvasId = canvas.id || `${manifestId}/canvas/p${index + 1}`;
    const canvasLabel = typeof canvas.label === 'object' ? canvas.label : { en: [canvas.label || `Page ${index + 1}`] };

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

    const annotationItems = [];

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

    let annotations = canvas.rawCanvas?.annotations || [];
    if (annotationItems.length > 0) {
      const userAnnoPage = {
        id: `${canvasId}/annotations/user`,
        type: 'AnnotationPage',
        items: annotationItems
      };
      annotations = [userAnnoPage];
    }

    const canvasObj = {
      id: canvasId,
      type: 'Canvas',
      label: canvasLabel,
      height: canvas.height,
      width: canvas.width,
      items: paintingItems
    };

    if (canvas.note && canvas.note.trim()) {
      const noteLang = canvas.noteLanguage || 'en';
      canvasObj.summary = { [noteLang]: [canvas.note.trim()] };
    }

    if (annotations.length > 0) {
      canvasObj.annotations = annotations;
    }

    return canvasObj;
  });

  const finalManifest = {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: manifestId,
    type: 'Manifest',
    label: manifestLabel,
    ...(manifestSummary ? { summary: manifestSummary } : {}),
    ...baseManifest,
    items: items
  };

  if (bookmarkedCanvasIds.length > 0) {
    if (!finalManifest.structures) {
      finalManifest.structures = [];
    }
    finalManifest.structures.push({
      id: `${manifestId}/range/bookmarks`,
      type: 'Range',
      label: { en: ['Bookmarks'] },
      items: bookmarkedCanvasIds.map(cid => ({ id: cid, type: 'Canvas' }))
    });
  }

  return finalManifest;
}

export function exportManifestJsonString(state) {
  const manifest = buildIIIFManifest(state);
  return JSON.stringify(manifest, null, 2);
}

export function exportCanvasJsonString(canvas) {
  if (!canvas) return '{}';
  return JSON.stringify(canvas.rawCanvas || canvas, null, 2);
}

export function downloadJsonFile(jsonString, filename = 'manifest.json') {
  const blob = new Blob([jsonString], { type: 'application/ld+json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadManifestJson(state, filename = 'manifest.json') {
  const jsonString = exportManifestJsonString(state);
  downloadJsonFile(jsonString, filename);
}

