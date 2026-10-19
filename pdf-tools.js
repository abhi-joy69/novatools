/* =========================================================
   IN-BROWSER PDF SUITE & MS WORD LIVE STUDIO
========================================================= */

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function logPdfHistory(toolName, title, content, icon, color) {
  if (typeof recordHistoryEvent === "function") {
    recordHistoryEvent({
      tool: toolName,
      category: "PDF Suite",
      title: title,
      content: content,
      icon: icon,
      colorClass: color
    });
  }
}

// WYSIWYG editor controls
window.applyCanvasFontFamily = function(font) {
  const canvas = document.getElementById("wordCanvas");
  if (canvas) canvas.style.fontFamily = font;
};

window.applyCanvasFontSize = function(size) {
  const canvas = document.getElementById("wordCanvas");
  if (canvas) canvas.style.fontSize = size;
};

window.toggleFormat = function(command) {
  document.execCommand(command, false, null);
  const canvas = document.getElementById("wordCanvas");
  if (canvas) canvas.focus();
};

window.setTextAlign = function(align) {
  const canvas = document.getElementById("wordCanvas");
  if (canvas) canvas.style.textAlign = align;
};

window.handlePageSizeChange = function() {
  const size = document.getElementById("pdfPageSize")?.value;
  const customRow = document.getElementById("customSizeRow");
  if (customRow) customRow.style.display = size === "Custom" ? "grid" : "none";
  updatePageCanvasPreview();
};

window.updatePageCanvasPreview = function() {
  const canvas = document.getElementById("wordCanvas");
  const borderEl = document.getElementById("pdfBorderStyle");
  const sizeEl = document.getElementById("pdfPageSize");
  if (!canvas || !borderEl || !sizeEl) return;

  const border = borderEl.value;
  const size = sizeEl.value;

  canvas.className = "word-page-canvas border-style-" + border;

  if (size === "A3") {
    canvas.style.maxWidth = "750px";
    canvas.style.minHeight = "700px";
  } else if (size === "A5") {
    canvas.style.maxWidth = "450px";
    canvas.style.minHeight = "380px";
  } else if (size === "Legal") {
    canvas.style.maxWidth = "600px";
    canvas.style.minHeight = "640px";
  } else if (size === "Letter") {
    canvas.style.maxWidth = "600px";
    canvas.style.minHeight = "500px";
  } else if (size === "Tabloid") {
    canvas.style.maxWidth = "720px";
    canvas.style.minHeight = "750px";
  } else if (size === "Executive") {
    canvas.style.maxWidth = "520px";
    canvas.style.minHeight = "480px";
  } else if (size === "Custom") {
    const w = Number(document.getElementById("customWidthMm")?.value) || 210;
    const h = Number(document.getElementById("customHeightMm")?.value) || 297;
    canvas.style.maxWidth = Math.min(Math.max(w * 2.2, 350), 750) + "px";
    canvas.style.minHeight = Math.min(Math.max(h * 2.2, 300), 850) + "px";
  } else {
    canvas.style.maxWidth = "600px";
    canvas.style.minHeight = "480px";
  }
};

