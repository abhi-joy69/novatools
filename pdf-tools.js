/* =========================================================
   IN-BROWSER PDF SUITE (POWERED BY PDF-LIB + NATIVE FALLBACK)
   100% Client-Side Processing
========================================================= */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 400);
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

function sanitizeText(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// WYSIWYG Editor Controls
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

  if (size === "A3") { canvas.style.maxWidth = "750px"; canvas.style.minHeight = "700px"; }
  else if (size === "A5") { canvas.style.maxWidth = "450px"; canvas.style.minHeight = "380px"; }
  else if (size === "Legal") { canvas.style.maxWidth = "600px"; canvas.style.minHeight = "640px"; }
  else if (size === "Letter") { canvas.style.maxWidth = "600px"; canvas.style.minHeight = "500px"; }
  else if (size === "Tabloid") { canvas.style.maxWidth = "720px"; canvas.style.minHeight = "750px"; }
  else if (size === "Executive") { canvas.style.maxWidth = "520px"; canvas.style.minHeight = "480px"; }
  else if (size === "Custom") {
    const w = Number(document.getElementById("customWidthMm")?.value) || 210;
    const h = Number(document.getElementById("customHeightMm")?.value) || 297;
    canvas.style.maxWidth = Math.min(Math.max(w * 2.2, 350), 750) + "px";
    canvas.style.minHeight = Math.min(Math.max(h * 2.2, 300), 850) + "px";
  } else {
    canvas.style.maxWidth = "600px";
    canvas.style.minHeight = "480px";
  }
};

