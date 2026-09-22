/**
 * IIIF Parser & Normalizer Module (Pure JavaScript)
 * Supports IIIF Presentation API 2.0, 2.1, and 3.0.
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

export function getLocalizedText(prop, defaultVal = 'Untitled') {
  if (!prop) return defaultVal;
  if (typeof prop === 'string') return prop;
  if (Array.isArray(prop)) {
    return prop.map(item => getLocalizedText(item, '')).filter(Boolean).join(' ') || defaultVal;
  }
  if (typeof prop === 'object') {
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

function getServiceId(service) {
  if (!service) return null;
  if (Array.isArray(service)) {
    for (const s of service) {
      const id = getServiceId(s);
      if (id) return id;
    }
    return null;
  }
  if (typeof service === 'string') return service;
  return service['@id'] || service.id || null;
}

export function getCanvasImageUrl(canvas) {
  if (!canvas) return null;

  // IIIF v3
  if (canvas.items && canvas.items.length > 0) {
    const page = canvas.items[0];
    if (page.items && page.items.length > 0) {
      const painting = page.items[0];
      const body = painting.body;
      if (body) {
        if (body.id) {
          const service = body.service;
          const serviceId = getServiceId(service);
          if (serviceId) {
            return `${serviceId.replace(/\/info\.json$/, '')}/full/1600,/0/default.jpg`;
          }
          return body.id;
        }
      }
    }
  }

  // IIIF v2
  if (canvas.images && canvas.images.length > 0) {
    const img = canvas.images[0];
    if (img.resource) {
      const res = img.resource;
      const service = res.service;
      const serviceId = getServiceId(service);
      if (serviceId) {
        return `${serviceId.replace(/\/info\.json$/, '')}/full/1600,/0/default.jpg`;
      }
      if (res['@id']) return res['@id'];
      if (res.id) return res.id;
    }
  }

  return null;
}

export function getThumbnailUrl(canvas, imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.includes('/full/')) {
    return imageUrl.replace(/\/full\/[^/]+\//, '/full/200,/');
  }
  if (imageUrl.includes('unsplash.com')) {
    return imageUrl.replace(/w=\d+/, 'w=200').replace(/q=\d+/, 'q=60');
  }
  return imageUrl;
}

export function parseIIIFManifest(json, sourceUrl = '') {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid IIIF manifest JSON structure.');
  }

  const id = json.id || json['@id'] || sourceUrl || `https://example.org/iiif/manifest-${Date.now()}`;
  const label = getLocalizedText(json.label, 'Untitled IIIF Document');
  const description = getLocalizedText(json.description || json.summary, '');

  let rawCanvases = [];
  if (json.items && Array.isArray(json.items)) {
    rawCanvases = json.items;
  } else if (json.sequences && Array.isArray(json.sequences)) {
    const seq = json.sequences[0];
    if (seq && seq.canvases && Array.isArray(seq.canvases)) {
      rawCanvases = seq.canvases;
    }
  }

  const canvases = rawCanvases.map((canvas, index) => {
    const canvasId = canvas.id || canvas['@id'] || `${id}/canvas/p${index + 1}`;
    const canvasLabel = getLocalizedText(canvas.label, `Page ${index + 1}`);
    const imageUrl = getCanvasImageUrl(canvas);
    let thumbnailUrl = imageUrl ? getThumbnailUrl(canvas, imageUrl) : null;
    if (canvas.thumbnail) {
      const thumb = Array.isArray(canvas.thumbnail) ? canvas.thumbnail[0] : canvas.thumbnail;
      if (typeof thumb === 'string') thumbnailUrl = thumb;
      else if (thumb['@id']) thumbnailUrl = thumb['@id'];
      else if (thumb.id) thumbnailUrl = thumb.id;
    }

    let width = canvas.width || 1200;
    let height = canvas.height || 1600;

    if (!canvas.width && canvas.items?.[0]?.items?.[0]?.body?.width) {
      width = canvas.items[0].items[0].body.width;
      height = canvas.items[0].items[0].body.height;
    } else if (!canvas.width && canvas.images?.[0]?.resource?.width) {
      width = canvas.images[0].resource.width;
      height = canvas.images[0].resource.height;
    }

    const transcriptions = [];
    let isBookmarked = false;
    let note = '';
    let noteLanguage = 'en';

    if (canvas.summary) {
      const summaryText = getLocalizedText(canvas.summary, '');
      if (summaryText) {
        note = summaryText;
      }
    }

    const annotations = [];
    if (canvas.annotations && Array.isArray(canvas.annotations)) {
      canvas.annotations.forEach(annoPage => {
        if (annoPage.items && Array.isArray(annoPage.items)) {
          annotations.push(...annoPage.items);
        } else if (annoPage['@graph'] && Array.isArray(annoPage['@graph'])) {
          annotations.push(...annoPage['@graph']);
        }
      });
    }

    annotations.forEach(anno => {
      const motivation = anno.motivation || '';
      const body = anno.body || {};
      let text = '';
      let language = 'en';
      let format = 'text/plain';

      if (body) {
        if (typeof body === 'string') {
          text = body;
        } else if (body.value) {
          text = body.value;
          language = body.language || 'en';
          format = body.format || 'text/plain';
        } else if (body.chars) {
          text = body.chars;
          language = body.language || 'en';
        } else if (Array.isArray(body)) {
          text = body.map(b => b.value || b.chars || '').join(' ');
        }
      }

      const isComment = motivation === 'commenting' || motivation.includes('comment') || anno['@type'] === 'oa:Annotation';
      const isBookmark = motivation === 'bookmarking' || motivation.includes('bookmark') || text.includes('Bookmarked') || text.includes('záložkou');

      if (isBookmark) {
        isBookmarked = true;
        return;
      }

      if (isComment) {
        if (text) {
          note = text;
          noteLanguage = language || 'en';
        }
        return;
      }

      if (text) {
        let targetRegion = null;
        const target = anno.target || anno['@target'];
        if (typeof target === 'string' && target.includes('#xywh=')) {
          const parts = target.split('#xywh=')[1].split(',').map(Number);
          if (parts.length === 4 && !parts.some(isNaN)) {
            targetRegion = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
          }
        }

        transcriptions.push({
          id: anno.id || anno['@id'] || `transcription-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          text: text,
          language: language || 'en',
          format: format || 'text/plain',
          targetRegion: targetRegion,
          canvasId: canvasId
        });
      }
    });

    return {
      id: canvasId,
      label: canvasLabel,
      width,
      height,
      imageUrl,
      thumbnailUrl,
      transcriptions,
      note: note || '',
      noteLanguage: noteLanguage || 'en',
      isBookmarked,
      rawCanvas: canvas
    };
  });

  return {
    id,
    label,
    description,
    canvases,
    rawManifest: json
  };
}

export function createLocalManifestTemplate(title = 'Illuminated Manuscript Transcriber') {
  const sampleImages = [
    {
      label: 'Folio 1r - Frontispiece Miniature',
      url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1600&q=80',
      width: 1600,
      height: 2200
    },
    {
      label: 'Folio 1v - Decorated Initials',
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



