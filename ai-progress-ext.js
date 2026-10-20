/**
 * ai-progress-ext.js
 * Self-contained extension for AI button animations, natural prose enforcement,
 * unique micro-seeded responses, and clean bottom action buttons.
 */

(function () {
  'use strict';

  // 1. Inject custom styles for sleek animations and unified bottom action buttons
  const injectStyles = () => {
    if (document.getElementById('ai-progress-ext-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-progress-ext-styles';
    style.textContent = `
      .ai-ext-btn-loading {
        position: relative !important;
        pointer-events: none !important;
        opacity: 0.92 !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
      }
      .ai-ext-icon-pulse {
        animation: aiExtPulse 1.2s infinite ease-in-out;
      }
      @keyframes aiExtPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.18); opacity: 0.8; }
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
        transition: transform 0.15s ease, opacity 0.2s ease !important;
        border: 1px solid rgba(150, 150, 150, 0.3) !important;
      }
      .ai-ext-action-btn:hover {
        transform: translateY(-1px) !important;
      }
      .ai-ext-action-btn:active {
        transform: translateY(0) !important;
      }
      .ai-ext-btn-copy {
        background: #2563eb !important;
        color: #ffffff !important;
        border-color: #1d4ed8 !important;
      }
      .ai-ext-btn-pdf {
        background: #10b981 !important;
        color: #ffffff !important;
        border-color: #059669 !important;
      }
      .ai-ext-hidden-stray {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  };

  // 2. Persona & Micro-Seed Prompt Enhancer
  const buildEnhancedPrompt = (originalText) => {
    if (!originalText || typeof originalText !== 'string') return originalText;
    // Avoid double-injecting if already processed
    if (originalText.includes('[Variation-Seed:')) return originalText;

    const timestamp = Date.now().toString(36);
    const randomHash = Math.random().toString(36).substring(2, 8).toUpperCase();
    const microSeed = `${timestamp}-${randomHash}`;

    const personaInstruction =
      `\n\n[Writing Guidelines: Write in a natural, clear mix of everyday and standard professional English. ` +
      `Use smooth, human-sounding prose. Avoid robotic formatting, awkward punctuation blocks, or overly complex academic jargon. ` +
      `Provide a fresh, unique perspective for this request. Variation-Seed: ${microSeed}]`;

    return `${originalText.trim()}${personaInstruction}`;
  };

  // Recursively traverse payload objects (OpenAI, Gemini, Anthropic, or generic JSON formats)
  const mutateRequestPayload = (payloadObj) => {
    if (!payloadObj || typeof payloadObj !== 'object') return payloadObj;

    // OpenAI / Groq / DeepSeek style: messages array
    if (Array.isArray(payloadObj.messages)) {
      for (let i = payloadObj.messages.length - 1; i >= 0; i--) {
        if (payloadObj.messages[i].role === 'user' && typeof payloadObj.messages[i].content === 'string') {
          payloadObj.messages[i].content = buildEnhancedPrompt(payloadObj.messages[i].content);
          break;
        }
      }
    }

    // Google Gemini API style: contents[].parts[].text
    if (Array.isArray(payloadObj.contents)) {
      const lastContent = payloadObj.contents[payloadObj.contents.length - 1];
      if (lastContent && Array.isArray(lastContent.parts)) {
        for (let i = lastContent.parts.length - 1; i >= 0; i--) {
          if (typeof lastContent.parts[i].text === 'string') {
            lastContent.parts[i].text = buildEnhancedPrompt(lastContent.parts[i].text);
            break;
          }
        }
      }
    }

    // Generic prompt / input / text fields
    ['prompt', 'input', 'text', 'query', 'message'].forEach((key) => {
      if (typeof payloadObj[key] === 'string') {
        payloadObj[key] = buildEnhancedPrompt(payloadObj[key]);
      }
    });

    return payloadObj;
  };

  // 3. Intercept Fetch & XMLHttpRequest to inject Persona + Micro-seed and track active state
  let activeRequests = 0;
  const activeButtons = new Map();

  const notifyRequestStart = () => {
    activeRequests++;
  };

  const notifyRequestEnd = () => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) {
      setTimeout(stopAllButtonAnimations, 250);
    }
  };

  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : (input && input.url) || '';

    // Check if this is an AI generation request or POST request with JSON body
    if (init && init.body && typeof init.body === 'string') {
      try {
        const parsed = JSON.parse(init.body);
        const mutated = mutateRequestPayload(parsed);
        init.body = JSON.stringify(mutated);
      } catch (e) {
        // Not JSON, ignore safely
      }
    } else if (typeof url === 'string' && (url.includes('pollinations') || url.includes('prompt='))) {
      // Handle GET-based AI endpoints (e.g., Pollinations text API)
      const seed = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const separator = url.includes('?') ? '&' : '?';
      const updatedUrl = `${url}${separator}seed=${seed}`;
      if (typeof input === 'string') {
        input = updatedUrl;
      }
    }

    notifyRequestStart();
    try {
      const response = await originalFetch.apply(this, [input, init]);
      return response;
    } finally {
      notifyRequestEnd();
    }
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._extUrl = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (body && typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        const mutated = mutateRequestPayload(parsed);
        body = JSON.stringify(mutated);
      } catch (e) {
        // Ignore non-JSON
      }
    }
    notifyRequestStart();
    this.addEventListener('loadend', () => notifyRequestEnd());
    return originalXHRSend.call(this, body);
  };

  // 4. Button Animation Controller
  const loadingStages = [
    { icon: 'fa-solid fa-brain ai-ext-icon-pulse', text: 'Analyzing context...' },
    { icon: 'fa-solid fa-wand-magic-sparkles ai-ext-icon-pulse', text: 'Crafting natural prose...' },
    { icon: 'fa-solid fa-bolt ai-ext-icon-pulse', text: 'Polishing unique response...' },
    { icon: 'fa-solid fa-circle-notch fa-spin', text: 'Finalizing output...' }
  ];

  const startButtonAnimation = (btn) => {
    if (!btn || activeButtons.has(btn)) return;

    // Remove stray top Copy Output buttons immediately on click
    removeStrayCopyButtons();

    const originalHTML = btn.innerHTML;
    const originalDisabled = btn.disabled;
    let stageIndex = 0;

    btn.classList.add('ai-ext-btn-loading');
    btn.disabled = true;

    const updateStage = () => {
      const stage = loadingStages[stageIndex % loadingStages.length];
      btn.innerHTML = `<i class="${stage.icon}"></i> <span>${stage.text}</span>`;
      stageIndex++;
    };

    updateStage();
    const intervalId = setInterval(updateStage, 1300);

    // Fallback safety timer in case the tool uses local/simulated timers instead of network calls
    const fallbackTimer = setTimeout(() => {
      if (activeRequests === 0) {
        stopButtonAnimation(btn);
      }
    }, 12000);

    activeButtons.set(btn, {
      originalHTML,
      originalDisabled,
      intervalId,
      fallbackTimer
    });
  };

  const stopButtonAnimation = (btn) => {
    const state = activeButtons.get(btn);
    if (!state) return;

    clearInterval(state.intervalId);
    clearTimeout(state.fallbackTimer);

    btn.classList.remove('ai-ext-btn-loading');
    btn.innerHTML = state.originalHTML;
    btn.disabled = state.originalDisabled;
    activeButtons.delete(btn);

    // Clean up stray buttons and attach bottom actions to populated result boxes
    setTimeout(() => {
      removeStrayCopyButtons();
      enhanceAllResultBoxes();
    }, 100);
  };

  const stopAllButtonAnimations = () => {
    activeButtons.forEach((_, btn) => stopButtonAnimation(btn));
  };

  // 5. Remove duplicate or stray "Copy Output" buttons near the top or generate area
  const removeStrayCopyButtons = () => {
    const allButtons = document.querySelectorAll('button, a.btn, .btn, [role="button"]');
    allButtons.forEach((btn) => {
      // Never hide our own bottom action buttons
      if (btn.classList.contains('ai-ext-action-btn')) return;

      const text = (btn.textContent || '').trim().toLowerCase();
      const isCopyOrAction =
        text.includes('copy output') ||
        text === 'copy' ||
        text.includes('copy text') ||
        text.includes('copy result') ||
        text.includes('download pdf') ||
        text.includes('export pdf');

      if (isCopyOrAction) {
        btn.classList.add('ai-ext-hidden-stray');
      }
    });
  };

  // 6. PDF Export Helper (Supports html2pdf, jsPDF, or clean print-to-PDF window)
  const downloadResultAsPDF = async (textContent, containerElement) => {
    const cleanText = (textContent || '').trim();
    if (!cleanText) return;

    const filename = `AI-Output-${Date.now().toString(36).toUpperCase()}.pdf`;

    // Option A: Use jsPDF if loaded in project
    if (window.jspdf && window.jspdf.jsPDF) {
      const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
      const margin = 40;
      const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
      const pageHeight = doc.internal.pageSize.getHeight() - margin * 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);

      const lines = doc.splitTextToSize(cleanText, pageWidth);
      let cursorY = margin + 10;

      lines.forEach((line) => {
        if (cursorY > pageHeight) {
          doc.addPage();
          cursorY = margin + 10;
        }
        doc.text(line, margin, cursorY);
        cursorY += 16;
      });

      doc.save(filename);
      return;
    }

    // Option B: Use pdf-lib if loaded in project
    if (window.PDFLib && window.PDFLib.PDFDocument) {
      try {
        const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 11;
        const lineHeight = 16;
        const margin = 45;

        let page = pdfDoc.addPage([595.28, 841.89]); // A4
        const { width, height } = page.getSize();
        const maxWidth = width - margin * 2;
        let y = height - margin;

        // Word-wrap paragraphs safely for StandardFonts (WinAnsi encoding safe)
        const safeText = cleanText.replace(/[^\x20-\x7E\n\r]/g, '');
        const paragraphs = safeText.split(/\r?\n/);

        for (const para of paragraphs) {
          if (!para.trim()) {
            y -= lineHeight;
            continue;
          }
          const words = para.split(' ');
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine ? `${currentLine}${word}` : word;
            const testWidth = font.widthOfTextAtSize(testLine, fontSize);
            if (testWidth > maxWidth && currentLine) {
              if (y < margin + lineHeight) {
                page = pdfDoc.addPage([595.28, 841.89]);
                y = height - margin;
              }
              page.drawText(currentLine, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
              y -= lineHeight;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) {
            if (y < margin + lineHeight) {
              page = pdfDoc.addPage([595.28, 841.89]);
              y = height - margin;
            }
            page.drawText(currentLine, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
            y -= lineHeight;
          }
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      } catch (err) {
        console.warn('pdf-lib fallback error, using print window:', err);
      }
    }

    // Option C: Fallback print window
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${filename}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; padding: 40px; color: #111827; white-space: pre-wrap; }
          </style>
        </head>
        <body>${cleanText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
        </html>
      `);
      printWin.document.close();
      printWin.focus();
      printWin.print();
    }
  };

  // 7. Attach strictly TWO bottom buttons ("Copy Output" & "Download PDF") to Result Boxes
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

    // Extract actual generated text excluding our action bar
    const clone = box.cloneNode(true);
    const existingBar = clone.querySelector('.ai-ext-bottom-actions');
    if (existingBar) existingBar.remove();

    const rawText = (clone.innerText || clone.textContent || '').trim();
    const isPlaceholder =
      !rawText ||
      rawText.length < 15 ||
      /^(generating|loading|thinking|please wait|your .* will appear here|output will appear)/i.test(rawText);

    let actionBar = box.querySelector('.ai-ext-bottom-actions');

    if (isPlaceholder) {
      if (actionBar) actionBar.remove();
      return;
    }

    // If generation finished and text is present, stop any lingering button animation
    if (activeButtons.size > 0 && activeRequests === 0) {
      stopAllButtonAnimations();
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
        const cleanClone = box.cloneNode(true);
        const barInClone = cleanClone.querySelector('.ai-ext-bottom-actions');
        if (barInClone) barInClone.remove();
        const textToCopy = (cleanClone.innerText || cleanClone.textContent || '').trim();

        try {
          await navigator.clipboard.writeText(textToCopy);
          copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Copied!</span>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> <span>Copy Output</span>';
          }, 2000);
        } catch (err) {
          // Fallback textarea copy
          const temp = document.createElement('textarea');
          temp.value = textToCopy;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          temp.remove();
          copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Copied!</span>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> <span>Copy Output</span>';
          }, 2000);
        }
      });

      const pdfBtn = document.createElement('button');
      pdfBtn.type = 'button';
      pdfBtn.className = 'ai-ext-action-btn ai-ext-btn-pdf';
      pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> <span>Download PDF</span>';

      pdfBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cleanClone = box.cloneNode(true);
        const barInClone = cleanClone.querySelector('.ai-ext-bottom-actions');
        if (barInClone) barInClone.remove();
        const textToSave = (cleanClone.innerText || cleanClone.textContent || '').trim();

        const originalHTML = pdfBtn.innerHTML;
        pdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Preparing PDF...</span>';
        await downloadResultAsPDF(textToSave, box);
        pdfBtn.innerHTML = originalHTML;
      });

      actionBar.appendChild(copyBtn);
      actionBar.appendChild(pdfBtn);
      box.appendChild(actionBar);
    } else {
      // Ensure actionBar stays at the very bottom of the result container
      if (box.lastElementChild !== actionBar) {
        box.appendChild(actionBar);
      }
    }
  };

  const enhanceAllResultBoxes = () => {
    const candidates = document.querySelectorAll(
      '[id*="output" i], [id*="result" i], [id*="response" i], ' +
      '[class*="output" i], [class*="result" i], [class*="response" i]'
    );
    candidates.forEach((el) => {
      if (isResultContainer(el)) {
        enhanceResultBox(el);
      }
    });
  };

  // 8. Global Event Listeners & MutationObserver
  const isGenerateButton = (btn) => {
    if (!btn) return false;
    const text = (btn.textContent || '').trim().toLowerCase();
    const id = (btn.id || '').toLowerCase();
    const cls = (typeof btn.className === 'string' ? btn.className : '').toLowerCase();

    if (btn.classList.contains('ai-ext-action-btn')) return false;

    const keywords = [
      'generate', 'create', 'write', 'summarize', 'paraphrase',
      'analyze', 'solve', 'explain', 'humanize', 'enhance',
      'translate', 'check', 'submit', 'run ai', 'ask ai'
    ];

    return (
      keywords.some((kw) => text.includes(kw)) ||
      id.includes('generate') ||
      cls.includes('generate') ||
      (btn.getAttribute('onclick') || '').toLowerCase().includes('generate')
    );
  };

  const init = () => {
    injectStyles();
    removeStrayCopyButtons();
    enhanceAllResultBoxes();

    // Capture phase listener so we animate the button the instant the user clicks it
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

    // Watch DOM changes for streamed/rendered AI outputs or dynamically injected stray buttons
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const m of mutations) {
        if (m.target && m.target.closest && m.target.closest('.ai-ext-bottom-actions')) {
          continue;
        }
        shouldCheck = true;
        break;
      }
      if (shouldCheck) {
        removeStrayCopyButtons();
        enhanceAllResultBoxes();
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
