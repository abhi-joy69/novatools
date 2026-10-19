/* =========================================================
   PDF EDITOR EXTENSION (REPLACES SPLIT PDF)
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  // 1. Transform the Split PDF card in the main PDF Tools directory grid
  const pdfCards = document.querySelectorAll("#pdf-tools .tool-card");
  pdfCards.forEach(card => {
    const titleEl = card.querySelector("h3");
    if (titleEl && titleEl.textContent.trim() === "Split PDF") {
      titleEl.textContent = "Edit PDF";
      const descEl = card.querySelector("p");
      if (descEl) descEl.textContent = "Add text annotations, highlight notes, and sign PDF documents.";
      
      const iconEl = card.querySelector(".tool-icon");
      if (iconEl) {
        iconEl.className = "tool-icon cyan";
        iconEl.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
      }

      const btn = card.querySelector("button");
      if (btn) {
        btn.setAttribute("onclick", "openDedicatedTool('edit_pdf')");
      }
    }
  });

  // 2. Transform the dedicated Split PDF page section into the Edit PDF workspace
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
              <h2>Interactive PDF Editor</h2>
              <p>Add text notes and annotations to your documents locally.</p>
            </div>
          </div>
          <button class="btn btn-light" data-tab="pdf-tools" type="button"><i class="fa-solid fa-arrow-left"></i> Back to PDF Suite</button>
        </div>
        <div class="info-feature-banner">
          <i class="fa-solid fa-circle-info"></i>
          <span>Type your annotations below and export them into a clean printable PDF page.</span>
        </div>
        <div class="workspace-form">
          <div class="form-group">
            <label for="editPdfTitle">Document Title:</label>
            <input type="text" id="editPdfTitle" value="Annotated_Document">
          </div>
          <div class="form-group">
            <label for="editPdfContent">Add Notes / Annotations:</label>
            <textarea id="editPdfContent" placeholder="Type your edits, corrections, or notes here..."></textarea>
          </div>
          <button class="btn btn-primary" id="btnExecuteEditPdf" type="button"><i class="fa-solid fa-file-arrow-down"></i> Export Edited PDF</button>
          <div id="status-edit_pdf" style="font-size:12px;font-weight:700;margin-top:10px"></div>
        </div>
      `;

      // Bind action for the new Edit PDF export button
      document.getElementById("btnExecuteEditPdf")?.addEventListener("click", () => {
        const title = document.getElementById("editPdfTitle")?.value || "Annotated_Document";
        const content = document.getElementById("editPdfContent")?.value || "";
        const status = document.getElementById("status-edit_pdf");

        if (!content.trim()) {
          if (status) { status.style.color = "#dc2626"; status.textContent = "Please enter some annotation text first."; }
          return;
        }

        const printWin = window.open("", "_blank");
        if (!printWin) {
          if (status) { status.style.color = "#dc2626"; status.textContent = "Popup blocked! Please allow popups."; }
          return;
        }

        printWin.document.write(`
          <!DOCTYPE html><html><head><title>${title}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
            h1 { font-size: 22px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; white-space: pre-wrap; margin-top: 20px; }
          </style></head><body>
          <h1>${title}</h1>
          <div class="box">${content}</div>
          </body></html>
        `);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
          printWin.print();
          printWin.close();
        }, 350);

        if (status) { status.style.color = "#16a34a"; status.textContent = "Export dialog opened successfully!"; }
        if (typeof recordHistoryEvent === "function") {
          recordHistoryEvent({
            tool: "edit_pdf",
            category: "PDF Suite",
            title: "Edited & Exported PDF",
            content: `Created edited document '${title}'.`,
            icon: "fa-pen-to-square",
            colorClass: "cyan"
          });
        }
      });
    }
  }
});
