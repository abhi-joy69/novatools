/**
 * ai-progress-ext.js
 * Universal real-time proportional progress loader with aggressive DOM hiding/removal
 * ensuring action buttons are physically absent during generation and only render after completion.
 */

(function () {
  'use strict';

  const ensurePdfLib = () => {
    return new Promise((resolve, reject) => {
      if (window.PDFLib && window.PDFLib.PDFDocument) {
        return resolve(window.PDFLib);
      }
      const existing = document.querySelector('script[src*="pdf-lib"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.PDFLib));
        existing.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
      script.onload = () => resolve(window.PDFLib);
      script.onerror = () => reject(new Error('Failed to load pdf-lib'));
      document.head.appendChild(script);
    });
  };

  const injectStyles = () => {
    if (document.getElementById('ai-progress-ext-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-progress-ext-styles';
    style.textContent = `
      .ai-ext-btn-loading {
        position: relative !important;
        pointer-events: none !important;
        overflow: hidden !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        z-index: 1 !important;
      }
      .ai-ext-btn-progress-fill {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        bottom: 0 !important;
        width: 0%;
        background: rgba(255, 255, 255, 0.25) !important;
        transition: width 0.05s linear !important;
        z-index: -1 !important;
        pointer-events: none !important;
      }
      .ai-ext-pct-badge {
        background: rgba(0, 0, 0, 0.3) !important;
        color: #ffffff !important;
        padding: 2px 8px !important;
        border-radius: 999px !important;
        font-size: 0.8rem !important;
        font-weight: 700 !important;
        font-variant-numeric: tabular-nums !important;
        min-width: 44px !important;
        text-align: center !important;
      }
      .ai-ext-bottom-actions {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 12px !important;
        margin-top: 16px !important;
        padding-top: 12px !important;
        border-top: 1px solid rgba(150, 150, 150, 0.2) !important;
        width: 100% !important;
      }
      .ai-ext-action-btn {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 8px 16px !important;
        border-radius: 8px !important;
        font-size: 0.9rem !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        border: none !important;
        color: #ffffff !important;
      }
      .ai-ext-btn-copy { background: #2563eb !important; }
      .ai-ext-btn-pdf { background: #059669 !important; }
    `;
    document.head.appendChild(style);
  };

  let activeRequests = 0;
  let isGenerating = false;
  const activeButtons = new Map();

  // Aggressively remove all action buttons from the DOM during generation
  const purgeAllActionButtons = () => {
    document.querySelectorAll('.ai-ext-bottom-actions').forEach((el) => el.remove());
    // Also remove any stray pre-existing copy/download buttons in output cards
    const allBtns = document.querySelectorAll('button, a.btn, .btn');
    allBtns.forEach((b) => {
      const txt = (b.textContent || '').trim().toLowerCase();
      if (
        txt.includes('copy output') ||
        txt.includes('download pdf') ||
        txt.includes('export pdf') ||
        (txt === 'copy' && b.closest('[id*="output" i], [id*="result" i]'))
      ) {
        b.remove();
      }
    });
  };

  const setGeneratingState = (val) => {
    isGenerating = val;
    if (val) {
      document.body.classList.add('ai-ext-is-generating');
      purgeAllActionButtons();
    } else {
      document.body.classList.remove('ai-ext-is-generating');
    }
  };

  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    activeRequests++;
    setGeneratingState(true);
    try {
      return await originalFetch.apply(this, [input, init]);
    } finally {
      activeRequests = Math.max(0, activeRequests - 1);
      if (activeRequests === 0) finishAllAnimations();
    }
  };

  const originalXHR = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    activeRequests++;
    setGeneratingState(true);
    this.addEventListener('loadend', () => {
      activeRequests = Math.max(0, activeRequests - 1);
      if (activeRequests === 0) finishAllAnimations();
    });
    return originalXHR.call(this, body);
  };

  const getStatusMessage = (pct) => {
    if (pct < 30) return 'Analyzing request...';
    if (pct < 65) return 'Drafting response...';
    if (pct < 90) return 'Polishing tone...';
    return 'Finalizing output...';
  };

  const updateBtnDOM = (btn, pct) => {
    const rounded = Math.min(99, Math.max(1, Math.floor(pct)));
    const msg = getStatusMessage(rounded);
    let fill = btn.querySelector('.ai-ext-btn-progress-fill');
    let text = btn.querySelector('.ai-ext-btn-text');
    let badge = btn.querySelector('.ai-ext-pct-badge');

    if (!fill || !text || !badge) {
      btn.innerHTML = `
        <span class="ai-ext-btn-progress-fill" style="width: ${rounded}%;"></span>
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span class="ai-ext-btn-text">${msg}</span>
        <span class="ai-ext-pct-badge">${rounded}%</span>
      `;
    } else {
      fill.style.width = `${rounded}%`;
      text.textContent = msg;
      badge.textContent = `${rounded}%`;
    }
  };

  const startAnimation = (btn) => {
    if (!btn || activeButtons.has(btn)) return;
    setGeneratingState(true);

    const originalHTML = btn.innerHTML;
    const originalDisabled = btn.disabled;
    btn.classList.add('ai-ext-btn-loading');
    btn.disabled = true;

    const startTime = performance.now();
    let currentPct = 1;
    updateBtnDOM(btn, currentPct);

    const state = {
      originalHTML,
      originalDisabled,
      completing: false,
      rafId: null,
      timer: null
    };

    const tick = (now) => {
      if (state.completing) return;
      const elapsed = (now - startTime) / 1000;
      const target = Math.min(99, 1 + 98 * (1 - Math.exp(-elapsed / 2.8)));
      if (target > currentPct) {
        currentPct = target;
        updateBtnDOM(btn, currentPct);
      }
      state.rafId = requestAnimationFrame(tick);
    };

    state.rafId = requestAnimationFrame(tick);
    state.timer = setTimeout(() => {
      if (activeRequests === 0) finishAnimation(btn);
    }, 12000);

    activeButtons.set(btn, state);
  };

  const finishAnimation = (btn) => {
    const state = activeButtons.get(btn);
    if (!state || state.completing) return;
    state.completing = true;

    if (state.rafId) cancelAnimationFrame(state.rafId);
    if (state.timer) clearTimeout(state.timer);

    updateBtnDOM(btn, 100);

    setTimeout(() => {
      btn.classList.remove('ai-ext-btn-loading');
      btn.innerHTML = state.originalHTML;
      btn.disabled = state.originalDisabled;
      activeButtons.delete(btn);

      if (activeButtons.size === 0) {
        setGeneratingState(false);
        enhanceResultBoxes();
      }
    }, 200);
  };

  const finishAllAnimations = () => {
    activeButtons.forEach((_, btn) => finishAnimation(btn));
  };

  const isGenerateBtn = (btn) => {
    if (!btn || btn.classList.contains('ai-ext-action-btn')) return false;
    const text = (btn.textContent || '').trim().toLowerCase();
    const keywords = [
      'generate', 'write', 'summar', 'grammar', 'tone', 'improve',
      'email', 'draft', 'code', 'syntax', 'explain', 'prompt', 'enhance',
      'analyze', 'create', 'submit', 'run', 'check'
    ];
    return keywords.some((k) => text.includes(k));
  };

  const extractCleanText = (box) => {
    if (!box) return '';
    const clone = box.cloneNode(true);
    clone.querySelectorAll('.ai-ext-bottom-actions, script, style').forEach((e) => e.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  };

  const exportPDF = async (text) => {
    const PDFLib = await ensurePdfLib();
    const pdfDoc = await PDFLib.PDFDocument.create();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    let y = height - 50;

    const words = text.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, 11) > width - 100 && line) {
        page.drawText(line, { x: 50, y, size: 11, font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
        y -= 18;
        line = w;
        if (y < 50) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = height - 50;
        }
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x: 50, y, size: 11, font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    }
    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `AI-Output-${Date.now().toString(36).toUpperCase()}.pdf`;
    link.click();
  };

  const enhanceResultBoxes = () => {
    if (isGenerating || activeButtons.size > 0) return;
    const candidates = document.querySelectorAll(
      '[id*="output" i], [id*="result" i], [id*="response" i], [class*="output" i], [class*="result" i]'
    );
    candidates.forEach((box) => {
      if (!box || box.nodeType !== 1) return;
      const text = extractCleanText(box);
      if (!text || text.length < 15 || /^(generating|loading|thinking)/i.test(text)) return;

      // Ensure no duplicate action bars
      let bar = box.querySelector('.ai-ext-bottom-actions');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'ai-ext-bottom-actions';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'ai-ext-action-btn ai-ext-btn-copy';
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> <span>Copy Output</span>';
        copyBtn.onclick = async () => {
          await navigator.clipboard.writeText(extractCleanText(box));
          copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Copied!</span>';
          setTimeout(() => { copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> <span>Copy Output</span>'; }, 2000);
        };

        const pdfBtn = document.createElement('button');
        pdfBtn.type = 'button';
        pdfBtn.className = 'ai-ext-action-btn ai-ext-btn-pdf';
        pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> <span>Download PDF</span>';
        pdfBtn.onclick = async () => {
          pdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Building...</span>';
          await exportPDF(extractCleanText(box));
          pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> <span>Download PDF</span>';
        };

        bar.appendChild(copyBtn);
        bar.appendChild(pdfBtn);
        box.appendChild(bar);
      }
    });
  };

  const init = () => {
    injectStyles();
    document.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest('button, a.btn, .btn, [role="button"]');
        if (btn && isGenerateBtn(btn)) {
          startAnimation(btn);
        }
      },
      true
    );

    const observer = new MutationObserver(() => {
      if (isGenerating || activeButtons.size > 0) {
        purgeAllActionButtons();
      } else {
        enhanceResultBoxes();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