function initPdfSuite() {
  function bindClick(possibleIds, handler) {
    for (const id of possibleIds) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("click", handler);
        return;
      }
    }
  }

  // 1. PHOTO TO PDF
  bindClick(["btnExecutePhotoPdf", "executePhotoPdf"], async () => {
    const status = document.getElementById("status-photo_to_pdf") || document.getElementById("photoPdfStatus");
    const input = document.getElementById("pdfPhotoInput") || document.getElementById("photoInput");
    const docTitleInput = document.getElementById("pdfPhotoDocTitle") || document.getElementById("photoDocTitle");
    const files = Array.from(input?.files || []);
    const docName = docTitleInput?.value.trim() || "Photos_Archive";

    if (!files.length) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Please select at least one JPG or PNG photo."; }
      return;
    }

    if (status) { status.style.color = "var(--primary)"; status.textContent = "Processing images into PDF..."; }

    try {
      const PDFLibEngine = window.PDFLib;
      if (!PDFLibEngine) throw new Error("PDF Engine is not ready. Please refresh the page.");

      const pdfDoc = await PDFLibEngine.PDFDocument.create();
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        let img;
        if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
          img = await pdfDoc.embedPng(bytes);
        } else {
          img = await pdfDoc.embedJpg(bytes);
        }
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `${docName}.pdf`);

      if (status) { status.style.color = "#16a34a"; status.textContent = "Photo PDF created and downloaded successfully!"; }
      logPdfHistory("photo_to_pdf", "Converted Photos to PDF", `Exported ${files.length} image(s) to '${docName}.pdf'.`, "fa-file-image", "blue");
    } catch (err) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Error: " + err.message; }
    }
  });

  // 2. TEXT TO PDF
  bindClick(["btnExecuteTextPdf", "executeTextPdf"], () => {
    const status = document.getElementById("status-text_to_pdf") || document.getElementById("textPdfStatus");
    const canvas = document.getElementById("wordCanvas");
    const docTitleInput = document.getElementById("pdfDocTitle") || document.getElementById("textDocTitle");
    const docName = docTitleInput?.value.trim() || "My_Document";
    const content = canvas ? canvas.innerHTML : "";

    if (!canvas || !canvas.innerText.trim()) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Please type document content on the page first."; }
      return;
    }

    const border = document.getElementById("pdfBorderStyle")?.value || "none";
    const borderClasses = {
      none: "border: 0;",
      solid: "border: 2px solid #0f172a;",
      thick: "border: 5px solid #0f172a;",
      double: "border: 6px double #0f172a;",
      dashed: "border: 2px dashed #64748b;",
      dotted: "border: 2px dotted #64748b;",
      frame: "border: 6px solid #0f172a; padding: 28px;"
    };

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docName}</title>
          <style>
            @page { size: auto; margin: 15mm; }
            body { margin: 0; font-family: sans-serif; -webkit-print-color-adjust: exact; }
            .document-sheet {
              max-width: 800px;
              margin: auto;
              padding: 30px;
              min-height: 90vh;
              box-sizing: border-box;
              ${borderClasses[border] || ""}
            }
          </style>
        </head>
        <body>
          <div class="document-sheet">${content}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);

    if (status) { status.style.color = "#16a34a"; status.textContent = "Print & PDF export dialog opened successfully!"; }
    logPdfHistory("text_to_pdf", "Exported Document", `Generated printable PDF for '${docName}'.`, "fa-file-word", "purple");
  });

  // 3. MERGE PDF FILES
  const mergeInput = document.getElementById("pdfMergeInput") || document.getElementById("mergeInput");
  if (mergeInput) {
    mergeInput.addEventListener("change", () => {
      const list = document.getElementById("mergeFileList") || document.getElementById("mergeList");
      const files = Array.from(mergeInput.files || []);
      if (list) list.innerHTML = files.map((f, i) => `${i + 1}. ${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join("<br>");
    });
  }

  bindClick(["btnExecuteMergePdf", "executeMergePdf"], async () => {
    const status = document.getElementById("status-merge_pdf") || document.getElementById("mergePdfStatus");
    const input = document.getElementById("pdfMergeInput") || document.getElementById("mergeInput");
    const files = Array.from(input?.files || []);

    if (files.length < 2) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Please select at least 2 PDF files to merge."; }
      return;
    }

    if (status) { status.style.color = "var(--primary)"; status.textContent = "Merging PDF files..."; }

    try {
      const PDFLibEngine = window.PDFLib;
      if (!PDFLibEngine) throw new Error("PDF Engine is not ready. Please refresh the page.");

      const mergedDoc = await PDFLibEngine.PDFDocument.create();
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const doc = await PDFLibEngine.PDFDocument.load(buffer);
        const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => mergedDoc.addPage(p));
      }
      const pdfBytes = await mergedDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), "merged_document.pdf");

      if (status) { status.style.color = "#16a34a"; status.textContent = "Merged PDF downloaded successfully!"; }
      logPdfHistory("merge_pdf", "Merged PDFs", `Merged ${files.length} PDFs into one.`, "fa-layer-group", "emerald");
    } catch (err) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Error: " + err.message; }
    }
  });

  // 4. SPLIT PDF
  bindClick(["btnExecuteSplitPdf", "executeSplitPdf"], async () => {
    const status = document.getElementById("status-split_pdf") || document.getElementById("splitPdfStatus");
    const input = document.getElementById("pdfSplitInput") || document.getElementById("splitInput");
    const file = input?.files[0];

    if (!file) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Please select a PDF file first."; }
      return;
    }

    if (status) { status.style.color = "var(--primary)"; status.textContent = "Extracting page 1..."; }

    try {
      const PDFLibEngine = window.PDFLib;
      if (!PDFLibEngine) throw new Error("PDF Engine is not ready. Please refresh the page.");

      const buffer = await file.arrayBuffer();
      const srcDoc = await PDFLibEngine.PDFDocument.load(buffer);
      const newDoc = await PDFLibEngine.PDFDocument.create();
      const [page] = await newDoc.copyPages(srcDoc, [0]);
      newDoc.addPage(page);
      const pdfBytes = await newDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), "split_page_1.pdf");

      if (status) { status.style.color = "#16a34a"; status.textContent = "Page 1 extracted and downloaded successfully!"; }
      logPdfHistory("split_pdf", "Split PDF Document", `Extracted page 1 from '${file.name}'.`, "fa-scissors", "cyan");
    } catch (err) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Error: " + err.message; }
    }
  });

  // 5. EXTRACT PAGES
  bindClick(["btnExecuteExtractPdf", "executeExtractPdf"], async () => {
    const status = document.getElementById("status-extract_pdf") || document.getElementById("extractPdfStatus");
    const input = document.getElementById("pdfExtractInput") || document.getElementById("extractInput");
    const pageInput = document.getElementById("pdfExtractPages") || document.getElementById("extractPages");
    const file = input?.files[0];
    const pageStr = pageInput?.value.trim();

    if (!file || !pageStr) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Please select a PDF and enter page numbers (e.g. 1, 2)."; }
      return;
    }

    if (status) { status.style.color = "var(--primary)"; status.textContent = "Extracting selected pages..."; }

    try {
      const PDFLibEngine = window.PDFLib;
      if (!PDFLibEngine) throw new Error("PDF Engine is not ready. Please refresh the page.");

      const buffer = await file.arrayBuffer();
      const srcDoc = await PDFLibEngine.PDFDocument.load(buffer);
      const newDoc = await PDFLibEngine.PDFDocument.create();

      const pageIndices = pageStr
        .split(",")
        .map((p) => parseInt(p.trim(), 10) - 1)
        .filter((p) => !isNaN(p) && p >= 0 && p < srcDoc.getPageCount());

      if (!pageIndices.length) throw new Error("No matching page numbers found in this PDF.");

      const copied = await newDoc.copyPages(srcDoc, pageIndices);
      copied.forEach((p) => newDoc.addPage(p));
      const pdfBytes = await newDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), "extracted_pages.pdf");

      if (status) { status.style.color = "#16a34a"; status.textContent = "Extracted pages downloaded successfully!"; }
      logPdfHistory("extract_pdf", "Extracted PDF Pages", `Extracted pages [${pageStr}] from '${file.name}'.`, "fa-file-export", "amber");
    } catch (err) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Error: " + err.message; }
    }
  });

  // 6. ROTATE PDF
  bindClick(["btnExecuteRotatePdf", "executeRotatePdf"], async () => {
    const status = document.getElementById("status-rotate_pdf") || document.getElementById("rotatePdfStatus");
    const input = document.getElementById("pdfRotateInput") || document.getElementById("rotateInput");
    const angleInput = document.getElementById("pdfRotateAngle") || document.getElementById("rotateAngle");
    const file = input?.files[0];
    const angle = parseInt(angleInput?.value || "90", 10);

    if (!file) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Please select a PDF file."; }
      return;
    }

    if (status) { status.style.color = "var(--primary)"; status.textContent = "Rotating pages..."; }

    try {
      const PDFLibEngine = window.PDFLib;
      if (!PDFLibEngine) throw new Error("PDF Engine is not ready. Please refresh the page.");

      const buffer = await file.arrayBuffer();
      const doc = await PDFLibEngine.PDFDocument.load(buffer);
      const pages = doc.getPages();
      pages.forEach((page) => {
        const currentRotation = page.getRotation().angle;
        page.setRotation(PDFLibEngine.degrees(currentRotation + angle));
      });
      const pdfBytes = await doc.save();
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), "rotated_document.pdf");

      if (status) { status.style.color = "#16a34a"; status.textContent = "Rotated PDF downloaded successfully!"; }
      logPdfHistory("rotate_pdf", "Rotated PDF Pages", `Rotated pages by ${angle}° for '${file.name}'.`, "fa-rotate", "purple");
    } catch (err) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Error: " + err.message; }
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPdfSuite);
} else {
  initPdfSuite();
}
