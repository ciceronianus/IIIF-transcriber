/**
 * IIIF Specification Validator & Feature Compliance Guard (Pure JavaScript)
 * Enforces compliance with IIIF Presentation API 3.0 and W3C Web Annotation recommendations.
 * Rejects non-compliant features or invalid data models.
 */

// Official IIIF Presentation 3.0 & W3C Web Annotation supported motivations
export const SUPPORTED_MOTIVATIONS = [
  'supplementing', // Standard for transcriptions, captions, subtitles
  'painting',      // Standard for images / media playback onto canvas
  'bookmarking',   // Standard W3C for saving / highlighting canvas references
  'commenting',    // Standard W3C commenting
  'tagging',       // Standard W3C semantic tagging
  'describing',    // Standard descriptive annotation
  'identifying'    // Standard identification annotation
];

/**
 * Audits a manifest object against IIIF Presentation 3.0 specs.
 * Returns { valid: boolean, errors: string[], warnings: string[], stats: object }
 */
export function validateIIIFCompliance(manifest) {
  const errors = [];
  const warnings = [];
  let canvasCount = 0;
  let transcriptionCount = 0;
  let bookmarkCount = 0;
  let roiCount = 0;

  if (!manifest || typeof manifest !== 'object') {
    return {
      valid: false,
      errors: ['Manifest is empty or not a valid JSON object.'],
      warnings: [],
      stats: { canvasCount, transcriptionCount, bookmarkCount, roiCount }
    };
  }

  // 1. Check @context
  const context = manifest['@context'];
  if (!context) {
    errors.push('Missing mandatory IIIF @context property.');
  } else {
    const isV3 = typeof context === 'string'
      ? context.includes('presentation/3')
      : Array.isArray(context) && context.some(c => typeof c === 'string' && c.includes('presentation/3'));
    if (!isV3) {
      warnings.push('Manifest context is not targeting IIIF Presentation 3.0 (recommended: "http://iiif.io/api/presentation/3/context.json").');
    }
  }

  // 2. Check id
  if (!manifest.id && !manifest['@id']) {
    errors.push('Missing mandatory IIIF identifier property (id).');
  }

  // 3. Check type
  const type = manifest.type || manifest['@type'];
  if (!type) {
    errors.push('Missing mandatory IIIF type property (expected "Manifest").');
  } else if (type !== 'Manifest' && type !== 'sc:Manifest') {
    errors.push(`Invalid type "${type}". Must be "Manifest".`);
  }

  // 4. Check label
  if (!manifest.label) {
    errors.push('Missing mandatory IIIF label property.');
  } else if (typeof manifest.label !== 'object') {
    warnings.push('In IIIF Presentation 3.0, label should be a Language Map (e.g. {"en": ["Title"]}).');
  }

  // 5. Check items (Canvases)
  const items = manifest.items || (manifest.sequences && manifest.sequences[0]?.canvases);
  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push('Manifest must contain at least one Canvas in items array.');
  } else {
    canvasCount = items.length;
    items.forEach((canvas, idx) => {
      const cId = canvas.id || canvas['@id'];
      if (!cId) {
        errors.push(`Canvas #${idx + 1} is missing mandatory id.`);
      }
      if (!canvas.width || !canvas.height) {
        warnings.push(`Canvas "${canvas.label || idx + 1}" is missing natural width or height dimensions.`);
      }

      // Check canvas annotations
      if (canvas.annotations && Array.isArray(canvas.annotations)) {
        canvas.annotations.forEach((page, pIdx) => {
          if (page.type !== 'AnnotationPage') {
            errors.push(`Canvas #${idx + 1} annotations[${pIdx}] must have type "AnnotationPage".`);
          }
          if (page.items && Array.isArray(page.items)) {
            page.items.forEach((anno, aIdx) => {
              if (anno.type !== 'Annotation') {
                errors.push(`Annotation ${aIdx} in Canvas #${idx + 1} must have type "Annotation".`);
              }

              // Validate motivation
              const mot = anno.motivation;
              if (!mot) {
                warnings.push(`Annotation #${aIdx + 1} on Canvas #${idx + 1} is missing a motivation.`);
              } else if (!SUPPORTED_MOTIVATIONS.includes(mot)) {
                warnings.push(`Non-standard annotation motivation "${mot}". Recommended: "supplementing" or "bookmarking".`);
              }

              if (mot === 'supplementing') {
                transcriptionCount++;
              }
              if (mot === 'bookmarking') {
                bookmarkCount++;
              }

              // Validate target
              const target = anno.target;
              if (!target) {
                errors.push(`Annotation #${aIdx + 1} is missing a target.`);
              } else if (typeof target === 'string') {
                if (target.includes('#xywh=')) {
                  roiCount++;
                  const hashIdx = target.indexOf('#xywh=');
                  const xywh = target.substring(hashIdx + 6).split(',');
                  if (xywh.length !== 4 || xywh.some(n => isNaN(parseFloat(n)))) {
                    errors.push(`Malformed Media Fragment in annotation target: "${target}". Expected "#xywh=x,y,w,h".`);
                  }
                }
              }

              // Validate body
              if (anno.body) {
                if (typeof anno.body === 'object' && anno.body.type !== 'TextualBody') {
                  warnings.push(`Annotation body type is "${anno.body.type}", expected "TextualBody" for transcriptions.`);
                }
              }
            });
          }
        });
      }
    });
  }

  // 6. Check structures for bookmarks
  if (manifest.structures && Array.isArray(manifest.structures)) {
    manifest.structures.forEach(range => {
      if (range.type && range.type !== 'Range') {
        warnings.push(`Structure entry type is "${range.type}", expected "Range".`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      canvasCount,
      transcriptionCount,
      bookmarkCount,
      roiCount
    }
  };
}

/**
 * Validates whether a proposed feature is permitted by the IIIF Presentation 3.0 specification.
 * Rejects operations outside IIIF scope.
 */
export function checkIIIFProposal(featureKey) {
  const permittedFeatures = {
    'transcription_page': {
      allowed: true,
      standard: 'IIIF v3 / W3C Web Annotation: Canvas.annotations[AnnotationPage].items[Annotation: motivation="supplementing", body=TextualBody, target=canvas.id]'
    },
    'transcription_region': {
      allowed: true,
      standard: 'IIIF v3 / W3C Media Fragments: target=canvas.id#xywh=x,y,w,h'
    },
    'bookmarking': {
      allowed: true,
      standard: 'W3C Web Annotation motivation="bookmarking" & IIIF Presentation 3.0 Range behavior=["bookmarks"]'
    },
    'text_layer_filter': {
      allowed: true,
      standard: 'Filtering canvases possessing annotations with motivation "supplementing" or format "text/plain"'
    },
    'export_manifest_json': {
      allowed: true,
      standard: 'Standard IIIF Presentation 3.0 JSON serialization'
    }
  };

  if (permittedFeatures[featureKey]) {
    return {
      allowed: true,
      message: `Feature is fully standardized in IIIF: ${permittedFeatures[featureKey].standard}`
    };
  }

  return {
    allowed: false,
    message: `Feature "${featureKey}" is NOT supported by the IIIF Presentation API or W3C Web Annotation specification and is rejected.`
  };
}
