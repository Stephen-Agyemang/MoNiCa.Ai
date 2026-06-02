import html2pdf from 'html2pdf.js';

/**
 * Generates a high-fidelity, single-page PDF "Digital Poster" from a given DOM element.
 * Safely strips backdrop-filters to prevent rendering crashes and restores them immediately.
 * 
 * @param {string} elementId - The DOM ID of the container to snapshot
 * @param {string} filename - The desired output filename
 * @param {object} callbacks - Optional hooks { onStart, onSuccess, onError }
 */
export const generateReportPDF = async (elementId, filename, callbacks = {}) => {
  const { onStart, onSuccess, onError } = callbacks;
  
  try {
    if (onStart) onStart();
    const element = document.getElementById(elementId);
    
    if (!element) {
      throw new Error(`Element with id '${elementId}' not found.`);
    }

    // CRITICAL FIX: html2canvas crashes on CSS backdrop-filter. We MUST strip it before generating, then restore it.
    const glassPanels = element.querySelectorAll('.glass-panel, .glass-panel-dark, .glass-panel-light');
    const originalStyles = [];
    glassPanels.forEach((p, i) => {
      originalStyles[i] = { backdropFilter: p.style.backdropFilter, backgroundColor: p.style.backgroundColor };
      p.style.backdropFilter = 'none';
      p.style.backgroundColor = '#12161a';
    });

    // Measure exact DOM bounds to create a perfectly sized, non-paginated digital poster
    const elWidth = element.scrollWidth;
    const elHeight = element.scrollHeight;

    const opt = {
      margin:       [20, 20], // 20px padding around the entire digital page
      filename:     filename,
      image:        { type: 'jpeg', quality: 1.0 },
      html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: elWidth },
      // Instead of standard A4, construct a custom 1-page PDF exactly matching the element's fluid height & width!
      jsPDF:        { unit: 'px', format: [elWidth + 40, elHeight + 40], orientation: 'portrait' }
    };

    await html2pdf().set(opt).from(element).save();

    // Restore the frosted glass look immediately after download
    glassPanels.forEach((p, i) => {
      p.style.backdropFilter = originalStyles[i].backdropFilter;
      p.style.backgroundColor = originalStyles[i].backgroundColor;
    });

    if (onSuccess) onSuccess();

  } catch (err) {
    console.error("PDF generation failed:", err);
    if (onError) onError(err);
  }
};
