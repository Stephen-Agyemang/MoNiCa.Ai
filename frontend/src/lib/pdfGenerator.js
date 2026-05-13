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
    const glassPanels = element.querySelectorAll('.glass-panel');
    const originalFilters = [];
    glassPanels.forEach((p, i) => {
      originalFilters[i] = p.style.backdropFilter;
      p.style.backdropFilter = 'none';
      p.style.backgroundColor = '#f8faf9'; // Fallback to solid light background so the PDF looks perfect
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

    // Restore the gorgeous frosted glass look immediately after download
    glassPanels.forEach((p, i) => {
      p.style.backdropFilter = originalFilters[i];
      p.style.backgroundColor = 'rgba(255,255,255,0.6)';
    });

    if (onSuccess) onSuccess();

  } catch (err) {
    console.error("PDF generation failed:", err);
    if (onError) onError(err);
  }
};
