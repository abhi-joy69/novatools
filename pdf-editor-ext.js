/**
 * pdf-editor-ext.js
 * Self-contained Adobe/Android App-Style PDF Editor extension.
 * Upgrades the "Split PDF" / "Edit PDF" card and workspace with live document
 * preview, watermark/annotation overlays, page rotation, and local pdf-lib export.
 */

(function () {
  'use strict';

  // 1. Dynamically load pdf-lib if not already present
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

  // 2. Inject Adobe Acrobat / Android Material Studio Styles
  const injectStyles = () => {
    if (document.getElementById('pdf-editor-ext-styles')) return;
    const style = document.createElement('style');
    style.id = 'pdf-editor-ext-styles';
    style.textContent = `
      .adobe-app-shell {
        max-width: 960px;
        margin: 0 auto;
        background: #12161f;
        color: #f1f5f9;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 24px 50px rgba(0, 0, 0, 0.45);
        border: 1px solid rgba(255, 255, 255, 0.08);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      /* Top Adobe/Android App Bar */
      .adobe-top-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        background: #1a202c;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-wrap: wrap;
        gap: 12px;
      }
      .adobe-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .adobe-brand-icon {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.15rem;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);
      }
      .adobe-brand-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }
      .adobe-brand-sub {
        font-size: 0.76rem;
        color: #94a3b8;
        margin: 0;
      }
      .adobe-pill-badge {
        background: rgba(16, 185, 129, 0.14);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
        padding: 5px 12px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      /* Upload Empty State */
      .adobe-upload-stage {
        padding: 36px 24px;
      }
      .adobe-dropzone {
        border: 2px dashed rgba(239, 68, 68, 0.45);
        background: rgba(30, 41, 59, 0.45);
        border-radius: 16px;
        padding: 48px 24px;
        text-align: center;
        cursor: pointer;
        transition: all 0.25s ease;
      }
      .adobe-dropzone:hover, .adobe-dropzone.dragover {
        border-color: #ef4444;
        background: rgba(239, 68, 68, 0.08);
        transform: translateY(-2px);
      }
      .adobe-drop-icon {
        width: 68px;
        height: 68px;
        border-radius: 20px;
        background: rgba(239, 68, 68, 0.14);
        color: #f87171;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.85rem;
        margin-bottom: 16px;
      }
      /* Active Editor Split Workspace */
      .adobe-workspace-grid {
        display: none;
        grid-template-columns: 1fr 1.15fr;
        min-height: 440px;
      }
      .adobe-workspace-grid.active {
        display: grid;
      }
      @media (max-width: 768px) {
        .adobe-workspace-grid.active {
          grid-template-columns: 1fr;
        }
      }
      /* Left Column: Interactive Live Document Viewer Canvas */
      .adobe-viewer-pane {
        background: #0b0e14;
        padding: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        border-right: 1px solid rgba(255, 255, 255, 0.07);
      }
      .adobe-file-chip {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #1a202c;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        margin-bottom: 20px;
        gap: 10px;
      }
      .adobe-file-chip-meta {
        overflow: hidden;
      }
      .adobe-file-chip-name {
        font-size: 0.88rem;
        font-weight: 600;
        color: #f8fafc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .adobe-file-chip-sub {
        font-size: 0.75rem;
        color: #94a3b8;
      }
      .adobe-mini-btn {
        background: rgba(255, 255, 255, 0.08);
        color: #e2e8f0;
        border: none;
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 0.76rem;
        font-weight: 600;
        cursor: pointer;
        flex-shrink: 0;
      }
      .adobe-mini-btn:hover {
        background: rgba(255, 255, 255, 0.16);
      }
      /* Simulated PDF Page Sheet */
      .adobe-page-stage {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 16px 0;
      }
      .adobe-page-sheet {
        width: 210px;
        height: 285px;
        background: #ffffff;
        color: #1e293b;
        border-radius: 6px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
        position: relative;
        overflow: hidden;
        padding: 22px 18px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .adobe-mock-lines span {
        display: block;
        height: 6px;
        background: #e2e8f0;
        border-radius: 4px;
        margin-bottom: 10px;
      }
      .adobe-mock-lines span:nth-child(1) { width: 65%; height: 9px; background: #cbd5e1; margin-bottom: 16px; }
      .adobe-mock-lines span:nth-child(4) { width: 80%; }
      .adobe-mock-lines span:nth-child(7) { width: 55%; }
      .adobe-live-overlay {
        position: absolute;
        left: 10px;
        right: 10px;
        text-align: center;
        font-weight: 800;
        word-break: break-word;
        pointer-events: none;
        transition: all 0.2s ease;
      }
      .adobe-live-overlay.pos-center {
        top: 50%;
        transform: translateY(-50%) rotate(-32deg);
      }
      .adobe-live-overlay.pos-header {
        top: 10px;
      }
      .adobe-live-overlay.pos-footer {
        bottom: 10px;
      }
      /* Right Column: Editing Tools & Inspector */
      .adobe-inspector-pane {
        padding: 24px;
        background: #161b26;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 18px;
      }
      .adobe-tool-card {
        background: #1e2534;
        border-radius: 14px;
        padding: 16px 18px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .adobe-tool-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        font-weight: 700;
        color: #f8fafc;
        margin-bottom: 14px;
      }
      .adobe-tool-heading i {
        color: #f87171;
      }
      .adobe-grid-2 {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
      }
      .adobe-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .adobe-field label {
        font-size: 0.76rem;
        color: #94a3b8;
        font-weight: 600;
      }
      .adobe-input, .adobe-select {
        background: #0f141d;
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #f8fafc;
        padding: 9px 12px;
        border-radius: 9px;
        font-size: 0.86rem;
        outline: none;
      }
      .adobe-input:focus, .adobe-select:focus {
        border-color: #ef4444;
      }
      .adobe-rot-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }
      .adobe-rot-btn {
        background: #0f141d;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #cbd5e1;
        padding: 9px 6px;
        border-radius: 9px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        transition: all 0.2s ease;
      }
      .adobe-rot-btn.active {
        background: rgba(239, 68, 68, 0.16);
        border-color: #ef4444;
        color: #f87171;
      }
      /* Bottom Action Dock */
      .adobe-action-dock {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-top: 8px;
        flex-wrap: wrap;
      }
      .adobe-status-text {
        font-size: 0.82rem;
        color: #94a3b8;
      }
      .adobe-export-btn {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: #ffffff;
        border: none;
        padding: 12px 22px;
        border-radius: 11px;
        font-size: 0.92rem;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 9px;
        box-shadow: 0 8px 20px rgba(239, 68, 68, 0.35);
        transition: transform 0.15s ease, opacity 0.2s ease;
      }
      .adobe-export-btn:hover {
        transform: translateY(-2px);
      }
      .adobe-export-btn:disabled {
        opacity: 0.6;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  };

  // 3. Transform Directory Cards from "Split PDF" to "Edit PDF"
  const transformDirectoryCards = () => {
    const cards = document.querySelectorAll(
      '.tool-card, .card, .pdf-card, [data-tool], [onclick*="split" i], a[href*="split" i], div, button'
    );

    cards.forEach((el) => {
      if (el.closest('.adobe-app-shell')) return;

      const title = el.querySelector('h2, h3, h4, h5, .card-title, .tool-title, strong');
      if (title && /split\s*pdf/i.test(title.textContent)) {
        title.textContent = title.textContent.replace(/Split\s*PDF/gi, 'Edit PDF');

        const desc = el.querySelector('p, .card-desc, .tool-desc, span:not(.badge)');
        if (desc && /split|extract|separate/i.test(desc.textContent)) {
          desc.textContent = 'Annotate, watermark, rotate, and customize PDF pages in an Adobe-style studio.';
        }

        const icon = el.querySelector('i.fa-scissors, i.fa-cut, i[class*="split"], i.fa-file-pdf');
        if (icon) {
          icon.className = 'fa-solid fa-file-pen';
        }
      }

      if (el.children.length === 0 && /^split\s*pdf$/i.test((el.textContent || '').trim())) {
        el.textContent = 'Edit PDF';
      }
    });
  };

  // 4. Render Adobe/Android App-Style PDF Editor Workspace
  const buildEditorWorkspace = (container) => {
    if (!container || container.querySelector('.adobe-app-shell')) return;

    container.innerHTML = `
      <div class="adobe-app-shell">
        <!-- App Bar -->
        <div class="adobe-top-bar">
          <div class="adobe-brand">
            <div class="adobe-brand-icon">
              <i class="fa-solid fa-file-pen"></i>
            </div>
            <div>
              <h2 class="adobe-brand-title">Adobe-Style PDF Editor</h2>
              <p class="adobe-brand-sub">Annotation, Watermark &amp; Page Orientation Studio</p>
            </div>
          </div>
          <span class="adobe-pill-badge">
            <i class="fa-solid fa-shield-halved"></i> 100% On-Device Processing
          </span>
        </div>

        <input type="file" id="adobe-pdf-input" accept="application/pdf,.pdf" style="display:none" />

        <!-- Initial Upload Stage -->
        <div class="adobe-upload-stage" id="adobe-upload-stage">
          <div class="adobe-dropzone" id="adobe-dropzone">
            <div class="adobe-drop-icon">
              <i class="fa-solid fa-file-arrow-up"></i>
            </div>
            <h3 style="margin: 0 0 8px 0; font-size: 1.15rem; color: #ffffff;">Select a PDF Document to Edit</h3>
            <p style="margin: 0 0 18px 0; font-size: 0.86rem; color: #94a3b8;">
              Tap here to browse your device or drag &amp; drop any PDF file
            </p>
            <span style="background: #ef4444; color: #fff; padding: 9px 20px; border-radius: 9px; font-size: 0.85rem; font-weight: 700;">
              <i class="fa-solid fa-folder-open"></i> Choose PDF File
            </span>
          </div>
        </div>

        <!-- Split Workspace: Live Viewer + Inspector -->
        <div class="adobe-workspace-grid" id="adobe-workspace-grid">
          <!-- Left: Document Viewer -->
          <div class="adobe-viewer-pane">
            <div class="adobe-file-chip">
              <div class="adobe-file-chip-meta">
                <div class="adobe-file-chip-name" id="adobe-doc-name">document.pdf</div>
                <div class="adobe-file-chip-sub" id="adobe-doc-meta">0 KB • 0 Pages</div>
              </div>
              <button type="button" class="adobe-mini-btn" id="adobe-switch-file">
                <i class="fa-solid fa-repeat"></i> Replace
              </button>
            </div>

            <div class="adobe-page-stage">
              <div class="adobe-page-sheet" id="adobe-page-sheet">
                <div class="adobe-mock-lines">
                  <span></span><span></span><span></span><span></span>
                  <span></span><span></span><span></span>
                </div>
                <div class="adobe-live-overlay pos-center" id="adobe-live-overlay"></div>
                <div style="font-size: 0.65rem; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 6px;">
                  LIVE PAGE PREVIEW
                </div>
              </div>
            </div>

            <div style="font-size: 0.76rem; color: #64748b; text-align: center;">
              Changes apply uniformly across all pages on export
            </div>
          </div>

          <!-- Right: Editing Controls -->
          <div class="adobe-inspector-pane">
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <!-- Watermark & Annotation Card -->
              <div class="adobe-tool-card">
                <div class="adobe-tool-heading">
                  <i class="fa-solid fa-font"></i>
                  <span>Watermark &amp; Page Annotation</span>
                </div>
                <div class="adobe-grid-2">
                  <div class="adobe-field" style="grid-column: 1 / -1;">
                    <label for="adobe-wm-text">Annotation / Stamp Text</label>
                    <input type="text" id="adobe-wm-text" class="adobe-input" placeholder="e.g., APPROVED, CONFIDENTIAL, or Page Note..." />
                  </div>
                  <div class="adobe-field">
                    <label for="adobe-wm-pos">Position</label>
                    <select id="adobe-wm-pos" class="adobe-select">
                      <option value="center" selected>Diagonal Center Stamp</option>
                      <option value="header">Top Header Banner</option>
                      <option value="footer">Bottom Footer Note</option>
                    </select>
                  </div>
                  <div class="adobe-field">
                    <label for="adobe-wm-size">Font Size</label>
                    <select id="adobe-wm-size" class="adobe-select">
                      <option value="14">14 pt (Note)</option>
                      <option value="24">24 pt (Label)</option>
                      <option value="40" selected>40 pt (Stamp)</option>
                      <option value="58">58 pt (Large Watermark)</option>
                    </select>
                  </div>
                  <div class="adobe-field">
                    <label for="adobe-wm-color">Ink Color</label>
                    <select id="adobe-wm-color" class="adobe-select">
                      <option value="red" selected>Adobe Crimson Red</option>
                      <option value="gray">Slate Gray</option>
                      <option value="blue">Executive Blue</option>
                      <option value="emerald">Verified Green</option>
                      <option value="black">Solid Black</option>
                    </select>
                  </div>
                  <div class="adobe-field">
                    <label for="adobe-wm-opacity">Ink Opacity</label>
                    <select id="adobe-wm-opacity" class="adobe-select">
                      <option value="0.25" selected>25% Subtle Watermark</option>
                      <option value="0.50">50% Medium Stamp</option>
                      <option value="0.85">85% Clear Annotation</option>
                      <option value="1.0">100% Solid Ink</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Page Rotation Card -->
              <div class="adobe-tool-card">
                <div class="adobe-tool-heading">
                  <i class="fa-solid fa-rotate"></i>
                  <span>Page Orientation</span>
                </div>
                <div class="adobe-rot-grid" id="adobe-rot-grid">
                  <button type="button" class="adobe-rot-btn active" data-deg="0">
                    <i class="fa-regular fa-file"></i> 0°
                  </button>
                  <button type="button" class="adobe-rot-btn" data-deg="90">
                    <i class="fa-solid fa-rotate-right"></i> 90° CW
                  </button>
                  <button type="button" class="adobe-rot-btn" data-deg="180">
                    <i class="fa-solid fa-arrows-rotate"></i> 180°
                  </button>
                  <button type="button" class="adobe-rot-btn" data-deg="270">
                    <i class="fa-solid fa-rotate-left"></i> 270°
                  </button>
                </div>
              </div>
            </div>

            <!-- Save & Download Bar -->
            <div class="adobe-action-dock">
              <span class="adobe-status-text" id="adobe-status-text">Ready to export edited PDF.</span>
              <button type="button" class="adobe-export-btn" id="adobe-export-btn">
                <i class="fa-solid fa-file-arrow-down"></i>
                <span>Save &amp; Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    bindWorkspaceEvents(container);
  };

  // 5. Bind Live Preview & PDF-Lib Export Events
  const bindWorkspaceEvents = (container) => {
    let loadedPdfBytes = null;
    let loadedFileName = 'document.pdf';
    let rotationDeg = 0;

    const fileInput = container.querySelector('#adobe-pdf-input');
    const uploadStage = container.querySelector('#adobe-upload-stage');
    const dropzone = container.querySelector('#adobe-dropzone');
    const workspaceGrid = container.querySelector('#adobe-workspace-grid');
    const docNameEl = container.querySelector('#adobe-doc-name');
    const docMetaEl = container.querySelector('#adobe-doc-meta');
    const switchFileBtn = container.querySelector('#adobe-switch-file');
    const pageSheet = container.querySelector('#adobe-page-sheet');
    const liveOverlay = container.querySelector('#adobe-live-overlay');

    const wmText = container.querySelector('#adobe-wm-text');
    const wmPos = container.querySelector('#adobe-wm-pos');
    const wmSize = container.querySelector('#adobe-wm-size');
    const wmColor = container.querySelector('#adobe-wm-color');
    const wmOpacity = container.querySelector('#adobe-wm-opacity');
    const rotGrid = container.querySelector('#adobe-rot-grid');
    const statusText = container.querySelector('#adobe-status-text');
    const exportBtn = container.querySelector('#adobe-export-btn');

    const cssColorMap = {
      red: '#dc2626',
      gray: '#475569',
      blue: '#2563eb',
      emerald: '#059669',
      black: '#0f172a'
    };

    const formatSize = (bytes) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1048576).toFixed(2)} MB`;
    };

    const updateLivePreview = () => {
      pageSheet.style.transform = `rotate(${rotationDeg}deg)`;
      const text = (wmText.value || '').trim();
      liveOverlay.textContent = text;
      liveOverlay.className = `adobe-live-overlay pos-${wmPos.value}`;
      liveOverlay.style.color = cssColorMap[wmColor.value] || '#dc2626';
      liveOverlay.style.opacity = wmOpacity.value;

      const scaledPx = Math.max(9, Math.round(parseFloat(wmSize.value) * 0.42));
      liveOverlay.style.fontSize = `${scaledPx}px`;
    };

    [wmText, wmPos, wmSize, wmColor, wmOpacity].forEach((el) => {
      el.addEventListener('input', updateLivePreview);
      el.addEventListener('change', updateLivePreview);
    });

    rotGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.adobe-rot-btn');
      if (!btn) return;
      rotGrid.querySelectorAll('.adobe-rot-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      rotationDeg = parseInt(btn.getAttribute('data-deg') || '0', 10);
      updateLivePreview();
    });

    const loadPdfFile = async (file) => {
      if (!file) return;
      try {
        statusText.textContent = 'Reading PDF file...';
        const buffer = await file.arrayBuffer();
        const PDFLib = await ensurePdfLib();
        const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();

        loadedPdfBytes = buffer;
        loadedFileName = file.name;

        docNameEl.textContent = file.name;
        docMetaEl.textContent = `${formatSize(file.size)} • ${count} ${count === 1 ? 'Page' : 'Pages'}`;

        uploadStage.style.display = 'none';
        workspaceGrid.classList.add('active');
        updateLivePreview();
        statusText.textContent = `Loaded ${count} page(s). Ready to edit.`;
      } catch (err) {
        console.error('Error loading PDF:', err);
        alert('Could not open this PDF file. Please select a valid PDF document.');
      }
    };

    dropzone.addEventListener('click', () => fileInput.click());
    switchFileBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        loadPdfFile(e.target.files[0]);
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
        loadPdfFile(e.dataTransfer.files[0]);
      }
    });

    exportBtn.addEventListener('click', async () => {
      if (!loadedPdfBytes) return;

      exportBtn.disabled = true;
      const origHTML = exportBtn.innerHTML;
      exportBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Saving PDF...</span>';
      statusText.textContent = 'Applying edits with pdf-lib...';

      try {
        const PDFLib = await ensurePdfLib();
        const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

        const pdfDoc = await PDFDocument.load(loadedPdfBytes, { ignoreEncryption: true });
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();

        const pdfColorMap = {
          red: rgb(0.86, 0.15, 0.15),
          gray: rgb(0.35, 0.4, 0.48),
          blue: rgb(0.15, 0.39, 0.92),
          emerald: rgb(0.02, 0.59, 0.41),
          black: rgb(0.08, 0.08, 0.08)
        };

        const rawStamp = (wmText.value || '').trim().replace(/[^\x20-\x7E]/g, '');
        const pos = wmPos.value;
        const size = parseFloat(wmSize.value) || 40;
        const color = pdfColorMap[wmColor.value] || pdfColorMap.red;
        const opacity = parseFloat(wmOpacity.value) || 0.25;

        pages.forEach((page) => {
          if (rotationDeg !== 0) {
            const currentRot = page.getRotation().angle || 0;
            page.setRotation(degrees((currentRot + rotationDeg) % 360));
          }

          if (rawStamp) {
            const { width, height } = page.getSize();
            const textWidth = font.widthOfTextAtSize(rawStamp, size);

            if (pos === 'center') {
              page.drawText(rawStamp, {
                x: Math.max(20, (width - textWidth * 0.78) / 2),
                y: height / 2,
                size,
                font,
                color,
                opacity,
                rotate: degrees(32)
              });
            } else if (pos === 'header') {
              page.drawText(rawStamp, {
                x: Math.max(24, (width - textWidth) / 2),
                y: height - Math.max(36, size + 14),
                size,
                font,
                color,
                opacity
              });
            } else if (pos === 'footer') {
              page.drawText(rawStamp, {
                x: Math.max(24, (width - textWidth) / 2),
                y: 28,
                size,
                font,
                color,
                opacity
              });
            }
          }
        });

        const outBytes = await pdfDoc.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const cleanBase = loadedFileName.replace(/\.pdf$/i, '');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cleanBase}-edited.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);

        statusText.textContent = 'Edited PDF downloaded!';
      } catch (err) {
        console.error('Export error:', err);
        statusText.textContent = 'Error saving PDF. Check if file is encrypted.';
      } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = origHTML;
      }
    });
  };

  // 6. Locate and Upgrade the Target PDF Workspace Container
  const locateAndUpgradeWorkspace = () => {
    const selectors = [
      '#split-pdf',
      '#edit-pdf',
      '#split-pdf-tool',
      '#edit-pdf-tool',
      '#split-pdf-workspace',
      '#edit-pdf-workspace',
      '#split-workspace',
      '#tool-split-pdf',
      '#pdf-split',
      '[data-workspace="split-pdf"]',
      '[data-tool-id="split-pdf"]'
    ];

    for (const sel of selectors) {
      const target = document.querySelector(sel);
      if (target) {
        buildEditorWorkspace(target);
        return;
      }
    }

    const headings = document.querySelectorAll('h1, h2, h3');
    headings.forEach((h) => {
      const text = (h.textContent || '').trim();
      if (/^(split|edit)\s*pdf/i.test(text)) {
        if (h.closest('.tool-card, .card, .grid-item, .adobe-app-shell')) return;
        const container =
          h.closest('.workspace, .tool-workspace, .tool-container, .pdf-workspace, section, .modal-body') ||
          h.parentElement;
        if (container && !container.querySelector('.adobe-app-shell')) {
          buildEditorWorkspace(container);
        }
      }
    });
  };

  // 7. Initialize & Observe DOM
  const init = () => {
    injectStyles();
    ensurePdfLib().catch(() => {});
    transformDirectoryCards();
    locateAndUpgradeWorkspace();

    const observer = new MutationObserver(() => {
      transformDirectoryCards();
      locateAndUpgradeWorkspace();
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
