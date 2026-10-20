/**
 * pdf-editor-ext.js
 * Self-contained extension that transforms the "Split PDF" card and workspace
 * into an Android App-Style "Edit PDF" studio powered by pdf-lib.
 */

(function () {
  'use strict';

  // 1. Ensure pdf-lib is available globally
  const ensurePdfLib = () => {
    return new Promise((resolve, reject) => {
      if (window.PDFLib && window.PDFLib.PDFDocument) {
        return resolve(window.PDFLib);
      }
      const existingScript = document.querySelector('script[src*="pdf-lib"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.PDFLib));
        existingScript.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
      script.onload = () => resolve(window.PDFLib);
      script.onerror = () => reject(new Error('Failed to load pdf-lib'));
      document.head.appendChild(script);
    });
  };

  // 2. Inject Android App-Style CSS for the PDF Editor Workspace
  const injectEditorStyles = () => {
    if (document.getElementById('pdf-editor-ext-styles')) return;
    const style = document.createElement('style');
    style.id = 'pdf-editor-ext-styles';
    style.textContent = `
      .android-pdf-app {
        max-width: 760px;
        margin: 0 auto;
        background: #0f172a;
        color: #f8fafc;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.08);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .android-app-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 24px;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .android-app-title {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 1.2rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }
      .android-app-title i {
        color: #38bdf8;
        font-size: 1.35rem;
      }
      .android-badge {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(56, 189, 248, 0.3);
      }
      .android-app-body {
        padding: 24px;
      }
      .android-upload-zone {
        border: 2px dashed rgba(56, 189, 248, 0.4);
        background: rgba(30, 41, 59, 0.5);
        border-radius: 16px;
        padding: 36px 20px;
        text-align: center;
        cursor: pointer;
        transition: all 0.25s ease;
      }
      .android-upload-zone:hover, .android-upload-zone.dragover {
        border-color: #38bdf8;
        background: rgba(56, 189, 248, 0.08);
        transform: translateY(-2px);
      }
      .android-upload-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: rgba(56, 189, 248, 0.12);
        color: #38bdf8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.75rem;
        margin-bottom: 14px;
      }
      .android-file-card {
        display: none;
        background: #1e293b;
        border-radius: 14px;
        padding: 16px 20px;
        margin-bottom: 22px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
      }
      .android-file-card.active {
        display: flex;
      }
      .android-file-info {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .android-file-icon {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.4rem;
      }
      .android-file-name {
        font-weight: 600;
        font-size: 1rem;
        color: #f8fafc;
        word-break: break-all;
      }
      .android-file-meta {
        font-size: 0.82rem;
        color: #94a3b8;
        margin-top: 2px;
      }
      .android-change-btn {
        background: rgba(255, 255, 255, 0.08);
        color: #e2e8f0;
        border: none;
        padding: 8px 14px;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
      }
      .android-change-btn:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      .android-tools-panel {
        display: none;
        flex-direction: column;
        gap: 20px;
      }
      .android-tools-panel.active {
        display: flex;
      }
      .android-tool-section {
        background: #1e293b;
        border-radius: 14px;
        padding: 18px 20px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .android-section-header {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.95rem;
        font-weight: 600;
        color: #e2e8f0;
        margin-bottom: 14px;
      }
      .android-section-header i {
        color: #38bdf8;
      }
      .android-form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
      }
      .android-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .android-field label {
        font-size: 0.8rem;
        color: #94a3b8;
        font-weight: 500;
      }
      .android-input, .android-select {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: #f8fafc;
        padding: 10px 12px;
        border-radius: 10px;
        font-size: 0.9rem;
        outline: none;
      }
      .android-input:focus, .android-select:focus {
        border-color: #38bdf8;
      }
      .android-chip-group {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
      .android-chip {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #cbd5e1;
        padding: 10px 8px;
        border-radius: 10px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s ease;
      }
      .android-chip.selected {
        background: rgba(56, 189, 248, 0.18);
        border-color: #38bdf8;
        color: #38bdf8;
      }
      .android-save-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-top: 6px;
        flex-wrap: wrap;
      }
      .android-status-msg {
        font-size: 0.88rem;
        color: #38bdf8;
        min-height: 20px;
      }
      .android-fab-save {
        background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
        color: #ffffff;
        border: none;
        padding: 13px 26px;
        border-radius: 12px;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
        transition: transform 0.15s ease, opacity 0.2s ease;
      }
      .android-fab-save:hover {
        transform: translateY(-2px);
      }
      .android-fab-save:disabled {
        opacity: 0.6;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  };

  // 3. Transform "Split PDF" Card in the Directory Grid into "Edit PDF"
  const transformDirectoryCard = () => {
    const allElements = document.querySelectorAll(
      '.tool-card, .card, .pdf-card, [data-tool], [onclick*="split" i], a[href*="split" i], div, button'
    );

    allElements.forEach((el) => {
      // Avoid modifying inside our own custom editor
      if (el.closest('.android-pdf-app')) return;

      // Check headings or titles inside cards
      const heading = el.querySelector('h2, h3, h4, h5, .card-title, .tool-title, strong');
      if (heading && /split\s*pdf/i.test(heading.textContent)) {
        heading.textContent = heading.textContent.replace(/Split\s*PDF/gi, 'Edit PDF');

        const desc = el.querySelector('p, .card-desc, .tool-desc, span:not(.badge)');
        if (desc && /split|extract|separate/i.test(desc.textContent)) {
          desc.textContent = 'Add watermarks, page notes, and rotate PDF pages in an app-style studio.';
        }

        const icon = el.querySelector('i.fa-scissors, i.fa-cut, i[class*="split"], i.fa-file-pdf');
        if (icon) {
          icon.className = 'fa-solid fa-file-pen';
        }
      }

      // Also check direct button/nav labels that say "Split PDF"
      if (el.children.length === 0 && /^split\s*pdf$/i.test((el.textContent || '').trim())) {
        el.textContent = 'Edit PDF';
      }
    });
  };

  // 4. Build the Android App-Style PDF Editor Workspace UI
  const buildEditorUI = (container) => {
    if (!container || container.querySelector('.android-pdf-app')) return;

    // Clear old Split PDF controls inside the workspace container
    container.innerHTML = `
      <div class="android-pdf-app">
        <div class="android-app-bar">
          <h2 class="android-app-title">
            <i class="fa-solid fa-file-pen"></i>
            <span>Edit PDF Studio</span>
          </h2>
          <span class="android-badge">LOCAL &amp; PRIVATE</span>
        </div>

        <div class="android-app-body">
          <input type="file" id="android-pdf-file-input" accept="application/pdf,.pdf" style="display:none" />

          <!-- Upload Zone -->
          <div class="android-upload-zone" id="android-pdf-dropzone">
            <div class="android-upload-icon">
              <i class="fa-solid fa-cloud-arrow-up"></i>
            </div>
            <h3 style="margin: 0 0 6px 0; font-size: 1.1rem; color: #f8fafc;">Tap to Select a PDF Document</h3>
            <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">Or drag &amp; drop a PDF file here to start editing</p>
          </div>

          <!-- Loaded Document Details Card -->
          <div class="android-file-card" id="android-pdf-file-card">
            <div class="android-file-info">
              <div class="android-file-icon">
                <i class="fa-solid fa-file-pdf"></i>
              </div>
              <div>
                <div class="android-file-name" id="android-pdf-filename">document.pdf</div>
                <div class="android-file-meta" id="android-pdf-filemeta">0 KB • 0 Pages</div>
              </div>
            </div>
            <button type="button" class="android-change-btn" id="android-pdf-change-btn">
              <i class="fa-solid fa-folder-open"></i> Change File
            </button>
          </div>

          <!-- Interactive Editing Tools -->
          <div class="android-tools-panel" id="android-pdf-tools-panel">
            <!-- Watermark / Page Notes Tool -->
            <div class="android-tool-section">
              <div class="android-section-header">
                <i class="fa-solid fa-stamp"></i>
                <span>Add Text Watermark or Page Note</span>
              </div>
              <div class="android-form-grid">
                <div class="android-field" style="grid-column: 1 / -1;">
                  <label for="android-wm-text">Watermark / Note Text (Leave empty for none)</label>
                  <input type="text" id="android-wm-text" class="android-input" placeholder="e.g., CONFIDENTIAL, DRAFT, or Reviewed by Alex" />
                </div>
                <div class="android-field">
                  <label for="android-wm-position">Placement on Pages</label>
                  <select id="android-wm-position" class="android-select">
                    <option value="center">Center Diagonal Stamp</option>
                    <option value="header">Top Header Note</option>
                    <option value="footer">Bottom Footer Note</option>
                  </select>
                </div>
                <div class="android-field">
                  <label for="android-wm-size">Text Size</label>
                  <select id="android-wm-size" class="android-select">
                    <option value="14">Small Note (14pt)</option>
                    <option value="24">Medium Label (24pt)</option>
                    <option value="42" selected>Large Watermark (42pt)</option>
                    <option value="60">Extra Large Stamp (60pt)</option>
                  </select>
                </div>
                <div class="android-field">
                  <label for="android-wm-color">Text Color</label>
                  <select id="android-wm-color" class="android-select">
                    <option value="gray" selected>Subtle Slate Gray</option>
                    <option value="red">Crimson Red</option>
                    <option value="blue">Royal Blue</option>
                    <option value="black">Solid Black</option>
                  </select>
                </div>
                <div class="android-field">
                  <label for="android-wm-opacity">Opacity</label>
                  <select id="android-wm-opacity" class="android-select">
                    <option value="0.25" selected>25% (Watermark)</option>
                    <option value="0.5">50% (Semi-bold)</option>
                    <option value="0.85">85% (Clear Note)</option>
                    <option value="1">100% (Solid)</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Page Orientation Rotation Tool -->
            <div class="android-tool-section">
              <div class="android-section-header">
                <i class="fa-solid fa-rotate"></i>
                <span>Adjust Page Orientation (All Pages)</span>
              </div>
              <div class="android-chip-group" id="android-rotation-group">
                <button type="button" class="android-chip selected" data-rotate="0">
                  <i class="fa-solid fa-check"></i> 0° Default
                </button>
                <button type="button" class="android-chip" data-rotate="90">
                  <i class="fa-solid fa-rotate-right"></i> +90° CW
                </button>
                <button type="button" class="android-chip" data-rotate="180">
                  <i class="fa-solid fa-arrows-rotate"></i> 180° Flip
                </button>
                <button type="button" class="android-chip" data-rotate="270">
                  <i class="fa-solid fa-rotate-left"></i> +270° CCW
                </button>
              </div>
            </div>

            <!-- Save & Download Action Bar -->
            <div class="android-save-bar">
              <div class="android-status-msg" id="android-pdf-status">Ready to edit locally.</div>
              <button type="button" class="android-fab-save" id="android-pdf-save-btn">
                <i class="fa-solid fa-download"></i>
                <span>Save &amp; Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEditorEvents(container);
  };

  // 5. Bind Interactive File Loading, Editing, and Saving Logic
  const bindEditorEvents = (container) => {
    let currentFileBytes = null;
    let currentFileName = 'document.pdf';
    let selectedRotation = 0;

    const fileInput = container.querySelector('#android-pdf-file-input');
    const dropzone = container.querySelector('#android-pdf-dropzone');
    const fileCard = container.querySelector('#android-pdf-file-card');
    const fileNameEl = container.querySelector('#android-pdf-filename');
    const fileMetaEl = container.querySelector('#android-pdf-filemeta');
    const changeBtn = container.querySelector('#android-pdf-change-btn');
    const toolsPanel = container.querySelector('#android-pdf-tools-panel');
    const rotationGroup = container.querySelector('#android-rotation-group');
    const statusMsg = container.querySelector('#android-pdf-status');
    const saveBtn = container.querySelector('#android-pdf-save-btn');

    const formatBytes = (bytes) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1048576).toFixed(2)} MB`;
    };

    const handleFileLoad = async (file) => {
      if (!file) return;
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        statusMsg.textContent = 'Please select a valid PDF file.';
        return;
      }

      try {
        statusMsg.textContent = 'Loading PDF document...';
        const arrayBuffer = await file.arrayBuffer();
        currentFileBytes = arrayBuffer;
        currentFileName = file.name;

        const PDFLib = await ensurePdfLib();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const pageCount = pdfDoc.getPageCount();

        fileNameEl.textContent = file.name;
        fileMetaEl.textContent = `${formatBytes(file.size)} • ${pageCount} ${pageCount === 1 ? 'Page' : 'Pages'}`;

        dropzone.style.display = 'none';
        fileCard.classList.add('active');
        toolsPanel.classList.add('active');
        statusMsg.textContent = `Loaded ${pageCount} page(s). Adjust settings below and click Save.`;
      } catch (err) {
        console.error('Error reading PDF:', err);
        statusMsg.textContent = 'Could not parse this PDF file. Please try another file.';
      }
    };

    dropzone.addEventListener('click', () => fileInput.click());
    changeBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileLoad(e.target.files[0]);
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileLoad(e.dataTransfer.files[0]);
      }
    });

    rotationGroup.addEventListener('click', (e) => {
      const chip = e.target.closest('.android-chip');
      if (!chip) return;
      rotationGroup.querySelectorAll('.android-chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedRotation = parseInt(chip.getAttribute('data-rotate') || '0', 10);
    });

    saveBtn.addEventListener('click', async () => {
      if (!currentFileBytes) return;

      const wmTextRaw = (container.querySelector('#android-wm-text').value || '').trim();
      const wmPosition = container.querySelector('#android-wm-position').value;
      const wmSize = parseFloat(container.querySelector('#android-wm-size').value) || 36;
      const wmColorKey = container.querySelector('#android-wm-color').value;
      const wmOpacity = parseFloat(container.querySelector('#android-wm-opacity').value) || 0.3;

      saveBtn.disabled = true;
      const originalBtnHTML = saveBtn.innerHTML;
      saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Applying Edits...</span>';
      statusMsg.textContent = 'Processing pages with pdf-lib...';

      try {
        const PDFLib = await ensurePdfLib();
        const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

        const pdfDoc = await PDFDocument.load(currentFileBytes, { ignoreEncryption: true });
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();

        const colorMap = {
          gray: rgb(0.35, 0.4, 0.48),
          red: rgb(0.85, 0.15, 0.15),
          blue: rgb(0.12, 0.38, 0.85),
          black: rgb(0.08, 0.08, 0.08)
        };
        const chosenColor = colorMap[wmColorKey] || colorMap.gray;

        // Sanitize text for WinAnsi encoding compatibility in StandardFonts
        const safeText = wmTextRaw.replace(/[^\x20-\x7E]/g, '');

        pages.forEach((page) => {
          // 1. Apply Page Rotation
          if (selectedRotation !== 0) {
            const currentAngle = page.getRotation().angle || 0;
            page.setRotation(degrees((currentAngle + selectedRotation) % 360));
          }

          // 2. Apply Watermark / Page Note if provided
          if (safeText) {
            const { width, height } = page.getSize();
            const textWidth = font.widthOfTextAtSize(safeText, wmSize);

            if (wmPosition === 'center') {
              page.drawText(safeText, {
                x: Math.max(20, (width - textWidth * 0.75) / 2),
                y: height / 2,
                size: wmSize,
                font,
                color: chosenColor,
                opacity: wmOpacity,
                rotate: degrees(35)
              });
            } else if (wmPosition === 'header') {
              page.drawText(safeText, {
                x: Math.max(24, (width - textWidth) / 2),
                y: height - Math.max(36, wmSize + 14),
                size: wmSize,
                font,
                color: chosenColor,
                opacity: wmOpacity
              });
            } else if (wmPosition === 'footer') {
              page.drawText(safeText, {
                x: Math.max(24, (width - textWidth) / 2),
                y: 28,
                size: wmSize,
                font,
                color: chosenColor,
                opacity: wmOpacity
              });
            }
          }
        });

        const editedPdfBytes = await pdfDoc.save();
        const blob = new Blob([editedPdfBytes], { type: 'application/pdf' });
        const downloadUrl = URL.createObjectURL(blob);

        const baseName = currentFileName.replace(/\.pdf$/i, '');
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${baseName}-edited.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 4000);

        statusMsg.textContent = 'Edited PDF saved and downloaded!';
      } catch (err) {
        console.error('Failed to edit PDF:', err);
        statusMsg.textContent = 'Error saving PDF. Please verify the file is not write-protected.';
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnHTML;
      }
    });
  };

  // 6. Locate and Upgrade the Split PDF Workspace Container
  const locateAndUpgradeSplitWorkspace = () => {
    // Strategy A: Look for explicit IDs or data attributes associated with Split PDF
    const directSelectors = [
      '#split-pdf',
      '#split-pdf-tool',
      '#split-pdf-workspace',
      '#split-workspace',
      '#tool-split-pdf',
      '#pdf-split',
      '[data-workspace="split-pdf"]',
      '[data-tool-id="split-pdf"]'
    ];

    for (const sel of directSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        buildEditorUI(el);
        return;
      }
    }

    // Strategy B: Look for any workspace heading that says "Split PDF" and replace its tool body
    const headings = document.querySelectorAll('h1, h2, h3');
    headings.forEach((h) => {
      if (/^split\s*pdf/i.test((h.textContent || '').trim())) {
        // Check if this heading is inside a directory card (skip cards, only target active workspaces)
        if (h.closest('.tool-card, .card, .grid-item')) return;

        const workspaceContainer =
          h.closest('.workspace, .tool-workspace, .tool-container, .pdf-workspace, section, .modal-body') ||
          h.parentElement;

        if (workspaceContainer && !workspaceContainer.querySelector('.android-pdf-app')) {
          buildEditorUI(workspaceContainer);
        }
      }
    });
  };

  // 7. Initialize and Observe DOM for SPA Navigation
  const init = () => {
    injectEditorStyles();
    ensurePdfLib().catch(() => {});
    transformDirectoryCard();
    locateAndUpgradeSplitWorkspace();

    const observer = new MutationObserver(() => {
      transformDirectoryCard();
      locateAndUpgradeSplitWorkspace();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
