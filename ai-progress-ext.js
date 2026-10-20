/**
 * ai-progress-ext.js
 * Self-contained extension for:
 * 1. Universal real-time proportional progress counter (smoothly ticking 1% -> 99% -> 100%)
 *    across all AI tool cards (Writing Assistant, Text Summariser, Grammar & Tone Improver,
 *    Dedicated Email Helper, Code & Syntax Explainer, and AI Prompt Enhancer).
 * 2. Dynamic step-by-step status messages & active logo pulse animation.
 * 3. Strict visibility control hiding "Copy Output" & "Download PDF" during generation.
 * 4. Glued-word fix & clean typography when exporting AI outputs via pdf-lib.
 * 5. Micro-seeded unique responses & natural everyday/professional prose.
 */

(function () {
  'use strict';

  // 1. Ensure pdf-lib is loaded for clean PDF exports
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

  // 2. Inject CSS for Real-Time Proportional Progress Bar & Action Buttons
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
        transition: transform 0.2s ease, box-shadow 0.2s ease !important;
        z-index: 1 !important;
      }
      .ai-ext-btn-progress-fill {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        bottom: 0 !important;
        width: 0%;
        background: linear-gradient(90deg, rgba(255,255,255,0.18), rgba(255,255,255,0.34)) !important;
        transition: width 0.08s linear !important;
        z-index: -1 !important;
        pointer-events: none !important;
      }
      .ai-ext-pct-badge {
        background: rgba(0, 0, 0, 0.32) !important;
        color: #ffffff !important;
        padding: 2px 9px !important;
        border-radius: 999px !important;
        font-size: 0.82rem !important;
        font-weight: 700 !important;
        letter-spacing: 0.3px !important;
        font-variant-numeric: tabular-nums !important;
        min-width: 46px !important;
        text-align: center !important;
      }

      /* Active Tool Card & Website Logo Pulse */
      @keyframes aiExtLogoPulseSpin {
        0% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 0px rgba(56, 189, 248, 0)); }
        50% { transform: scale(1.14) rotate(8deg); filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.8)); }
        100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 0px rgba(56, 189, 248, 0)); }
      }
      .ai-ext-logo-animating {
        animation: aiExtLogoPulseSpin 1.1s infinite ease-in-out !important;
        transform-origin: center center !important;
      }

      /* Strictly hide bottom actions while generating */
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
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
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

    if (Array.isArray(payload.messages)) {
      for (let i = payload.messages.length - 1; i >= 0; i--) {
        if (payload.messages[i].role === 'user' && typeof payload.messages[i].content === 'string') {
          payload.messages[i].content = buildEnhancedPrompt(payload.messages[i].content);
          break;
        }
      }
    }

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

    ['prompt', 'input', 'text', 'query', 'message', 'content', 'code'].forEach((key) => {
      if (typeof payload[key] === 'string') {
        payload[key] = buildEnhancedPrompt(payload[key]);
      }
    });

    return payload;
  };

  // 4. Network Request Interception & State Management
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
        // Ignore non-JSON body
      }
    } else if (typeof url === 'string' && (url.includes('pollinations') || url.includes('prompt='))) {
      const seed = `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
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

  // 5. Logo Animation Controller
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

  // 6. True Proportional Real-Time Progress Engine (Smooth 1% -> 99% -> 100%)
  const getStageForPercentage = (pct) => {
    if (pct < 30) {
      return { text: 'Generating speech...', icon: 'fa-solid fa-brain fa-beat-fade' };
    }
    if (pct < 60) {
      return { text: 'Adding tone...', icon: 'fa-solid fa-wand-magic-sparkles fa-beat-fade' };
    }
    if (pct < 88) {
      return { text: 'Checking...', icon: 'fa-solid fa-magnifying-glass-chart fa-beat-fade' };
    }
    return { text: 'Giving final touch...', icon: 'fa-solid fa-circle-notch fa-spin' };
  };

  const updateButtonDOM = (btn, pct) => {
    const rounded = Math.min(100, Math.max(1, Math.floor(pct)));
    const stage = getStageForPercentage(rounded);

    let fillEl = btn.querySelector('.ai-ext-btn-progress-fill');
    let iconEl = btn.querySelector('.ai-ext-stage-icon');
    let textEl = btn.querySelector('.ai-ext-stage-text');
    let badgeEl = btn.querySelector('.ai-ext-pct-badge');

    if (!fillEl || !iconEl || !textEl || !badgeEl) {
      btn.innerHTML = `
        <span class="ai-ext-btn-progress-fill" style="width: ${rounded}%;"></span>
        <i class="ai-ext-stage-icon ${stage.icon}"></i>
        <span class="ai-ext-stage-text">${stage.text}</span>
        <span class="ai-ext-pct-badge">${rounded}%</span>
      `;
    } else {
      fillEl.style.width = `${rounded}%`;
      if (iconEl.className !== `ai-ext-stage-icon ${stage.icon}`) {
        iconEl.className = `ai-ext-stage-icon ${stage.icon}`;
      }
      if (textEl.textContent !== stage.text) {
        textEl.textContent = stage.text;
      }
      badgeEl.textContent = `${rounded}%`;
    }
  };

  const startButtonAnimation = (btn) => {
    if (!btn || activeButtons.has(btn)) return;

    setGeneratingFlag(true);
    removeStrayCopyButtons();
    hideAllBottomActionBars();
    toggleLogoAnimation(btn, true);

    const originalHTML = btn.innerHTML;
    const originalDisabled = btn.disabled;

    btn.classList.add('ai-ext-btn-loading');
    btn.disabled = true;

    let currentPct = 1;
    const startTime = performance.now();
    updateButtonDOM(btn, currentPct);

    const state = {
      originalHTML,
      originalDisabled,
      rafId: null,
      fallbackTimer: null,
      completing: false,
      currentPct: 1
    };

    // Smooth real-time proportional curve: moves steadily early on and asymptotically approaches 99%
    const tick = (now) => {
      if (state.completing) return;
      const elapsedSeconds = (now - startTime) / 1000;

      // Asymptotic formula: 99 * (1 - e^(-t / 3.2)) gives natural continuous 1% increments
      const targetPct = Math.min(99, 1 + 98 * (1 - Math.exp(-elapsedSeconds / 3.2)));
      if (targetPct > state.currentPct) {
        state.currentPct = targetPct;
        updateButtonDOM(btn, state.currentPct);
      }
      state.rafId = requestAnimationFrame(tick);
    };

    state.rafId = requestAnimationFrame(tick);

    // Fallback safety timer in case a tool runs locally without network calls
    state.fallbackTimer = setTimeout(() => {
      if (activeRequests === 0) {
        completeButtonAnimation(btn);
      }
    }, 10000);

    activeButtons.set(btn, state);
  };

  const completeButtonAnimation = (btn) => {
    const state = activeButtons.get(btn);
    if (!state || state.completing) return;
    state.completing = true;

    if (state.rafId) cancelAnimationFrame(state.rafId);
    if (state.fallbackTimer) clearTimeout(state.fallbackTimer);

    // Smoothly ramp from currentPct to 100% over 260ms
    const startPct = state.currentPct || 90;
    const rampStart = performance.now();
    const rampDuration = 260;

    const finishRamp = (now) => {
      const progress = Math.min(1, (now - rampStart) / rampDuration);
      const interpolated = startPct + (100 - startPct) * progress;
      updateButtonDOM(btn, interpolated);

      if (progress < 1) {
        requestAnimationFrame(finishRamp);
      } else {
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
        }, 220);
      }
    };

    requestAnimationFrame(finishRamp);
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

  // 8. Clean Spaced Text Extractor (Prevents Glued Words in PDF Export)
  const extractSpacedCleanText = (container) => {
    if (!container) return '';
    const clone = container.cloneNode(true);

    clone.querySelectorAll('.ai-ext-bottom-actions, script, style').forEach((el) => el.remove());

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
    raw = raw.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\t]+/g, ' ');
    raw = raw
      .replace(/([.!?:;])([A-Za-z])/g, '$1 $2')
      .replace(/([a-z])([A-Z])/g, '$1 $2');

    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim());

    return lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // 9. Clean PDF Export via pdf-lib
  const downloadCleanPDF = async (cleanText) => {
    if (!cleanText) return;
    const filename = `AI-Output-${Date.now().toString(36).toUpperCase()}.pdf`;

    try {
      const PDFLib = await ensurePdfLib();
      const { PDFDocument, StandardFonts, rgb } = PDFLib;

      const pdfDoc = await PDFDocument.create();
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 54;
      const usableWidth = pageWidth - margin * 2;
      const fontSize = 11.5;
      const lineHeight = 18;
      const spaceWidth = regularFont.widthOfTextAtSize(' ', fontSize);

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let cursorY = pageHeight - margin;

      page.drawText('AI Generated Document', {
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

      const normalizedText = cleanText
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/[^\x20-\x7E\n\r]/g, ' ');

      const paragraphs = normalizedText.split(/\r?\n/);

      for (const rawPara of paragraphs) {
        const para = rawPara.replace(/\s+/g, ' ').trim();

        if (!para) {
          cursorY -= lineHeight * 0.65;
          if (cursorY < margin + lineHeight) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            cursorY = pageHeight - margin;
          }
          continue;
        }

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

        cursorY -= 6;
      }

      const allPages = pdfDoc.getPages();
      allPages.forEach((p, idx) => {
        const footerText = `Page ${idx + 1} of ${allPages.length}`;
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

    if (isGeneratingState || activeButtons.size > 0 || activeRequests > 0) {
      const existingBar = box.querySelector('.ai-ext-bottom-actions');
      if (existingBar) existingBar.classList.add('ai-ext-hidden');
      return;
    }

    const cleanText = extractSpacedCleanText(box);
    const isPlaceholder =
      !cleanText ||
      cleanText.length < 12 ||
      /^(generating|loading|thinking|please wait|adding tone|checking|giving final touch|your .* will appear|output will appear)/i.test(
        cleanText
      );

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

  // 11. Universal AI Tool Generate Button Detection (Covers all 6 AI Tools)
  const isUniversalAIGenerateButton = (btn) => {
    if (!btn || btn.classList.contains('ai-ext-action-btn')) return false;
    // Ignore buttons inside the PDF editor studio
    if (btn.closest('.nova-pdf-studio')) return false;

    const text = (btn.textContent || '').trim().toLowerCase();
    const id = (btn.id || '').toLowerCase();
    const cls = (typeof btn.className === 'string' ? btn.className : '').toLowerCase();
    const onclick = (btn.getAttribute('onclick') || '').toLowerCase();

    // Exclude navigation, close, reset, or clear buttons
    if (/^(back|close|cancel|reset|clear|copy|download|upload|browse|choose)/i.test(text)) {
      return false;
    }

    // Match explicit keywords across Writing Assistant, Text Summariser, Grammar & Tone Improver,
    // Dedicated Email Helper, Code & Syntax Explainer, and AI Prompt Enhancer
    const triggerWords = [
      'generate',
      'write',
      'assist',
      'summar', // summarise / summarize
      'grammar',
      'tone',
      'improve',
      'email',
      'draft',
      'reply',
      'compose',
      'code',
      'syntax',
      'explain',
      'debug',
      'prompt',
      'enhance',
      'optimize',
      'refine',
      'paraphrase',
      'rewrite',
      'humanize',
      'analyze',
      'create',
      'run ai',
      'ask ai',
      'submit',
      'process',
      'transform',
      'convert',
      'polished',
      'check'
    ];

    const matchesKeyword =
      triggerWords.some((w) => text.includes(w)) ||
      triggerWords.some((w) => id.includes(w)) ||
      triggerWords.some((w) => onclick.includes(w)) ||
      cls.includes('generate') ||
      cls.includes('ai-btn');

    if (matchesKeyword) return true;

    // Contextual check: Primary action button inside any card/workspace containing a textarea or AI tool heading
    const container = btn.closest(
      '.tool-card, .card, .workspace, .tool-workspace, .tool-container, .ai-tool, form, section'
    );
    if (container) {
      const hasPromptInput = container.querySelector('textarea, input[type="text"]');
      const heading = container.querySelector('h1, h2, h3, h4, .card-title, .tool-title');
      const headingText = heading ? heading.textContent.toLowerCase() : '';
      const isKnownAITool =
        /writing|summar|grammar|tone|email|code|syntax|prompt|ai\s/i.test(headingText);

      if ((hasPromptInput || isKnownAITool) && (btn.type === 'submit' || btn.tagName === 'BUTTON')) {
        return true;
      }
    }

    return false;
  };

  const init = () => {
    injectStyles();
    ensurePdfLib().catch(() => {});
    removeStrayCopyButtons();
    enhanceAllResultBoxes();

    document.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest('button, a.btn, .btn, [role="button"], input[type="submit"]');
        if (btn && isUniversalAIGenerateButton(btn)) {
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
        } else {
          // If an output box just finished populating in the DOM while no network calls remain, finish smoothly
          const populatedBoxes = document.querySelectorAll(
            '[id*="output" i], [id*="result" i], [class*="output" i], [class*="result" i]'
          );
          populatedBoxes.forEach((box) => {
            if (isResultContainer(box)) {
              const txt = extractSpacedCleanText(box);
              if (
                txt.length > 25 &&
                !/^(generating|loading|thinking|please wait)/i.test(txt) &&
                activeRequests === 0 &&
                activeButtons.size > 0
              ) {
                completeAllButtonAnimations();
              }
            }
          });
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
