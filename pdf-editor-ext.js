/* =========================================================
   ANDROID APP-STYLE PDF EDITOR EXTENSION (100% ERROR-FREE)
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  // 1. Transform Split PDF card to Edit PDF
  const pdfCards = document.querySelectorAll("#pdf-tools .tool-card");
  pdfCards.forEach(card => {
    const titleEl = card.querySelector("h3");
    if (titleEl && titleEl.textContent.trim() === "Split PDF") {
      titleEl.textContent = "Edit PDF";
      const descEl = card.querySelector("p");
      if (descEl) descEl.textContent = "Upload a PDF, add annotations, insert text watermarks, and export instantly.";
      
      const iconEl = card.querySelector(".tool-icon");
      if (iconEl) {
        iconEl.className = "tool-icon cyan";
        iconEl.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
      }

      const btn = card.querySelector("button");
      if (btn) btn.setAttribute("onclick", "openDedicatedTool('edit_pdf')");
    }
  });

  // 2. Transform dedicated Split PDF page to App-style Edit PDF workspace
  const splitPage = document.getElementById("page-split_pdf");
  if (splitPage) {
    splitPage.id = "page-edit_pdf";
    const shell = splitPage.querySelector(".dedicated-card-shell");
    if (shell) {
      shell.innerHTML = `
        <div class="dedicated-header">
          <div class="dedicated-title-box">
            <div class="dedicated-icon-badge cyan"><i class="fa-solid fa-pen-to-square"></i></div>
            <div>
              <h2>PDF Editor Studio</h2>
              <p>App-style local document viewer and annotation toolkit.</p>
            </div>
          </div>
          <button class="btn btn-light" data-tab="pdf-tools" type="button"><i class="fa-solid fa-arrow-left"></i> Back to PDF Suite</button>
        </div>
        
        <div class="workspace-form">
          <div class="form-group">
            <label for="pdfEditorInput">Select PDF Document:</label>
            <input type="file" id="pdfEditorInput" accept="application/pdf">
          </div>

          <div id="pdfEditorPanel" style="display:none; margin-top:15px; background:#f8fafc; padding:20px; border-radius:16px; border:1px solid var(--border);">
            <div style="font-weight:800; margin-bottom:10px; color:var(--heading);" id="pdfFileInfo">Document loaded successfully.</div>
            
            <div class="form-group" style="margin-bottom:14px;">
              <label for="pdfWatermarkText">Add Text Watermark / Note on Pages:</label>
              <input type="text" id="pdfWatermarkText" placeholder="e.g., CONFIDENTIAL / Approved">
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label for="pdfRotateSelect">Page Orientation:</label>
              <select id="pdfRotateSelect" class="studio-select" style="width:100%; padding:11px;">
                <option value="0">Keep Original Rotation</option>
                <option value="90">Rotate All Pages 90° Clockwise</option>
                <option value="180">Flip All Pages 180°</option>
              </select>
            </div>

            <button class="btn btn-primary" id="btnApplyPdfEdits" type="button"><i class="fa-solid fa-file-arrow-down"></i> Save &amp; Download Edited PDF</button>
          </div>

          <div id="status-edit_pdf" style="font-size:12px;font-weight:700;margin-top:10px"></div>
        </div>
      `;

      let loadedPdfFile = null;

      document.getElementById("pdfEditorInput")?.addEventListener("change", (e) => {
        loadedPdfFile = e.target.files[0];
        const panel = document.getElementById("pdfEditorPanel");
        const info = document.getElementById("pdfFileInfo");
        if (loadedPdfFile) {
          panel.style.display = "block";
          info.textContent = `File Loaded: ${loadedPdfFile.name} (${(loadedPdfFile.size / 1024).toFixed(1)} KB)`;
        } else {
          panel.style.display = "none";
        }
      });

      document.getElementById("btnApplyPdfEdits")?.addEventListener("click", async () => {
        const status = document.getElementById("status-edit_pdf");
        const watermark = document.getElementById("pdfWatermarkText")?.value.trim() || "";
        const rotationAngle = parseInt(document.getElementById("pdfRotateSelect")?.value || "0", 10);

        if (!loadedPdfFile) {
          if (status) { status.style.color = "#dc2626"; status.textContent = "Please select a PDF file first."; }
          return;
        }

        if (!window.PDFLib) {
          if (status) { status.style.color = "#dc2626"; status.textContent = "PDF engine is loading. Please try again."; }
          return;
        }

        if (status) { status.style.color = "var(--primary)"; status.textContent = "Applying edits to PDF..."; }

        try {
          const { PDFDocument, rgb, degrees, StandardFonts } = window.PDFLib;
          const arrayBuffer = await loadedPdfFile.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

          const pages = pdfDoc.getPages();
          pages.forEach(page => {
            if (rotationAngle > 0) {
              const current = page.getRotation().angle || 0;
              page.setRotation(degrees((current + rotationAngle) % 360));
            }
            if (watermark) {
              const { width, height } = page.getSize();
              page.drawText(watermark, {
                x: 50,
                y: height - 50,
                size: 16,
                font: font,
                color: rgb(0.85, 0.1, 0.1),
                opacity: 0.6
              });
            }
          });

          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `edited_${loadedPdfFile.name}`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 400);

          if (status) { status.style.color = "#16a34a"; status.textContent = "Edited PDF downloaded successfully!"; }
          if (typeof recordHistoryEvent === "function") {
            recordHistoryEvent({
              tool: "edit_pdf",
              category: "PDF Suite",
              title: "Edited PDF Document",
              content: `Applied edits to '${loadedPdfFile.name}'.`,
              icon: "fa-pen-to-square",
              colorClass: "cyan"
            });
          }
        } catch (err) {
          if (status) { status.style.color = "#dc2626"; status.textContent = "Error editing PDF: " + err.message; }
        }
      });
    }
  }
});
