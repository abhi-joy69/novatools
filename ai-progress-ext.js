/**
 * ai-progress-ext.js
 * Self-contained extension for:
 * 1. Real-time percentage loader (25%, 50%, 75%, 100%) & step-by-step messages
 * 2. Active website logo animation during AI generation
 * 3. Strict visibility control for "Copy Output" & "Download PDF" buttons
 * 4. Fixed PDF export word-spacing, margins, and typography via pdf-lib
 * 5. Micro-seeded unique responses & natural everyday/professional prose
 */

(function () {
  'use strict';

  // 1. Ensure pdf-lib is available for clean PDF generation
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

  // 2. Inject CSS for Percentage Progress Button, Logo Animation & Action Bar
  const injectStyles = () => {
    if (document.getElementById('ai-progress-ext-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-progress-ext-styles';
    style.textContent = `
      /* Sleek Percentage Loader Button */
      .ai-ext-btn-loading {
        position: relative !important;
        pointer-events: none !important;
        overflow: hidden !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        transition: all 0.3s ease !important;
        z-index: 1 !important;
      }
      .ai-ext-btn-progress-fill {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        bottom: 0 !important;
        width: 0%;
        background: rgba(255, 255, 255, 0.22) !important;
        transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1) !important;
        z-index: -1 !important;
        pointer-events: none !important;
      }
      .ai-ext-pct-badge {
        background: rgba(0, 0, 0, 0.28) !important;
        color: #ffffff !important;
        padding: 2px 8px !important;
        border-radius: 999px !important;
        font-size: 0.8rem !important;
        font-weight: 700 !important;
        letter-spacing: 0.3px !important;
        font-variant-numeric: tabular-nums !important;
      }

      /* Website Logo Animation inside Active Tool Card / Header */
      @keyframes aiExtLogoPulseSpin {
        0% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 0px rgba(56, 189, 248, 0)); }
        50% { transform: scale(1.14) rotate(8deg); filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.75)); }
        100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 0px rgba(56, 189, 248, 0)); }
      }
      .ai-ext-logo-animating {
        animation: aiExtLogoPulseSpin 1.1s infinite ease-in-out !important;
        transform-origin: center center !important;
      }

      /* Bottom Action Bar - Strictly hidden during generation */
      .ai-ext-bottom-actions {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 12px !important;
        margin-top: 18px !important;
        padding-top: 14px !important;
        border-top: 1px solid rgba(150, 150, 150, 0.22) !important;
        width: 100% !important;
        opacity: 1;
        transition: opacity 0.25s ease !important;
      }
      body.ai-ext-is-generating .ai-ext-bottom-actions,
      .ai-ext-bottom-actions.ai-ext-hidden {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      .ai-ext-action-btn {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 9px 16px !important;
        border-radius: 8px !important;
        font-size: 0.9rem !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: transform 0.15s ease, box-shadow 0.2s ease !important;
        border: none !important;
        color: #ffffff !important;
      }
      .ai-ext-action-btn:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18) !important;
      }
      .ai-ext-btn-copy {
        background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
      }
      .ai-ext-btn-pdf {
        background: linear-gradient(135deg, #059669, #047857) !important;
      }
      .ai-ext-hidden-stray {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  };

  // 3. Natural Prose & Unique Micro-Seed Injector
  const buildEnhancedPrompt = (originalText) => {
    if (!originalText || typeof originalText !== 'string') return originalText;
    if (originalText.includes('[Variation-ID:')) return originalText;

    const timeHash = Date.now().toString(36).toUpperCase();
    const randomSeed = Math.random().toString(36).substring(2, 8).toUpperCase();
    const microSeed = `${timeHash}-${randomSeed}`;

    const instruction =
      `\n\n[Style & Uniqueness Instructions: Write in a natural, clear, and engaging mix of everyday and standard professional English. ` +
      `Ensure proper word spacing, clean paragraph breaks, and smooth human phrasing without weird punctuation blocks or robotic formatting. ` +
      `Generate a fresh, unique variation every time. Variation-ID: ${microSeed}]`;

    return `${originalText.trim()}${instruction}`;
  };

  const mutateRequestPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return payload;

    // OpenAI / Groq / DeepSeek chat messages format
    if (Array.isArray(payload.messages)) {
      for (let i = payload.messages.length - 1; i >= 0; i--) {
        if (payload.messages[i].role === 'user' && typeof payload.messages[i].content === 'string') {
          payload.messages[i].content = buildEnhancedPrompt(payload.messages[i].content);
          break;
        }
      }
    }

    // Gemini API contents format
    if (Array.isArray(payload.contents)) {
      const last = payload.contents[payload.contents.length - 1];
      if (last && Array.isArray(last.parts)) {
        for (let i = last.parts.length - 1; i >= 0; i--) {
          if (typeof last.parts[i].text === 'string') {
            last.parts[i].text = buildEnhancedPrompt(last.parts[i].text);
            break;
          }
        }
      }
    }

    // Generic prompt fields
    ['prompt', 'input', 'text', 'query', 'message'].forEach((key) => {
      if (typeof payload[key] === 'string') {
        payload[key] = buildEnhancedPrompt(payload[key]);
      }
    });

    return payload;
  };

  // 4. State Tracking & Network Interceptors
  let activeRequests = 0;
  let isGeneratingState = false;
  const activeButtons = new Map();

  const setGeneratingFlag = (generating) => {
    isGeneratingState = generating;
    if (generating) {
      document.body.classList.add('ai-ext-is-generating');
      hideAllBottomActionBars();
    } else {
      document.body.classList.remove('ai-ext-is-generating');
    }
  };

  const notifyRequestStart = () => {
    activeRequests++;
    setGeneratingFlag(true);
  };

  const notifyRequestEnd = () => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) {
      completeAllButtonAnimations();
    }
  };

  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : (input && input.url) || '';

    if (init && init.body && typeof init.body === 'string') {
      try {
        const parsed = JSON.parse(init.body);
        init.body = JSON.stringify(mutateRequestPayload(parsed));
      } catch (e) {
        // Non-JSON body
      }
    } else if (typeof url === 'string' && (url.includes('pollinations') || url.includes('prompt='))) {
      const seed = `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5)}`;
      const sep = url.includes('?') ? '&' : '?';
      input = `${url}${sep}seed=${seed}`;
    }

    notifyRequestStart();
    try {
      return await originalFetch.apply(this, [input, init]);
    } finally {
      notifyRequestEnd();
    }
  };

  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    if (body && typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        body = JSON.stringify(mutateRequestPayload(parsed));
      } catch (e) {
        // Ignore non-JSON
      }
    }
    notifyRequestStart();
    this.addEventListener('loadend', () => notifyRequestEnd());
    return originalXHRSend.call(this, body);
  };

  // 5. Animate Website Logo inside Active Tool Card or Header
  const toggleLogoAnimation = (btn, shouldAnimate) => {
    const scope =
      (btn && btn.closest('.tool-card, .card, .workspace, .tool-workspace, .tool-container, section, main')) ||
      document;

    const logoSelectors = [
      'img[alt*="logo" i]',
      'img[src*="logo" i]',
      '.logo',
      '.brand-logo',
      '.site-logo',
      '.tool-logo',
      '.card-icon i',
      '.tool-icon i',
      'header img',
      '.navbar-brand img',
      '.navbar-brand i'
    ];

    const logos = scope.querySelectorAll(logoSelectors.join(', '));
    const targetLogos = logos.length > 0 ? logos : document.querySelectorAll(logoSelectors.join(', '));

    targetLogos.forEach((el) => {
      if (shouldAnimate) {
        el.classList.add('ai-ext-logo-animating');
      } else {
        el.classList.remove('ai-ext-logo-animating');
      }
    });
  };

  // 6. Step-by-Step Percentage Loader (25%, 50%, 75%, 100%)
  const progressSteps = [
    { pct: 25, text: 'Generating speech...', icon: 'fa-solid fa-brain fa-beat-fade' },
    { pct: 50, text: 'Adding tone...', icon: 'fa-solid fa-wand-magic-sparkles fa-beat-fade' },
    { pct: 75, text: 'Checking...', icon: 'fa-solid fa-magnifying-glass-chart fa-beat-fade' },
    { pct: 100, text: 'Giving final touch...', icon: 'fa-solid fa-circle-notch fa-spin' }
  ];

  const renderButtonStep = (btn, stepObj) => {
    btn.innerHTML = `
      <span class="ai-ext-btn-progress-fill" style="width: ${stepObj.pct}%;"></span>
      <i class="${stepObj.icon}"></i>
      <span>${stepObj.text}</span>
      <span class="ai-ext-pct-badge">${stepObj.pct}%</span>
    `;
  };

  const startButtonAnimation = (btn) => {
    if (!btn || activeButtons.has(btn)) return;

    setGeneratingFlag(true);
    removeStrayCopyButtons();
    hideAllBottomActionBars();
    toggleLogoAnimation(btn, true);

    const originalHTML = btn.innerHTML;
    const originalDisabled = btn.disabled;
    let currentStep = 0;

    btn.classList.add('ai-ext-btn-loading');
    btn.disabled = true;

    // Immediately show 25% ("Generating speech...")
    renderButtonStep(btn, progressSteps[0]);

    // Advance through 50% and 75%, holding at 75% until completion triggers 100%
    const intervalId = setInterval(() => {
      if (currentStep < 2) {
        currentStep++;
        renderButtonStep(btn, progressSteps[currentStep]);
      }
    }, 1100);

    // Fallback safety timer in case a tool runs purely client-side without fetch/XHR
    const fallbackTimer = setTimeout(() => {
      if (activeRequests === 0) {
        completeButtonAnimation(btn);
      }
    }, 10000);

    activeButtons.set(btn, {
      originalHTML,
      originalDisabled,
      intervalId,
      fallbackTimer
    });
  };

  const completeButtonAnimation = (btn) => {
    const state = activeButtons.get(btn);
    if (!state || state.completing) return;
    state.completing = true;

    clearInterval(state.intervalId);
    clearTimeout(state.fallbackTimer);

    // Show 100% "Giving final touch..." briefly before revealing output actions
    renderButtonStep(btn, progressSteps[3]);

    setTimeout(() => {
      btn.classList.remove('ai-ext-btn-loading');
      btn.innerHTML = state.originalHTML;
      btn.disabled = state.originalDisabled;
      toggleLogoAnimation(btn, false);
      activeButtons.delete(btn);

      if (activeButtons.size === 0) {
        setGeneratingFlag(false);
        removeStrayCopyButtons();
        enhanceAllResultBoxes();
      }
    }, 550);
  };

  const completeAllButtonAnimations = () => {
    activeButtons.forEach((_, btn) => completeButtonAnimation(btn));
  };

  // 7. Strict Stray Button Removal & Visibility Control
  const removeStrayCopyButtons = () => {
    const allButtons = document.querySelectorAll('button, a.btn, .btn, [role="button"]');
    allButtons.forEach((btn) => {
      if (btn.classList.contains('ai-ext-action-btn')) return;

      const text = (btn.textContent || '').trim().toLowerCase();
      const isStrayAction =
        text.includes('copy output') ||
        text === 'copy' ||
        text.includes('copy text') ||
        text.includes('copy result') ||
        text.includes('download pdf') ||
        text.includes('export pdf');

      if (isStrayAction) {
        btn.classList.add('ai-ext-hidden-stray');
      }
    });
  };

  const hideAllBottomActionBars = () => {
    document.querySelectorAll('.ai-ext-bottom-actions').forEach((bar) => {
      bar.classList.add('ai-ext-hidden');
    });
  };

  // 8. Clean Text Extractor (Fixes Glued Words Bug like "Quickreminder Homeworkduethis")
  const extractSpacedCleanText = (container) => {
    if (!container) return '';
    const clone = container.cloneNode(true);

    // Remove our bottom action buttons from the cloned node
    clone.querySelectorAll('.ai-ext-bottom-actions, script, style').forEach((el) => el.remove());

    // Insert explicit spaces/newlines around block and inline elements so textContent never glues words
    const blockTags = new Set([
      'P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'TR', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'PRE'
    ]);

    const walk = (node) => {
      if (node.nodeType === 1) {
        const tag = node.tagName.toUpperCase();
        if (tag === 'BR') {
          node.replaceWith(document.createTextNode('\n'));
          return;
        }
        // Add space after inline elements (spans, strong, em, a, td) so adjacent tags don't concatenate
        if (!blockTags.has(tag)) {
          node.insertAdjacentText('beforebegin', ' ');
          node.insertAdjacentText('afterend', ' ');
        } else {
          node.insertAdjacentText('beforebegin', '\n');
          node.insertAdjacentText('afterend', '\n');
        }
        Array.from(node.childNodes).forEach(walk);
      }
    };

    Array.from(clone.childNodes).forEach(walk);

    let raw = clone.textContent || '';

    // Normalize non-breaking spaces and tabs into standard ASCII spaces
    raw = raw.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\t]+/g, ' ');

    // Fix camelCase / punctuation glued boundaries if the AI model omitted a space after punctuation
    raw = raw
      .replace(/([.!?:;])([A-Za-z])/g, '$1 $2')
      .replace(/([a-z])([A-Z])/g, '$1 $2');

    // Collapse multiple spaces on the same line while preserving paragraph newlines
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim());

    // Keep clean single blank lines between paragraphs
    return lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // 9. Fixed PDF Export via pdf-lib with Proper Word Spacing, Margins & Typography
  const downloadCleanPDF = async (cleanText) => {
    if (!cleanText) return;
    const filename = `AI-Document-${Date.now().toString(36).toUpperCase()}.pdf`;

    try {
      const PDFLib = await ensurePdfLib();
      const { PDFDocument, StandardFonts, rgb } = PDFLib;

      const pdfDoc = await PDFDocument.create();
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageWidth = 595.28; // A4 width in pt
      const pageHeight = 841.89; // A4 height in pt
      const margin = 54; // Clean 0.75 inch margin on all sides
      const usableWidth = pageWidth - margin * 2;
      const fontSize = 11.5;
      const lineHeight = 18;
      const spaceWidth = regularFont.widthOfTextAtSize(' ', fontSize);

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let cursorY = pageHeight - margin;

      // Draw subtle document header on page 1
      page.drawText('AI Generated Response', {
        x: margin,
        y: cursorY,
        size: 14,
        font: boldFont,
        color: rgb(0.12, 0.25, 0.55)
      });
      cursorY -= 10;
      page.drawLine({
        start: { x: margin, y: cursorY },
        end: { x: pageWidth - margin, y: cursorY },
        thickness: 0.75,
        color: rgb(0.82, 0.85, 0.9)
      });
      cursorY -= 24;

      // Normalize smart quotes/dashes to clean WinAnsi characters so pdf-lib never drops characters
      const normalizedText = cleanText
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/[^\x20-\x7E\n\r]/g, ' ');

      const paragraphs = normalizedText.split(/\r?\n/);

      for (const rawPara of paragraphs) {
        const para = rawPara.replace(/\s+/g, ' ').trim();

        // Preserve blank lines as paragraph spacing
        if (!para) {
          cursorY -= lineHeight * 0.65;
          if (cursorY < margin + lineHeight) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            cursorY = pageHeight - margin;
          }
          continue;
        }

        // Split into individual words and measure with explicit spaceWidth
        const words = para.split(' ').filter(Boolean);
        let lineWords = [];
        let currentLineWidth = 0;

        const flushLine = (wordsArray) => {
          if (wordsArray.length === 0) return;
          if (cursorY < margin + lineHeight) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            cursorY = pageHeight - margin;
          }
          const lineString = wordsArray.join(' ');
          page.drawText(lineString, {
            x: margin,
            y: cursorY,
            size: fontSize,
            font: regularFont,
            color: rgb(0.12, 0.14, 0.18)
          });
          cursorY -= lineHeight;
        };

        for (const word of words) {
          const wordWidth = regularFont.widthOfTextAtSize(word, fontSize);
          const additionalWidth = lineWords.length === 0 ? wordWidth : spaceWidth + wordWidth;

          if (currentLineWidth + additionalWidth > usableWidth && lineWords.length > 0) {
            flushLine(lineWords);
            lineWords = [word];
            currentLineWidth = wordWidth;
          } else {
            lineWords.push(word);
            currentLineWidth += additionalWidth;
          }
        }

        if (lineWords.length > 0) {
          flushLine(lineWords);
        }

        // Extra breathing room after each paragraph
        cursorY -= 6;
      }

      // Add page numbers at the footer of every page
      const allPages = pdfDoc.getPages();
      allPages.forEach((p, idx) => {
        const footerText = `Page ${idx + 1} of${allPages.length}`;
        const fw = regularFont.widthOfTextAtSize(footerText, 9);
        p.drawText(footerText, {
          x: (pageWidth - fw) / 2,
          y: 28,
          size: 9,
          font: regularFont,
          color: rgb(0.5, 0.55, 0.6)
        });
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.error('PDF export error:', err);
    }
  };

  // 10. Manage Result Containers & Bottom Action Buttons
  const isResultContainer = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const id = (el.id || '').toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();

    return (
      id.includes('output') ||
      id.includes('result') ||
      id.includes('response') ||
      cls.includes('ai-output') ||
      cls.includes('result-box') ||
      cls.includes('output-box') ||
      cls.includes('response-box') ||
      el.hasAttribute('data-ai-output')
    );
  };

  const enhanceResultBox = (box) => {
    if (!box) return;

    // Strictly hide action buttons while generation is active
    if (isGeneratingState || activeButtons.size > 0 || activeRequests > 0) {
      const existingBar = box.querySelector('.ai-ext-bottom-actions');
      if (existingBar) existingBar.classList.add('ai-ext-hidden');
      return;
    }

    const cleanText = extractSpacedCleanText(box);
    const isPlaceholder =
      !cleanText ||
      cleanText.length < 12 ||
      /^(generating|loading|thinking|please wait|adding tone|checking|giving final touch|your .* will appear)/i.test(cleanText);

    let actionBar = box.querySelector('.ai-ext-bottom-actions');

    if (isPlaceholder) {
      if (actionBar) actionBar.remove();
      return;
    }

    if (!actionBar) {
      actionBar = document.createElement('div');
      actionBar.className = 'ai-ext-bottom-actions';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'ai-ext-action-btn ai-ext-btn-copy';
      copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> <span>Copy Output</span>';

      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const textToCopy = extractSpacedCleanText(box);
        try {
          await navigator.clipboard.writeText(textToCopy);
        } catch (err) {
          const ta = document.createElement('textarea');
          ta.value = textToCopy;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Copied!</span>';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> <span>Copy Output</span>';
        }, 2000);
      });

      const pdfBtn = document.createElement('button');
      pdfBtn.type = 'button';
      pdfBtn.className = 'ai-ext-action-btn ai-ext-btn-pdf';
      pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> <span>Download PDF</span>';

      pdfBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const textToExport = extractSpacedCleanText(box);
        const orig = pdfBtn.innerHTML;
        pdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Building PDF...</span>';
        await downloadCleanPDF(textToExport);
        pdfBtn.innerHTML = orig;
      });

      actionBar.appendChild(copyBtn);
      actionBar.appendChild(pdfBtn);
      box.appendChild(actionBar);
    } else {
      actionBar.classList.remove('ai-ext-hidden');
      if (box.lastElementChild !== actionBar) {
        box.appendChild(actionBar);
      }
    }
  };

  const enhanceAllResultBoxes = () => {
    const boxes = document.querySelectorAll(
      '[id*="output" i], [id*="result" i], [id*="response" i], ' +
      '[class*="output" i], [class*="result" i], [class*="response" i]'
    );
    boxes.forEach((box) => {
      if (isResultContainer(box)) enhanceResultBox(box);
    });
  };

  // 11. Detect Generate Button Clicks & Observe DOM
  const isGenerateButton = (btn) => {
    if (!btn || btn.classList.contains('ai-ext-action-btn')) return false;
    const text = (btn.textContent || '').trim().toLowerCase();
    const id = (btn.id || '').toLowerCase();
    const cls = (typeof btn.className === 'string' ? btn.className : '').toLowerCase();

    const triggerWords = [
      'generate', 'create', 'write', 'summarize', 'paraphrase',
      'analyze', 'solve', 'explain', 'humanize', 'enhance',
      'translate', 'check', 'submit', 'run ai', 'ask ai'
    ];

    return (
      triggerWords.some((w) => text.includes(w)) ||
      id.includes('generate') ||
      cls.includes('generate') ||
      (btn.getAttribute('onclick') || '').toLowerCase().includes('generate')
    );
  };

  const init = () => {
    injectStyles();
    ensurePdfLib().catch(() => {});
    removeStrayCopyButtons();
    enhanceAllResultBoxes();

    document.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest('button, a.btn, .btn, [role="button"]');
        if (btn && isGenerateButton(btn)) {
          startButtonAnimation(btn);
        }
      },
      true
    );

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.target && m.target.closest && m.target.closest('.ai-ext-bottom-actions')) {
          continue;
        }
        removeStrayCopyButtons();
        if (!isGeneratingState && activeButtons.size === 0) {
          enhanceAllResultBoxes();
        }
        break;
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
