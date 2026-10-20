/**
 * pdf-editor-ext.js
 * Self-contained extension for the "Nova Tools PDF Editor".
 * Features:
 * 1. Automatically transforms "Split PDF" / "Edit PDF" into "Nova Tools PDF Editor".
 * 2. Local file upload & interactive multi-page document canvas viewer.
 * 3. Interactive Annotation & Drawing Toolbar:
 *    - Highlight text areas
 *    - Freehand drawing / ink notes
 *    - Rectangle / callout shapes
 *    - Custom text notes & watermarks/stamps
 * 4. Page orientation rotation (0°, 90°, 180°, 270°) & instant local export via pdf-lib.
 */

(function () {
  'use strict';

  // 1. Dynamically load pdf-lib and pdf.js for rendering and saving PDFs locally
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

  const ensurePdfJs = () => {
    return new Promise((resolve) => {
      if (window.pdfjsLib) {
        return resolve(window.pdfjsLib);
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        resolve(window.pdfjsLib || null);
      };
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  };

  // 2. Inject Nova Tools PDF Editor Studio Styles
  const injectStyles = () => {
    if (document.getElementById('nova-pdf-editor-styles')) return;
    const style = document.createElement('style');
    style.id = 'nova-pdf-editor-styles';
    style.textContent = `
      .nova-pdf-studio {
        max-width: 1080px;
        margin: 0 auto;
        background: #0f172a;
        color: #f8fafc;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 24px 55px rgba(0, 0, 0, 0.45);
        border: 1px solid rgba(255, 255, 255, 0.09);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      /* Header Bar */
      .nova-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-wrap: wrap;
        gap: 12px;
      }
      .nova-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .nova-brand-icon {
        width: 40px;
        height: 40px;
        border-radius: 11px;
        background: linear-gradient(135deg, #6366f1, #3b82f6);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
      }
      .nova-brand-title {
        font-size: 1.15rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }
      .nova-brand-subtitle {
        font-size: 0.78rem;
        color: #94a3b8;
        margin: 0;
      }
      .nova-privacy-pill {
        background: rgba(16, 185, 129, 0.14);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
        padding: 5px 12px;
        border-radius: 999px;
        font-size: 0.76rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      /* Upload Stage */
      .nova-upload-stage {
        padding: 40px 24px;
      }
      .nova-dropzone {
        border: 2px dashed rgba(99, 102, 241, 0.5);
        background: rgba(30, 41, 59, 0.5);
        border-radius: 16px;
        padding: 52px 24px;
        text-align: center;
        cursor: pointer;
        transition: all 0.25s ease;
      }
      .nova-dropzone:hover, .nova-dropzone.dragover {
        border-color: #6366f1;
        background: rgba(99, 102, 241, 0.1);
        transform: translateY(-2px);
      }
      .nova-dropzone-icon {
        width: 70px;
        height: 70px;
        border-radius: 20px;
        background: rgba(99, 102, 241, 0.16);
        color: #818cf8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.9rem;
        margin-bottom: 16px;
      }
      /* Interactive Annotation Toolbar */
      .nova-editor-workspace {
        display: none;
        flex-direction: column;
      }
      .nova-editor-workspace.active {
        display: flex;
      }
      .nova-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        background: #1e293b;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-wrap: wrap;
        gap: 10px;
      }
      .nova-tool-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .nova-tool-btn {
        background: #0f172a;
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 8px 13px;
        border-radius: 9px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        transition: all 0.18s ease;
      }
      .nova-tool-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
      }
      .nova-tool-btn.active {
        background: rgba(99, 102, 241, 0.22);
        border-color: #6366f1;
        color: #a5b4fc;
      }
      .nova-color-swatch {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
        transition: transform 0.15s ease;
      }
      .nova-color-swatch.active {
        border-color: #ffffff;
        transform: scale(1.15);
      }
      /* Main Split Studio Layout */
      .nova-studio-body {
        display: grid;
        grid-template-columns: 1.35fr 1fr;
        min-height: 520px;
      }
      @media (max-width: 840px) {
        .nova-studio-body {
          grid-template-columns: 1fr;
        }
      }
      /* Left: Interactive Document Canvas Pane */
      .nova-canvas-pane {
        background: #090d16;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        border-right: 1px solid rgba(255, 255, 255, 0.07);
      }
      .nova-file-bar {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #1e293b;
        padding: 10px 14px;
        border-radius: 11px;
        margin-bottom: 14px;
        gap: 10px;
      }
      .nova-file-name {
        font-size: 0.88rem;
        font-weight: 600;
        color: #f8fafc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .nova-file-meta {
        font-size: 0.75rem;
        color: #94a3b8;
      }
      .nova-canvas-viewport {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 10px 0;
        border-radius: 8px;
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.65);
        background: #ffffff;
        overflow: hidden;
        transition: transform 0.3s ease;
      }
      #nova-pdf-bg-canvas {
        display: block;
        max-width: 100%;
        height: auto;
      }
      #nova-pdf-draw-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        cursor: crosshair;
        touch-action: none;
      }
      .nova-watermark-preview {
        position: absolute;
        left: 12px;
        right: 12px;
        text-align: center;
        font-weight: 800;
        pointer-events: none;
        word-break: break-word;
        user-select: none;
      }
      .nova-watermark-preview.pos-center {
        top: 50%;
        transform: translateY(-50%) rotate(-32deg);
      }
      .nova-watermark-preview.pos-header {
        top: 14px;
      }
      .nova-watermark-preview.pos-footer {
        bottom: 14px;
      }
      .nova-page-nav {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 12px;
      }
      /* Right: Inspector & Stamp Controls */
      .nova-inspector-pane {
        padding: 22px;
        background: #141c2b;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 16px;
      }
      .nova-card {
        background: #1e293b;
        border-radius: 14px;
        padding: 16px 18px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .nova-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        font-weight: 700;
        color: #f8fafc;
        margin-bottom: 12px;
      }
      .nova-card-title i {
        color: #818cf8;
      }
      .nova-form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
      }
      .nova-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .nova-field label {
        font-size: 0.75rem;
        color: #94a3b8;
        font-weight: 600;
      }
      .nova-input, .nova-select {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #f8fafc;
        padding: 9px 11px;
        border-radius: 8px;
        font-size: 0.85rem;
        outline: none;
      }
      .nova-input:focus, .nova-select:focus {
        border-color: #6366f1;
      }
      .nova-rot-group {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }
      .nova-rot-btn {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #cbd5e1;
        padding: 9px 6px;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      .nova-rot-btn.active {
        background: rgba(99, 102, 241, 0.22);
        border-color: #6366f1;
        color: #a5b4fc;
      }
      .nova-footer-dock {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-top: 8px;
        flex-wrap: wrap;
      }
      .nova-status {
        font-size: 0.82rem;
        color: #94a3b8;
      }
      .nova-save-btn {
        background: linear-gradient(135deg, #6366f1 0%, #2563eb 100%);
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
        box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
        transition: transform 0.15s ease, opacity 0.2s ease;
      }
      .nova-save-btn:hover {
        transform: translateY(-2px);
      }
      .nova-save-btn:disabled {
        opacity: 0.6;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  };

  // 3. Transform Directory Cards into "Nova Tools PDF Editor"
  const transformDirectoryCards = () => {
    const elements = document.querySelectorAll(
      '.tool-card, .card, .pdf-card, [data-tool], [onclick*="split" i], a[href*="split" i], div, button'
    );

    elements.forEach((el) => {
      if (el.closest('.nova-pdf-studio')) return;

      const title = el.querySelector('h2, h3, h4, h5, .card-title, .tool-title, strong');
      if (title && /(split|edit)\s*pdf/i.test(title.textContent)) {
        if (!/Nova\s*Tools\s*PDF\s*Editor/i.test(title.textContent)) {
          title.textContent = 'Nova Tools PDF Editor';
        }

        const desc = el.querySelector('p, .card-desc, .tool-desc, span:not(.badge)');
        if (desc && /split|extract|separate|annotate|watermark/i.test(desc.textContent)) {
          desc.textContent =
            'Highlight text, draw freehand annotations, insert watermarks, rotate pages, and export locally.';
        }

        const icon = el.querySelector('i.fa-scissors, i.fa-cut, i[class*="split"], i.fa-file-pdf');
        if (icon) {
          icon.className = 'fa-solid fa-file-pen';
        }
      }

      if (el.children.length === 0 && /^(split|edit)\s*pdf$/i.test((el.textContent || '').trim())) {
        el.textContent = 'Nova Tools PDF Editor';
      }
    });
  };

  // 4. Build Nova Tools PDF Editor Workspace UI
  const buildNovaWorkspace = (container) => {
    if (!container || container.querySelector('.nova-pdf-studio')) return;

    container.innerHTML = `
      <div class="nova-pdf-studio">
        <!-- Top Header -->
        <div class="nova-topbar">
          <div class="nova-brand">
            <div class="nova-brand-icon">
              <i class="fa-solid fa-file-pen"></i>
            </div>
            <div>
              <h2 class="nova-brand-title">Nova Tools PDF Editor</h2>
              <p class="nova-brand-subtitle">Highlight, Freehand Draw, Shapes, Watermarks &amp; Page Orientation</p>
            </div>
          </div>
          <span class="nova-privacy-pill">
            <i class="fa-solid fa-lock"></i> 100% Local Browser Studio
          </span>
        </div>

        <input type="file" id="nova-pdf-file-input" accept="application/pdf,.pdf" style="display:none" />

        <!-- Upload Empty State -->
        <div class="nova-upload-stage" id="nova-upload-stage">
          <div class="nova-dropzone" id="nova-dropzone">
            <div class="nova-dropzone-icon">
              <i class="fa-solid fa-cloud-arrow-up"></i>
            </div>
            <h3 style="margin: 0 0 8px 0; font-size: 1.18rem; color: #ffffff;">Open a PDF in Nova Tools PDF Editor</h3>
            <p style="margin: 0 0 18px 0; font-size: 0.86rem; color: #94a3b8;">
              Drag &amp; drop a PDF document here, or click to browse from your device
            </p>
            <span style="background: #6366f1; color: #fff; padding: 10px 22px; border-radius: 9px; font-size: 0.86rem; font-weight: 700; display: inline-flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-folder-open"></i> Select PDF Document
            </span>
          </div>
        </div>

        <!-- Active Editor Workspace -->
        <div class="nova-editor-workspace" id="nova-editor-workspace">
          <!-- Interactive Annotation & Drawing Toolbar -->
          <div class="nova-toolbar">
            <div class="nova-tool-group" id="nova-draw-tools">
              <button type="button" class="nova-tool-btn active" data-tool="highlight" title="Highlight Text">
                <i class="fa-solid fa-highlighter"></i> Highlight
              </button>
              <button type="button" class="nova-tool-btn" data-tool="pen" title="Freehand Ink Draw">
                <i class="fa-solid fa-pen-clip"></i> Freehand
              </button>
              <button type="button" class="nova-tool-btn" data-tool="rect" title="Draw Shape / Box">
                <i class="fa-regular fa-square"></i> Shape Box
              </button>
              <button type="button" class="nova-tool-btn" data-tool="textnote" title="Click on page to insert a text note">
                <i class="fa-solid fa-comment-dots"></i> Add Note
              </button>
            </div>

            <div class="nova-tool-group" id="nova-color-palette">
              <span style="font-size: 0.76rem; color: #94a3b8; margin-right: 4px;">Color:</span>
              <button type="button" class="nova-color-swatch active" data-color="#facc15" style="background: #facc15;" title="Yellow"></button>
              <button type="button" class="nova-color-swatch" data-color="#ef4444" style="background: #ef4444;" title="Crimson"></button>
              <button type="button" class="nova-color-swatch" data-color="#3b82f6" style="background: #3b82f6;" title="Blue"></button>
              <button type="button" class="nova-color-swatch" data-color="#10b981" style="background: #10b981;" title="Emerald"></button>
            </div>

            <div class="nova-tool-group">
              <button type="button" class="nova-tool-btn" id="nova-undo-btn" title="Undo last annotation on this page">
                <i class="fa-solid fa-rotate-left"></i> Undo
              </button>
              <button type="button" class="nova-tool-btn" id="nova-clear-page-btn" title="Clear annotations on this page">
                <i class="fa-solid fa-eraser"></i> Clear
              </button>
            </div>
          </div>

          <!-- Split Studio Body -->
          <div class="nova-studio-body">
            <!-- Left: Document Viewer & Interactive Canvas -->
            <div class="nova-canvas-pane">
              <div class="nova-file-bar">
                <div style="overflow: hidden;">
                  <div class="nova-file-name" id="nova-doc-name">document.pdf</div>
                  <div class="nova-file-meta" id="nova-doc-meta">0 KB • Page 1 of 1</div>
                </div>
                <button type="button" class="nova-tool-btn" id="nova-change-file-btn">
                  <i class="fa-solid fa-folder-open"></i> Change PDF
                </button>
              </div>

              <div class="nova-canvas-viewport" id="nova-canvas-viewport">
                <canvas id="nova-pdf-bg-canvas" width="420" height="594"></canvas>
                <canvas id="nova-pdf-draw-canvas" width="420" height="594"></canvas>
                <div class="nova-watermark-preview pos-center" id="nova-watermark-preview"></div>
              </div>

              <div class="nova-page-nav">
                <button type="button" class="nova-tool-btn" id="nova-prev-page">
                  <i class="fa-solid fa-chevron-left"></i> Prev
                </button>
                <span style="font-size: 0.84rem; font-weight: 600; color: #e2e8f0;" id="nova-page-indicator">
                  Page 1 / 1
                </span>
                <button type="button" class="nova-tool-btn" id="nova-next-page">
                  Next <i class="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>

            <!-- Right: Watermark, Stamp & Orientation Controls -->
            <div class="nova-inspector-pane">
              <div style="display: flex; flex-direction: column; gap: 16px;">
                <!-- Custom Text Note Input for "Add Note" tool -->
                <div class="nova-card">
                  <div class="nova-card-title">
                    <i class="fa-solid fa-pen-to-square"></i>
                    <span>Canvas Note Text (For "Add Note" Tool)</span>
                  </div>
                  <div class="nova-field">
                    <label for="nova-canvas-note-input">Click anywhere on the page with "Add Note" selected to place this text:</label>
                    <input type="text" id="nova-canvas-note-input" class="nova-input" value="Important Review Note" placeholder="Type note text to stamp on click..." />
                  </div>
                </div>

                <!-- Global Watermark & Stamp Card -->
                <div class="nova-card">
                  <div class="nova-card-title">
                    <i class="fa-solid fa-stamp"></i>
                    <span>Global Watermark / Page Stamp</span>
                  </div>
                  <div class="nova-form-grid">
                    <div class="nova-field" style="grid-column: 1 / -1;">
                      <label for="nova-wm-text">Watermark Text (Applied across all pages)</label>
                      <input type="text" id="nova-wm-text" class="nova-input" placeholder="e.g., APPROVED, DRAFT, CONFIDENTIAL..." />
                    </div>
                    <div class="nova-field">
                      <label for="nova-wm-pos">Placement</label>
                      <select id="nova-wm-pos" class="nova-select">
                        <option value="center" selected>Center Diagonal</option>
                        <option value="header">Top Header</option>
                        <option value="footer">Bottom Footer</option>
                      </select>
                    </div>
                    <div class="nova-field">
                      <label for="nova-wm-size">Font Size</label>
                      <select id="nova-wm-size" class="nova-select">
                        <option value="16">16 pt (Small)</option>
                        <option value="28">28 pt (Medium)</option>
                        <option value="42" selected>42 pt (Large Stamp)</option>
                        <option value="58">58 pt (Extra Large)</option>
                      </select>
                    </div>
                    <div class="nova-field">
                      <label for="nova-wm-color">Stamp Color</label>
                      <select id="nova-wm-color" class="nova-select">
                        <option value="indigo" selected>Nova Indigo</option>
                        <option value="red">Crimson Red</option>
                        <option value="gray">Slate Gray</option>
                        <option value="emerald">Emerald Green</option>
                        <option value="black">Solid Black</option>
                      </select>
                    </div>
                    <div class="nova-field">
                      <label for="nova-wm-opacity">Opacity</label>
                      <select id="nova-wm-opacity" class="nova-select">
                        <option value="0.25" selected>25% Watermark</option>
                        <option value="0.50">50% Medium</option>
                        <option value="0.85">85% Clear Stamp</option>
                        <option value="1.0">100% Solid</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Page Orientation Rotation -->
                <div class="nova-card">
                  <div class="nova-card-title">
                    <i class="fa-solid fa-rotate"></i>
                    <span>Page Orientation Rotation</span>
                  </div>
                  <div class="nova-rot-group" id="nova-rot-group">
                    <button type="button" class="nova-rot-btn active" data-deg="0">
                      <i class="fa-regular fa-file"></i> 0°
                    </button>
                    <button type="button" class="nova-rot-btn" data-deg="90">
                      <i class="fa-solid fa-rotate-right"></i> 90° CW
                    </button>
                    <button type="button" class="nova-rot-btn" data-deg="180">
                      <i class="fa-solid fa-arrows-rotate"></i> 180°
                    </button>
                    <button type="button" class="nova-rot-btn" data-deg="270">
                      <i class="fa-solid fa-rotate-left"></i> 270°
                    </button>
                  </div>
                </div>
              </div>

              <!-- Save & Download Action Bar -->
              <div class="nova-footer-dock">
                <span class="nova-status" id="nova-status-text">Ready to annotate and save.</span>
                <button type="button" class="nova-save-btn" id="nova-save-btn">
                  <i class="fa-solid fa-download"></i>
                  <span>Save &amp; Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    bindNovaStudioEvents(container);
  };

  // 5. Bind Interactive Drawing, Rendering, and PDF-Lib Export Logic
  const bindNovaStudioEvents = (container) => {
    let rawPdfBytes = null;
    let pdfJsDoc = null;
    let currentFileName = 'document.pdf';
    let currentFileSize = 0;
    let totalPages = 1;
    let currentPage = 1;
    let rotationDeg = 0;

    // Active drawing state
    let activeTool = 'highlight'; // 'highlight' | 'pen' | 'rect' | 'textnote'
    let activeColor = '#facc15';
    let isDrawing = false;
    let currentStroke = null;
    // Map of pageNumber -> array of annotation objects
    const pageAnnotations = new Map();

    const fileInput = container.querySelector('#nova-pdf-file-input');
    const uploadStage = container.querySelector('#nova-upload-stage');
    const dropzone = container.querySelector('#nova-dropzone');
    const workspace = container.querySelector('#nova-editor-workspace');
    const docNameEl = container.querySelector('#nova-doc-name');
    const docMetaEl = container.querySelector('#nova-doc-meta');
    const changeFileBtn = container.querySelector('#nova-change-file-btn');

    const viewportEl = container.querySelector('#nova-canvas-viewport');
    const bgCanvas = container.querySelector('#nova-pdf-bg-canvas');
    const drawCanvas = container.querySelector('#nova-pdf-draw-canvas');
    const bgCtx = bgCanvas.getContext('2d');
    const drawCtx = drawCanvas.getContext('2d');
    const wmPreview = container.querySelector('#nova-watermark-preview');

    const prevPageBtn = container.querySelector('#nova-prev-page');
    const nextPageBtn = container.querySelector('#nova-next-page');
    const pageIndicator = container.querySelector('#nova-page-indicator');

    const drawToolsGroup = container.querySelector('#nova-draw-tools');
    const colorPalette = container.querySelector('#nova-color-palette');
    const undoBtn = container.querySelector('#nova-undo-btn');
    const clearPageBtn = container.querySelector('#nova-clear-page-btn');
    const canvasNoteInput = container.querySelector('#nova-canvas-note-input');

    const wmText = container.querySelector('#nova-wm-text');
    const wmPos = container.querySelector('#nova-wm-pos');
    const wmSize = container.querySelector('#nova-wm-size');
    const wmColor = container.querySelector('#nova-wm-color');
    const wmOpacity = container.querySelector('#nova-wm-opacity');
    const rotGroup = container.querySelector('#nova-rot-group');
    const statusText = container.querySelector('#nova-status-text');
    const saveBtn = container.querySelector('#nova-save-btn');

    const formatBytes = (bytes) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1048576).toFixed(2)} MB`;
    };

    const getAnnotationsForPage = (pageNum) => {
      if (!pageAnnotations.has(pageNum)) {
        pageAnnotations.set(pageNum, []);
      }
      return pageAnnotations.get(pageNum);
    };

    // Render all annotations for the current page onto drawCanvas
    const redrawAnnotations = () => {
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      const list = getAnnotationsForPage(currentPage);
      const allToDraw = currentStroke ? [...list, currentStroke] : list;

      allToDraw.forEach((item) => {
        drawCtx.save();
        if (item.type === 'highlight' || item.type === 'pen') {
          if (item.points.length < 2) {
            drawCtx.restore();
            return;
          }
          drawCtx.beginPath();
          drawCtx.moveTo(item.points[0].x, item.points[0].y);
          for (let i = 1; i < item.points.length; i++) {
            drawCtx.lineTo(item.points[i].x, item.points[i].y);
          }
          drawCtx.strokeStyle = item.color;
          drawCtx.lineWidth = item.type === 'highlight' ? 18 : 3.2;
          drawCtx.lineCap = 'round';
          drawCtx.lineJoin = 'round';
          drawCtx.globalAlpha = item.type === 'highlight' ? 0.38 : 0.95;
          drawCtx.stroke();
        } else if (item.type === 'rect') {
          drawCtx.strokeStyle = item.color;
          drawCtx.lineWidth = 2.8;
          drawCtx.globalAlpha = 0.9;
          drawCtx.strokeRect(item.x, item.y, item.w, item.h);
          drawCtx.fillStyle = item.color;
          drawCtx.globalAlpha = 0.12;
          drawCtx.fillRect(item.x, item.y, item.w, item.h);
        } else if (item.type === 'textnote') {
          drawCtx.font = 'bold 14px system-ui, sans-serif';
          const padding = 6;
          const metrics = drawCtx.measureText(item.text);
          const boxW = metrics.width + padding * 2;
          const boxH = 24;
          drawCtx.fillStyle = '#0f172a';
          drawCtx.globalAlpha = 0.85;
          drawCtx.fillRect(item.x, item.y - boxH + 4, boxW, boxH);
          drawCtx.strokeStyle = item.color;
          drawCtx.lineWidth = 1.5;
          drawCtx.strokeRect(item.x, item.y - boxH + 4, boxW, boxH);
          drawCtx.fillStyle = item.color;
          drawCtx.globalAlpha = 1;
          drawCtx.fillText(item.text, item.x + padding, item.y);
        }
        drawCtx.restore();
      });
    };

    // Render PDF background page via pdf.js or clean fallback sheet
    const renderCurrentPageBackground = async () => {
      pageIndicator.textContent = `Page ${currentPage} / ${totalPages}`;
      docMetaEl.textContent = `${formatBytes(currentFileSize)} • ${totalPages} ${totalPages === 1 ? 'Page' : 'Pages'}`;

      if (pdfJsDoc) {
        try {
          const page = await pdfJsDoc.getPage(currentPage);
          const baseViewport = page.getViewport({ scale: 1 });
          const targetWidth = 420;
          const scale = targetWidth / baseViewport.width;
          const scaledViewport = page.getViewport({ scale });

          bgCanvas.width = Math.floor(scaledViewport.width);
          bgCanvas.height = Math.floor(scaledViewport.height);
          drawCanvas.width = bgCanvas.width;
          drawCanvas.height = bgCanvas.height;

          await page.render({
            canvasContext: bgCtx,
            viewport: scaledViewport
          }).promise;
          redrawAnnotations();
          return;
        } catch (e) {
          // Fall through to simulated page sheet if pdf.js encounters an issue
        }
      }

      // Clean fallback document page sheet
      bgCanvas.width = 420;
      bgCanvas.height = 594;
      drawCanvas.width = 420;
      drawCanvas.height = 594;
      bgCtx.fillStyle = '#ffffff';
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

      bgCtx.fillStyle = '#cbd5e1';
      bgCtx.fillRect(36, 42, 180, 14);
      bgCtx.fillStyle = '#e2e8f0';
      for (let y = 80; y < 520; y += 22) {
        bgCtx.fillRect(36, y, y % 44 === 0 ? 310 : 348, 8);
      }
      bgCtx.fillStyle = '#64748b';
      bgCtx.font = '12px sans-serif';
      bgCtx.fillText(`${currentFileName} — Page ${currentPage}`, 36, 565);

      redrawAnnotations();
    };

    // Update live watermark & rotation preview
    const updateWatermarkAndRotationPreview = () => {
      viewportEl.style.transform = `rotate(${rotationDeg}deg)`;
      const text = (wmText.value || '').trim();
      wmPreview.textContent = text;
      wmPreview.className = `nova-watermark-preview pos-${wmPos.value}`;

      const colorHexMap = {
        indigo: '#4f46e5',
        red: '#dc2626',
        gray: '#475569',
        emerald: '#059669',
        black: '#0f172a'
      };
      wmPreview.style.color = colorHexMap[wmColor.value] || '#4f46e5';
      wmPreview.style.opacity = wmOpacity.value;
      const previewPx = Math.max(11, Math.round(parseFloat(wmSize.value) * 0.55));
      wmPreview.style.fontSize = `${previewPx}px`;
    };

    // Pointer coordinate helper on drawCanvas
    const getCanvasCoords = (e) => {
      const rect = drawCanvas.getBoundingClientRect();
      const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
      const scaleX = drawCanvas.width / rect.width;
      const scaleY = drawCanvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const onPointerDown = (e) => {
      e.preventDefault();
      const pt = getCanvasCoords(e);

      if (activeTool === 'textnote') {
        const noteStr = (canvasNoteInput.value || 'Note').trim();
        if (noteStr) {
          getAnnotationsForPage(currentPage).push({
            type: 'textnote',
            x: pt.x,
            y: pt.y,
            text: noteStr,
            color: activeColor
          });
          redrawAnnotations();
          statusText.textContent = `Added text note on Page ${currentPage}.`;
        }
        return;
      }

      isDrawing = true;
      if (activeTool === 'highlight' || activeTool === 'pen') {
        currentStroke = {
          type: activeTool,
          color: activeColor,
          points: [pt]
        };
      } else if (activeTool === 'rect') {
        currentStroke = {
          type: 'rect',
          color: activeColor,
          startX: pt.x,
          startY: pt.y,
          x: pt.x,
          y: pt.y,
          w: 0,
          h: 0
        };
      }
      redrawAnnotations();
    };

    const onPointerMove = (e) => {
      if (!isDrawing || !currentStroke) return;
      e.preventDefault();
      const pt = getCanvasCoords(e);

      if (currentStroke.type === 'highlight' || currentStroke.type === 'pen') {
        currentStroke.points.push(pt);
      } else if (currentStroke.type === 'rect') {
        currentStroke.x = Math.min(currentStroke.startX, pt.x);
        currentStroke.y = Math.min(currentStroke.startY, pt.y);
        currentStroke.w = Math.abs(pt.x - currentStroke.startX);
        currentStroke.h = Math.abs(pt.y - currentStroke.startY);
      }
      redrawAnnotations();
    };

    const onPointerUp = () => {
      if (!isDrawing || !currentStroke) return;
      isDrawing = false;
      getAnnotationsForPage(currentPage).push(currentStroke);
      currentStroke = null;
      redrawAnnotations();
      statusText.textContent = `Annotation recorded on Page ${currentPage}.`;
    };

    drawCanvas.addEventListener('mousedown', onPointerDown);
    drawCanvas.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    drawCanvas.addEventListener('touchstart', onPointerDown, { passive: false });
    drawCanvas.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);

    // Toolbar Events
    drawToolsGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.nova-tool-btn');
      if (!btn) return;
      drawToolsGroup.querySelectorAll('.nova-tool-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeTool = btn.getAttribute('data-tool') || 'highlight';
    });

    colorPalette.addEventListener('click', (e) => {
      const swatch = e.target.closest('.nova-color-swatch');
      if (!swatch) return;
      colorPalette.querySelectorAll('.nova-color-swatch').forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      activeColor = swatch.getAttribute('data-color') || '#facc15';
    });

    undoBtn.addEventListener('click', () => {
      const list = getAnnotationsForPage(currentPage);
      if (list.length > 0) {
        list.pop();
        redrawAnnotations();
        statusText.textContent = `Undid last annotation on Page ${currentPage}.`;
      }
    });

    clearPageBtn.addEventListener('click', () => {
      pageAnnotations.set(currentPage, []);
      redrawAnnotations();
      statusText.textContent = `Cleared annotations on Page ${currentPage}.`;
    });

    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderCurrentPageBackground();
      }
    });

    nextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderCurrentPageBackground();
      }
    });

    [wmText, wmPos, wmSize, wmColor, wmOpacity].forEach((el) => {
      el.addEventListener('input', updateWatermarkAndRotationPreview);
      el.addEventListener('change', updateWatermarkAndRotationPreview);
    });

    rotGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.nova-rot-btn');
      if (!btn) return;
      rotGroup.querySelectorAll('.nova-rot-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      rotationDeg = parseInt(btn.getAttribute('data-deg') || '0', 10);
      updateWatermarkAndRotationPreview();
    });

    // Load PDF File
    const handleFileLoad = async (file) => {
      if (!file) return;
      try {
        statusText.textContent = 'Loading PDF into Nova Tools PDF Editor...';
        const buffer = await file.arrayBuffer();
        rawPdfBytes = buffer;
        currentFileName = file.name;
        currentFileSize = file.size;
        pageAnnotations.clear();
        currentPage = 1;

        const PDFLib = await ensurePdfLib();
        const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
        totalPages = pdfDoc.getPageCount();

        const pdfjsLib = await ensurePdfJs();
        if (pdfjsLib) {
          try {
            pdfJsDoc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
          } catch (e) {
            pdfJsDoc = null;
          }
        }

        docNameEl.textContent = file.name;
        uploadStage.style.display = 'none';
        workspace.classList.add('active');

        await renderCurrentPageBackground();
        updateWatermarkAndRotationPreview();
        statusText.textContent = `Loaded ${totalPages} page(s). Use the toolbar above to highlight, draw, or stamp.`;
      } catch (err) {
        console.error('Error loading PDF:', err);
        alert('Could not open this PDF file. Please select a valid PDF document.');
      }
    };

    dropzone.addEventListener('click', () => fileInput.click());
    changeFileBtn.addEventListener('click', () => fileInput.click());

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

    // Helper to convert hex color to pdf-lib rgb
    const hexToPdfRgb = (hex, rgbFn) => {
      const clean = (hex || '#facc15').replace('#', '');
      const r = parseInt(clean.substring(0, 2), 16) / 255;
      const g = parseInt(clean.substring(2, 4), 16) / 255;
      const b = parseInt(clean.substring(4, 6), 16) / 255;
      return rgbFn(isNaN(r) ? 0.9 : r, isNaN(g) ? 0.8 : g, isNaN(b) ? 0.1 : b);
    };

    // Save & Download Annotated PDF via pdf-lib
    saveBtn.addEventListener('click', async () => {
      if (!rawPdfBytes) return;

      saveBtn.disabled = true;
      const origHTML = saveBtn.innerHTML;
      saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Compiling PDF...</span>';
      statusText.textContent = 'Embedding annotations, watermarks & orientation via pdf-lib...';

      try {
        const PDFLib = await ensurePdfLib();
        const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

        const pdfDoc = await PDFDocument.load(rawPdfBytes, { ignoreEncryption: true });
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();

        const stampColors = {
          indigo: rgb(0.31, 0.27, 0.9),
          red: rgb(0.86, 0.15, 0.15),
          gray: rgb(0.35, 0.4, 0.48),
          emerald: rgb(0.02, 0.59, 0.41),
          black: rgb(0.08, 0.08, 0.08)
        };

        const rawWm = (wmText.value || '').trim().replace(/[^\x20-\x7E]/g, '');
        const pos = wmPos.value;
        const size = parseFloat(wmSize.value) || 42;
        const wmRgb = stampColors[wmColor.value] || stampColors.indigo;
        const opacity = parseFloat(wmOpacity.value) || 0.25;

        const canvasW = drawCanvas.width || 420;
        const canvasH = drawCanvas.height || 594;

        pages.forEach((page, idx) => {
          const pageNumber = idx + 1;
          const { width, height } = page.getSize();
          const scaleX = width / canvasW;
          const scaleY = height / canvasH;

          // 1. Render Freehand, Highlight, Shape & Note Annotations for this page
          const annots = pageAnnotations.get(pageNumber) || [];
          annots.forEach((item) => {
            const itemColor = hexToPdfRgb(item.color, rgb);

            if ((item.type === 'highlight' || item.type === 'pen') && item.points.length >= 2) {
              const thickness = (item.type === 'highlight' ? 18 : 3.2) * scaleX;
              const alpha = item.type === 'highlight' ? 0.35 : 0.95;
              for (let i = 1; i < item.points.length; i++) {
                const p1 = item.points[i - 1];
                const p2 = item.points[i];
                page.drawLine({
                  start: { x: p1.x * scaleX, y: height - p1.y * scaleY },
                  end: { x: p2.x * scaleX, y: height - p2.y * scaleY },
                  thickness,
                  color: itemColor,
                  opacity: alpha
                });
              }
            } else if (item.type === 'rect') {
              const rx = item.x * scaleX;
              const ry = height - (item.y + item.h) * scaleY;
              const rw = item.w * scaleX;
              const rh = item.h * scaleY;
              page.drawRectangle({
                x: rx,
                y: ry,
                width: rw,
                height: rh,
                borderColor: itemColor,
                borderWidth: 2.5 * scaleX,
                color: itemColor,
                opacity: 0.12,
                borderOpacity: 0.9
              });
            } else if (item.type === 'textnote') {
              const safeNote = (item.text || '').replace(/[^\x20-\x7E]/g, '');
              if (safeNote) {
                page.drawText(safeNote, {
                  x: item.x * scaleX,
                  y: height - item.y * scaleY,
                  size: 13 * scaleX,
                  font,
                  color: itemColor
                });
              }
            }
          });

          // 2. Apply Global Watermark / Stamp
          if (rawWm) {
            const textWidth = font.widthOfTextAtSize(rawWm, size);
            if (pos === 'center') {
              page.drawText(rawWm, {
                x: Math.max(20, (width - textWidth * 0.78) / 2),
                y: height / 2,
                size,
                font,
                color: wmRgb,
                opacity,
                rotate: degrees(32)
              });
            } else if (pos === 'header') {
              page.drawText(rawWm, {
                x: Math.max(24, (width - textWidth) / 2),
                y: height - Math.max(36, size + 14),
                size,
                font,
                color: wmRgb,
                opacity
              });
            } else if (pos === 'footer') {
              page.drawText(rawWm, {
                x: Math.max(24, (width - textWidth) / 2),
                y: 28,
                size,
                font,
                color: wmRgb,
                opacity
              });
            }
          }

          // 3. Apply Page Orientation Rotation
          if (rotationDeg !== 0) {
            const currentRot = page.getRotation().angle || 0;
            page.setRotation(degrees((currentRot + rotationDeg) % 360));
          }
        });

        const outBytes = await pdfDoc.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const cleanBase = currentFileName.replace(/\.pdf$/i, '');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cleanBase}-nova-edited.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);

        statusText.textContent = 'Edited PDF exported and downloaded!';
      } catch (err) {
        console.error('Export error:', err);
        statusText.textContent = 'Error saving PDF. Please verify the file is not write-protected.';
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origHTML;
      }
    });
  };

  // 6. Locate & Upgrade the Split/Edit PDF Workspace Container
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
        buildNovaWorkspace(target);
        return;
      }
    }

    const headings = document.querySelectorAll('h1, h2, h3');
    headings.forEach((h) => {
      const text = (h.textContent || '').trim();
      if (/^(split|edit|nova\s*tools)\s*pdf/i.test(text)) {
        if (h.closest('.tool-card, .card, .grid-item, .nova-pdf-studio')) return;
        const container =
          h.closest('.workspace, .tool-workspace, .tool-container, .pdf-workspace, section, .modal-body') ||
          h.parentElement;
        if (container && !container.querySelector('.nova-pdf-studio')) {
          buildNovaWorkspace(container);
        }
      }
    });
  };

  // 7. Initialize & Observe DOM
  const init = () => {
    injectStyles();
    ensurePdfLib().catch(() => {});
    ensurePdfJs().catch(() => {});
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