/* ---------------------------------------------------------
   IMAGE CONVERSION & NATIVE PDF BINARY FALLBACK FOR IMAGES
--------------------------------------------------------- */
function fileToJpegData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        // Fill white background for transparent PNGs
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const base64 = dataUrl.split(",")[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        resolve({ bytes, width: img.width, height: img.height });
      };
      img.onerror = () => reject(new Error(`Unable to decode image: ${file.name}`));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error(`Unable to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// Pure JS fallback that embeds actual JPEG binary streams into a valid PDF 1.4 file
function buildNativeJpegPdf(imagesData) {
  const chunks = [];
  let byteLength = 0;
  const offsets = [];
  let objCount = 0;

  function pushStr(str) {
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i) & 0xff;
    chunks.push(arr);
    byteLength += arr.length;
  }

  function pushBytes(bytes) {
    chunks.push(bytes);
    byteLength += bytes.length;
  }

  pushStr("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  // Object 1: Catalog
  offsets[1] = byteLength;
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Object 2 reserved for Pages root
  objCount = 2;
  const pageIds = [];

  imagesData.forEach((img) => {
    const a4Width = 595.28;
    const a4Height = 841.89;
    const scale = Math.min(a4Width / img.width, a4Height / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (a4Width - w) / 2;
    const y = (a4Height - h) / 2;

    const imgObjId = ++objCount;
    offsets[imgObjId] = byteLength;
    pushStr(
      `${imgObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`
    );
    pushBytes(img.bytes);
    pushStr("\nendstream\nendobj\n");

    const contentStream = `q\n${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im1 Do\nQ\n`;
    const streamObjId = ++objCount;
    offsets[streamObjId] = byteLength;
    pushStr(`${streamObjId} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

    const pageObjId = ++objCount;
    offsets[pageObjId] = byteLength;
    pushStr(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${a4Width} ${a4Height}] /Resources << /XObject << /Im1 ${imgObjId} 0 R >> >> /Contents ${streamObjId} 0 R >>\nendobj\n`
    );
    pageIds.push(pageObjId);
  });

  // Write Object 2: Pages Root
  offsets[2] = byteLength;
  pushStr(`2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => id + " 0 R").join(" ")}] /Count ${pageIds.length} >>\nendobj\n`);

  const xrefOffset = byteLength;
  pushStr(`xref\n0 ${objCount + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= objCount; i++) {
    pushStr(("0000000000" + offsets[i]).slice(-10) + " 00000 n \n");
  }
  pushStr(`trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

/* ---------------------------------------------------------
   TOOL INITIALIZATION & EVENT BINDINGS
--------------------------------------------------------- */
function initPdfSuite() {
  function bindClick(possibleIds, handler) {
    for (const id of possibleIds) {
      const el = document.getElementById(id);
      if (el) {
        const clone = el.cloneNode(true);
        el.replaceWith(clone);
        clone.addEventListener("click", handler);
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
    const docName = (docTitleInput?.value.trim() || "Photos_Archive").replace(/\.pdf$/i, "");

    if (!files.length) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Please select at least one JPG or PNG photo."; }
      return;
    }

    if (status) { status.style.color = "var(--primary)"; status.textContent = "Processing images locally..."; }

    try {
      const imagesData = [];
      for (const file of files) {
        const imgData = await fileToJpegData(file);
        imagesData.push(imgData);
      }

      let pdfBlob;
      if (window.PDFLib) {
        const { PDFDocument } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();
        const a4Width = 595.28;
        const a4Height = 841.89;

        for (const imgData of imagesData) {
          const jpgImage = await pdfDoc.embedJpg(imgData.bytes);
          const page = pdfDoc.addPage([a4Width, a4Height]);
          const scale = Math.min(a4Width / imgData.width, a4Height / imgData.height, 1);
          const w = imgData.width * scale;
          const h = imgData.height * scale;
          page.drawImage(jpgImage, {
            x: (a4Width - w) / 2,
            y: (a4Height - h) / 2,
            width: w,
            height: h
          });
        }
        const pdfBytes = await pdfDoc.save();
        pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
      } else {
        pdfBlob = buildNativeJpegPdf(imagesData);
      }

      downloadBlob(pdfBlob, `${docName}.pdf`);
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
    const safeTitle = sanitizeText(docName);
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
      dotted: "border: 3px dotted #1e293b;",
      inset: "border: 4px inset #64748b;",
      groove: "border: 4px groove #94a3b8;",
      ridge: "border: 5px ridge #64748b;",
      outset: "border: 4px outset #94a3b8;",
      frame: "border: 8px solid #0f172a; outline: 2px dashed #94a3b8; outline-offset: -5px; padding: 28px;"
    };

    const pageSizeVal = document.getElementById("pdfPageSize")?.value || "A4";
    let cssPageSize = pageSizeVal;
    if (pageSizeVal === "Custom") {
      const w = Number(document.getElementById("customWidthMm")?.value) || 210;
      const h = Number(document.getElementById("customHeightMm")?.value) || 297;
      cssPageSize = `${w}mm ${h}mm`;
    }

    const fontFamily = canvas.style.fontFamily || "Helvetica, Arial, sans-serif";
    const fontSize = canvas.style.fontSize || "15px";
    const textAlign = canvas.style.textAlign || "left";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      if (status) {
        status.style.color = "#dc2626";
        status.textContent = "Popup blocked! Please allow popups for this site to export your PDF.";
      }
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>${safeTitle}</title>
      <style>
        @page { size: ${cssPageSize}; margin: 15mm; }
        body { margin: 0; font-family: ${fontFamily}; font-size: ${fontSize}; text-align: ${textAlign}; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .document-sheet { max-width: 800px; margin: auto; padding: 30px; min-height: 90vh; box-sizing: border-box; ${borderClasses[border] || ""} }
      </style></head><body>
      <div class="document-sheet">${content}</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.onafterprint = () => printWindow.close();
      printWindow.print();
    }, 350);

    if (status) { status.style.color = "#16a34a"; status.textContent = "Export dialog opened! Choose 'Save as PDF' in the print destination."; }
    logPdfHistory("text_to_pdf", "Exported Document", `Generated printable PDF for '${docName}'.`, "fa-file-word", "purple");
  });

  // 3. MERGE PDF FILES
  const mergeInput = document.getElementById("pdfMergeInput") || document.getElementById("mergeInput");
  if (mergeInput) {
    mergeInput.addEventListener("change", () => {
      const list = document.getElementById("mergeFileList") || document.getElementById("mergeList");
      const files = Array.from(mergeInput.files || []);
      if (list) {
        list.innerHTML = files
          .map((f, i) => `${i + 1}. ${sanitizeText(f.name)} (${(f.size / 1024).toFixed(1)} KB)`)
          .join("<br>");
      }
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

    if (!window.PDFLib) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "PDF engine is still loading. Please check your connection and try again."; }
      return;
    }

    if (status) { status.style.color = "var(--primary)"; status.textContent = "Merging PDF files..."; }

    try {
      const { PDFDocument } = window.PDFLib;
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const mergedBlob = new Blob([mergedBytes], { type: "application/pdf" });
      downloadBlob(mergedBlob, "merged_document.pdf");

      if (status) { status.style.color = "#16a34a"; status.textContent = "Merged PDF downloaded successfully!"; }
      logPdfHistory("merge_pdf", "Merged PDFs", `Merged ${files.length} PDFs into one document.`, "fa-layer-group", "emerald");
    } catch (err) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Error merging PDFs: " + err.message; }
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

    if (!window.PDFLib) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "PDF engine is still loading. Please check your connection and try again."; }
      return;
    }

    if (status) { status.style.color = "var(--primary)"; status.textContent = "Extracting page 1..."; }

    try {
      const { PDFDocument } = window.PDFLib;
      const arrayBuffer = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);

      if (sourcePdf.getPageCount() === 0) {
        throw new Error("The selected PDF has no pages.");
      }

      const splitPdf = await PDFDocument.create();
      const [firstPage] = await splitPdf.copyPages(sourcePdf, [0]);
      splitPdf.addPage(firstPage);

      const splitBytes = await splitPdf.save();
      const splitBlob = new Blob([splitBytes], { type: "application/pdf" });
      downloadBlob(splitBlob, `split_page_1_${file.name}`);

      if (status) { status.style.color = "#16a34a"; status.textContent = "Page 1 extracted and downloaded successfully!"; }
      logPdfHistory("split_pdf", "Split PDF Document", `Extracted page 1 from '${file.name}'.`, "fa-scissors", "cyan");
    } catch (err) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Error splitting PDF: " + err.message; }
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

    if (!window.PDFLib) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "PDF engine is still loading. Please check your connection and try again."; }
      return;
    }

    if (status) { status.style.color = "var(--primary)"; status.textContent = "Extracting selected pages..."; }

    try {
      const { PDFDocument } = window.PDFLib;
      const arrayBuffer = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const totalPages = sourcePdf.getPageCount();

      // Support both comma-separated numbers (1, 3) and ranges (2-4)
      const zeroBasedIndices = [];
      const parts = pageStr.split(",");
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes("-")) {
          const [start, end] = trimmed.split("-").map(n => parseInt(n.trim(), 10));
          if (!isNaN(start) && !isNaN(end) && start <= end) {
            for (let p = start; p <= end; p++) {
              if (p >= 1 && p <= totalPages) zeroBasedIndices.push(p - 1);
            }
          }
        } else {
          const p = parseInt(trimmed, 10);
          if (!isNaN(p) && p >= 1 && p <= totalPages) {
            zeroBasedIndices.push(p - 1);
          }
        }
      }

      if (!zeroBasedIndices.length) {
        throw new Error(`Please enter valid page numbers between 1 and ${totalPages}.`);
      }

      const extractedPdf = await PDFDocument.create();
      const copiedPages = await extractedPdf.copyPages(sourcePdf, zeroBasedIndices);
      copiedPages.forEach((p) => extractedPdf.addPage(p));

      const extractedBytes = await extractedPdf.save();
      const extractedBlob = new Blob([extractedBytes], { type: "application/pdf" });
      downloadBlob(extractedBlob, `extracted_${file.name}`);

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

    if (!window.PDFLib) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "PDF engine is still loading. Please check your connection and try again."; }
      return;
    }

    if (status) { status.style.color = "var(--primary)"; status.textContent = "Rotating pages..."; }

    try {
      const { PDFDocument, degrees } = window.PDFLib;
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      const pages = pdfDoc.getPages();
      pages.forEach((page) => {
        const currentRotation = page.getRotation().angle || 0;
        page.setRotation(degrees((currentRotation + angle) % 360));
      });

      const rotatedBytes = await pdfDoc.save();
      const rotatedBlob = new Blob([rotatedBytes], { type: "application/pdf" });
      downloadBlob(rotatedBlob, `rotated_${file.name}`);

      if (status) { status.style.color = "#16a34a"; status.textContent = "Rotated PDF downloaded successfully!"; }
      logPdfHistory("rotate_pdf", "Rotated PDF Pages", `Rotated pages by ${angle}° for '${file.name}'.`, "fa-rotate", "purple");
    } catch (err) {
      if (status) { status.style.color = "#dc2626"; status.textContent = "Error rotating PDF: " + err.message; }
    }
  });
}

// Ensure execution once DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPdfSuite);
} else {
  initPdfSuite();
}
