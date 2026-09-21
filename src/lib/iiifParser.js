/**
 * IIIF Parser & Normalizer Module (Pure JavaScript)
 * Supports IIIF Presentation API 2.0, 2.1, and 3.0.
 * Normalizes manifests into a standard representation for editing and viewer display.
 */

export const SAMPLE_MANIFESTS = [
  {
    id: 'bodleian-ms-bodl-264',
    title: 'Romance of Alexander (Bodleian MS. Bodl. 264)',
    institution: 'Bodleian Library, Oxford',
    url: 'https://iiif.bodleian.ox.ac.uk/iiif/manifest/693ec881-2a91-4dfc-bbbe-5c6020c6a51d.json',
    description: '14th-century illuminated manuscript with rich decorative marginalia and French prose romance.'
  },
  {
    id: 'stanford-beowulf',
    title: 'The Bayeux Tapestry / Historical specimen',
    institution: 'Stanford University Libraries',
    url: 'https://purl.stanford.edu/jr903ng8608/iiif/manifest',
    description: 'High-resolution digitized folio from academic special collections.'
  },
  {
    id: 'harvard-manuscript',
    title: 'Houghton Library Manuscript',
    institution: 'Harvard University',
    url: 'https://iiif.lib.harvard.edu/manifests/drs:4997399',
    description: 'Medieval Latin manuscript leaf collection with calligraphic script.'
  },
  {
    id: 'wellcome-herbal',
    title: 'Medical & Botanical Herbal Folios',
    institution: 'Wellcome Collection',
    url: 'https://wellcomecollection.org/works/b382zfe2/items',
    description: 'Illustrated herbal treatise with handwritten medicinal transcriptions.'
  }
];

/**
 * Extracts a localized string from an IIIF v2 or v3 label/description structure.
 */
export function getLocalizedText(prop, defaultVal = 'Untitled') {
  if (!prop) return defaultVal;
  if (typeof prop === 'string') return prop;
  if (Array.isArray(prop)) {
    return prop.map(item => getLocalizedText(item, '')).filter(Boolean).join(' ') || defaultVal;
  }
  if (typeof prop === 'object') {
    // IIIF v3: { "en": ["Value"], "none": ["Value"], "@value": "Value" }
    if (prop['@value']) return prop['@value'];
    const keys = Object.keys(prop);
    if (keys.length > 0) {
      const firstVal = prop['en'] || prop['none'] || prop[keys[0]];
      if (Array.isArray(firstVal)) return firstVal.join(' ');
      if (typeof firstVal === 'string') return firstVal;
    }
  }
  return defaultVal;
}

/**
 * Extracts the image URL for a canvas (IIIF v2 or v3).
 */
export function getCanvasImageUrl(canvas) {
  if (!canvas) return null;

  // IIIF v3 structure: canvas.items[0].items[0].body
  if (canvas.items && canvas.items.length > 0) {
    const page = canvas.items[0];
    if (page.items && page.items.length > 0) {
      const painting = page.items[0];
      const body = painting.body;
      if (body) {
        if (body.id) {
          // If image service is available, construct optimal URL
          const service = body.service;
          const serviceId = getServiceId(service);
          if (serviceId) {
            return `${serviceId.replace(/\/info\.json$/, '')}/full/max/0/default.jpg`;
          }
          return body.id;
        }
      }
    }
  }

  // IIIF v2 structure: canvas.images[0].resource
  if (canvas.images && canvas.images.length > 0) {
    const img = canvas.images[0];
    if (img.resource) {
      const res = img.resource;
      const service = res.service;
      const serviceId = getServiceId(service);
      if (serviceId) {
        return `${serviceId.replace(/\/info\.json$/, '')}/full/full/0/default.jpg`;
      }
      if (res['@id']) return res['@id'];
      if (res.id) return res.id;
    }
  }

  // Fallback thumbnail or direct id if image
  if (canvas.thumbnail) {
    const thumbUrl = typeof canvas.thumbnail === 'string' ? canvas.thumbnail : (canvas.thumbnail.id || canvas.thumbnail['@id']);
    if (thumbUrl) return thumbUrl;
  }

  return null;
}

/**
 * Helper to get service ID from IIIF service descriptor
 */
function getServiceId(service) {
  if (!service) return null;
  if (Array.isArray(service)) {
    return getServiceId(service[0]);
  }
  if (typeof service === 'string') return service;
  if (typeof service === 'object') {
    return service.id || service['@id'] || null;
  }
  return null;
}

/**
 * Extracts thumbnail URL for a canvas
 */
export function getCanvasThumbnailUrl(canvas) {
  if (canvas.thumbnail) {
    if (typeof canvas.thumbnail === 'string') return canvas.thumbnail;
    if (Array.isArray(canvas.thumbnail) && canvas.thumbnail.length > 0) {
      const t = canvas.thumbnail[0];
      return t.id || t['@id'] || null;
    }
    if (canvas.thumbnail.id) return canvas.thumbnail.id;
    if (canvas.thumbnail['@id']) return canvas.thumbnail['@id'];
  }

  // Generate thumbnail from main image service if possible
  const mainImg = getCanvasImageUrl(canvas);
  if (mainImg && mainImg.includes('/full/')) {
    return mainImg.replace(/\/full\/(max|full)\/0\//, '/full/!200,200/0/');
  }
  return mainImg;
}

/**
 * Extracts textual annotations and bookmarks from a canvas.
 * Handles both IIIF v3 (canvas.annotations) and IIIF v2 (canvas.otherContent).
 */
export function extractCanvasAnnotations(canvas) {
  const transcriptions = [];
  let isBookmarked = false;
  let note = '';
  let noteLanguage = 'en';

  // Check canvas summary or description for note if present
  if (canvas.summary) {
    note = getLocalizedText(canvas.summary, '');
  } else if (canvas.description && typeof canvas.description === 'string') {
    note = canvas.description;
  }

  const processAnno = (anno, pageId = '') => {
    if (!anno) return;

    // Check motivation
    const motivation = anno.motivation || anno['@type'] || '';
    const isBookmark = motivation === 'bookmarking' || motivation.includes('bookmarking');
    if (isBookmark) {
      isBookmarked = true;
      return;
    }

    const isComment = motivation === 'commenting' || motivation.includes('commenting');

    // Extract textual body
    let text = '';
    let language = 'en';
    let format = 'text/plain';

    if (anno.body) {
      if (typeof anno.body === 'string') {
        text = anno.body;
      } else if (Array.isArray(anno.body)) {
        const textBody = anno.body.find(b => b.type === 'TextualBody' || b.format?.includes('text') || b.value);
        if (textBody) {
          text = textBody.value || '';
          language = textBody.language || language;
          format = textBody.format || format;
        }
      } else if (typeof anno.body === 'object') {
        text = anno.body.value || anno.body.chars || '';
        language = anno.body.language || language;
        format = anno.body.format || format;
      }
    } else if (anno.resource) {
      // IIIF v2
      text = anno.resource.chars || anno.resource.value || '';
      if (anno.resource.language) language = anno.resource.language;
    }

    // If motivation is commenting, it's a general page note!
    if (isComment) {
      if (text) {
        note = text;
        noteLanguage = language || 'en';
      }
      return;
    }

    // Determine target region (#xywh=x,y,w,h) if present
    let target = anno.target || anno.on || '';
    let targetRegion = null;
    let canvasId = '';

    if (typeof target === 'string') {
      const hashIndex = target.indexOf('#xywh=');
      if (hashIndex !== -1) {
        canvasId = target.substring(0, hashIndex);
        const xywhStr = target.substring(hashIndex + 6);
        const [x, y, w, h] = xywhStr.split(',').map(n => parseFloat(n.trim()));
        if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
          targetRegion = { x, y, w, h };
        }
      } else {
        canvasId = target;
      }
    } else if (typeof target === 'object') {
      const source = target.source || target.id || target['@id'] || '';
      canvasId = typeof source === 'string' ? source : '';
      if (target.selector) {
        const val = target.selector.value || '';
        const match = val.match(/xywh=([\d.]+),([\d.]+),([\d.]+),([\d.]+)/);
        if (match) {
          targetRegion = {
            x: parseFloat(match[1]),
            y: parseFloat(match[2]),
            w: parseFloat(match[3]),
            h: parseFloat(match[4])
          };
        }
      }
    }

    if (text || targetRegion) {
      transcriptions.push({
        id: anno.id || anno['@id'] || `transcription-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        text: text,
        language: language || 'en',
        format: format || 'text/plain',
        targetRegion: targetRegion, // {x, y, w, h} or null for full canvas
        canvasId: canvasId || canvas.id || canvas['@id']
      });
    }
  };

  // IIIF v3 annotations array: [ { type: "AnnotationPage", items: [...] } ]
  if (canvas.annotations && Array.isArray(canvas.annotations)) {
    canvas.annotations.forEach(item => {
      if (item.type === 'AnnotationPage' && Array.isArray(item.items)) {
        item.items.forEach(anno => processAnno(anno, item.id));
      } else if (item.type === 'Annotation') {
        processAnno(item);
      }
    });
  }

  // IIIF v2 otherContent array: [ { "@type": "sc:AnnotationList", resources: [...] } ]
  if (canvas.otherContent && Array.isArray(canvas.otherContent)) {
    canvas.otherContent.forEach(item => {
      if (item.resources && Array.isArray(item.resources)) {
        item.resources.forEach(anno => processAnno(anno, item['@id']));
      }
    });
  }

  return { transcriptions, isBookmarked, note, noteLanguage };
}

/**
 * Parses any raw IIIF Manifest object into normalized internal format.
 */
export function parseIIIFManifest(rawManifest, sourceUrl = '') {
  if (!rawManifest || typeof rawManifest !== 'object') {
    throw new Error('Invalid manifest data: expected a JSON object.');
  }

  const isV3 = rawManifest['@context'] && (
    typeof rawManifest['@context'] === 'string'
      ? rawManifest['@context'].includes('presentation/3')
      : Array.isArray(rawManifest['@context']) && rawManifest['@context'].some(c => typeof c === 'string' && c.includes('presentation/3'))
  );

  const manifestId = rawManifest.id || rawManifest['@id'] || `urn:manifest:${Date.now()}`;
  const label = getLocalizedText(rawManifest.label, 'Untitled IIIF Document');
  const description = getLocalizedText(rawManifest.summary || rawManifest.description, '');

  // Extract raw canvases
  let rawCanvases = [];
  if (rawManifest.items && Array.isArray(rawManifest.items)) {
    // IIIF v3 canvases are in items
    rawCanvases = rawManifest.items.filter(item => item.type === 'Canvas');
  } else if (rawManifest.sequences && Array.isArray(rawManifest.sequences) && rawManifest.sequences[0]?.canvases) {
    // IIIF v2 canvases are in sequences[0].canvases
    rawCanvases = rawManifest.sequences[0].canvases;
  }

  if (rawCanvases.length === 0) {
    throw new Error('No Canvases (pages) found in this IIIF Manifest.');
  }

  // Check structures for bookmarks
  const bookmarkedCanvasIds = new Set();
  if (rawManifest.structures && Array.isArray(rawManifest.structures)) {
    rawManifest.structures.forEach(range => {
      const rangeLabel = getLocalizedText(range.label, '').toLowerCase();
      if (rangeLabel.includes('bookmark') || (range.behavior && range.behavior.includes('bookmarks'))) {
        const items = range.items || range.canvases || [];
        items.forEach(item => {
          const cid = typeof item === 'string' ? item : (item.id || item['@id']);
          if (cid) bookmarkedCanvasIds.add(cid);
        });
      }
    });
  }

  // Normalize each canvas
  const canvases = rawCanvases.map((rawCanvas, index) => {
    const id = rawCanvas.id || rawCanvas['@id'] || `canvas-${index + 1}`;
    const canvasLabel = getLocalizedText(rawCanvas.label, `Page ${index + 1}`);
    const width = rawCanvas.width || 1000;
    const height = rawCanvas.height || 1400;
    const imageUrl = getCanvasImageUrl(rawCanvas);
    const thumbnailUrl = getCanvasThumbnailUrl(rawCanvas);

    const { transcriptions, isBookmarked: annoBookmarked, note, noteLanguage } = extractCanvasAnnotations(rawCanvas);
    const isBookmarked = annoBookmarked || bookmarkedCanvasIds.has(id);

    return {
      index,
      id,
      label: canvasLabel,
      width,
      height,
      imageUrl,
      thumbnailUrl,
      transcriptions, // array of { id, text, language, format, targetRegion, canvasId }
      note: note || '',
      noteLanguage: noteLanguage || 'en',
      isBookmarked,
      rawCanvas // keep reference to original canvas for preserving unedited properties
    };
  });

  return {
    isV3: Boolean(isV3),
    id: manifestId,
    label,
    description,
    canvases,
    sourceUrl,
    rawManifest
  };
}

/**
 * Creates a blank starter IIIF manifest with custom sample pages if requested.
 */
export function createSampleManifest(title = 'New IIIF Transcription Project') {
  const sampleImages = [
    {
      label: 'Folio 1r - Introduction & Miniature',
      url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1600&q=80',
      width: 1600,
      height: 2200
    },
    {
      label: 'Folio 1v - Decorated Incunabula Text',
      url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1600&q=80',
      width: 1600,
      height: 2150
    },
    {
      label: 'Folio 2r - Calligraphic Script Leaf',
      url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1600&q=80',
      width: 1600,
      height: 2400
    }
  ];

  const now = Date.now();
  const manifestId = `https://example.org/iiif/manifest-${now}`;

  const canvases = sampleImages.map((img, idx) => ({
    id: `${manifestId}/canvas/p${idx + 1}`,
    type: 'Canvas',
    label: { en: [img.label] },
    width: img.width,
    height: img.height,
    items: [
      {
        id: `${manifestId}/canvas/p${idx + 1}/page/1`,
        type: 'AnnotationPage',
        items: [
          {
            id: `${manifestId}/canvas/p${idx + 1}/annotation/painting`,
            type: 'Annotation',
            motivation: 'painting',
            body: {
              id: img.url,
              type: 'Image',
              format: 'image/jpeg',
              width: img.width,
              height: img.height
            },
            target: `${manifestId}/canvas/p${idx + 1}`
          }
        ]
      }
    ]
  }));

  const rawManifest = {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: manifestId,
    type: 'Manifest',
    label: { en: [title] },
    summary: { en: ['Locally created IIIF Presentation 3.0 document ready for manual page transcription.'] },
    items: canvases
  };

  return parseIIIFManifest(rawManifest, 'local-template');
}
