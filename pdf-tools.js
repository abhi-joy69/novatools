/* =========================================================
   IN-BROWSER PDF SUITE & MS WORD LIVE STUDIO
========================================================= */

// Multi-CDN safe loader for PDF-Lib
async function ensurePDFLib() {
  if (window.PDFLib) return window.PDFLib;
  if (window.pdfLib) return window.pdfLib;

  const cdnUrls = [
    "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.9/pdf-lib.min.js",
    "https://unpkg.com/pdf-lib@1.17.9/dist/pdf-lib.min.js",
    "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.9/dist/pdf-lib.min.js"
  ];

  for (const url of cdnUrls) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.onload = () => resolve();
        script.onerror = () => reject();
        document.head.appendChild(script);
      });
      if (window.PDFLib || window.pdfLib) {
        return window.PDFLib || window.pdfLib;
      }
    } catch (_) {
      // Try next CDN
    }
  }

  throw new Error("Could not load PDF-Lib from any source.");
}

// Download helper
function downloadBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// WYSIWYG live controls
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

// 1. Photo to PDF
document.getElementById("btnExecutePhotoPdf")?.addEventListener("click", async () => {
  const status = document.getElementById("status-photo_to_pdf");
  if (!status) return;

  status.style.color = "var(--primary)";
  status.textContent = "Initializing PDF engine...";

  let PDFLib;
  try {
    PDFLib = await ensurePDFLib();
  } catch (err) {
    status.style.color = "#dc2626";
    status.textContent = "Error: Network blocked PDF engine. Please refresh.";
    return;
  }

  const files = Array.from(document.getElementById("pdfPhotoInput")?.files || []);
  const docName = document.getElementById("pdfPhotoDocTitle")?.value.trim() || "Photos_Archive";

  if (!files.length) {
    status.style.color = "#dc2626";
    status.textContent = "Please select at least one JPG or PNG photo.";
    return;
  }

  status.textContent = "Converting photos to PDF in browser...";

  try {
    const pdfDoc = await PDFLib.PDFDocument.create();
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
    downloadBlob(pdfBytes, `${docName}.pdf`);
    status.style.color = "#16a34a";
    status.textContent = "Photo PDF created and downloaded successfully!";

    if (typeof recordHistoryEvent === "function") {
      recordHistoryEvent({
        tool: "photo_to_pdf",
        category: "PDF Suite",
        title: "Converted Photos to PDF",
        content: `Exported ${files.length} image(s) to '${docName}.pdf'.`,
        icon: "fa-file-image",
        colorClass: "blue"
      });
    }
  } catch (err) {
    status.style.color = "#dc2626";
    status.textContent = "Error converting photos: " + err.message;
  }
});

// 2. Text to PDF
document.getElementById("btnExecuteTextPdf")?.addEventListener("click", async () => {
  const status = document.getElementById("status-text_to_pdf");
  if (!status) return;

  status.style.color = "var(--primary)";
  status.textContent = "Initializing PDF engine...";

  let PDFLib;
  try {
    PDFLib = await ensurePDFLib();
  } catch (err) {
    status.style.color = "#dc2626";
    status.textContent = "Error: Network blocked PDF engine. Please refresh.";
    return;
  }

  const docName = document.getElementById("pdfDocTitle")?.value.trim() || "My_Document";
  const canvas = document.getElementById("wordCanvas");
  const content = canvas ? canvas.innerText.trim() : "";
  const selectedSize = document.getElementById("pdfPageSize")?.value || "A4";
  const selectedBorder = document.getElementById("pdfBorderStyle")?.value || "none";
  const selectedFont = document.getElementById("pdfFontFamily")?.value || "";

  if (!content) {
    status.style.color = "#dc2626";
    status.textContent = "Please type or write document content on the page first.";
    return;
  }

  status.textContent = "Formatting and rendering your PDF...";

  try {
    const pdfDoc = await PDFLib.PDFDocument.create();

    let dims = [595.28, 841.89];
    if (selectedSize === "A3") dims = [841.89, 1190.55];
    if (selectedSize === "A5") dims = [419.53, 595.28];
    if (selectedSize === "Letter") dims = [612.00, 792.00];
    if (selectedSize === "Legal") dims = [612.00, 1008.00];
    if (selectedSize === "Tabloid") dims = [792.00, 1224.00];
    if (selectedSize === "Executive") dims = [522.00, 756.00];
    if (selectedSize === "Custom") {
      const wMm = Number(document.getElementById("customWidthMm")?.value) || 210;
      const hMm = Number(document.getElementById("customHeightMm")?.value) || 297;
      dims = [wMm * 2.83465, hMm * 2.83465];
    }

    let page = pdfDoc.addPage(dims);
    const { width, height } = page.getSize();

    let chosenFont = PDFLib.StandardFonts.Helvetica;
    let chosenBold = PDFLib.StandardFonts.HelveticaBold;

    if (selectedFont.includes("Times") || selectedFont.includes("Georgia") || selectedFont.includes("Garamond") || selectedFont.includes("Palatino")) {
      chosenFont = PDFLib.StandardFonts.TimesRoman;
      chosenBold = PDFLib.StandardFonts.TimesRomanBold;
    } else if (selectedFont.includes("Courier") || selectedFont.includes("Lucida")) {
      chosenFont = PDFLib.StandardFonts.Courier;
      chosenBold = PDFLib.StandardFonts.CourierBold;
    }

    const fontNormal = await pdfDoc.embedFont(chosenFont);
    const fontHeader = await pdfDoc.embedFont(chosenBold);

    const drawPageBorder = (targetPage) => {
      const margin = 24;
      const rectOptions = { x: margin, y: margin, width: width - margin * 2, height: height - margin * 2 };

      if (selectedBorder === "solid") {
        targetPage.drawRectangle({ ...rectOptions, borderColor: PDFLib.rgb(0.12, 0.16, 0.23), borderWidth: 2 });
      } else if (selectedBorder === "thick") {
        targetPage.drawRectangle({ ...rectOptions, borderColor: PDFLib.rgb(0.08, 0.12, 0.20), borderWidth: 5 });
      } else if (selectedBorder === "double") {
        targetPage.drawRectangle({ ...rectOptions, borderColor: PDFLib.rgb(0.12, 0.16, 0.23), borderWidth: 3 });
        targetPage.drawRectangle({ x: margin + 4, y: margin + 4, width: width - (margin + 4) * 2, height: height - (margin + 4) * 2, borderColor: PDFLib.rgb(0.12, 0.16, 0.23), borderWidth: 1 });
      } else if (selectedBorder === "dashed") {
        targetPage.drawRectangle({ ...rectOptions, borderColor: PDFLib.rgb(0.39, 0.45, 0.55), borderWidth: 2, borderDashArray: [6, 4] });
      } else if (selectedBorder === "dotted") {
        targetPage.drawRectangle({ ...rectOptions, borderColor: PDFLib.rgb(0.39, 0.45, 0.55), borderWidth: 2, borderDashArray: [2, 3] });
      } else if (selectedBorder === "inset" || selectedBorder === "groove" || selectedBorder === "ridge" || selectedBorder === "outset") {
        targetPage.drawRectangle({ ...rectOptions, borderColor: PDFLib.rgb(0.2, 0.25, 0.35), borderWidth: 3 });
        targetPage.drawRectangle({ x: margin + 3, y: margin + 3, width: width - (margin + 3) * 2, height: height - (margin + 3) * 2, borderColor: PDFLib.rgb(0.7, 0.75, 0.85), borderWidth: 1.5 });
      } else if (selectedBorder === "frame") {
        targetPage.drawRectangle({ ...rectOptions, borderColor: PDFLib.rgb(0.08, 0.12, 0.20), borderWidth: 6 });
        targetPage.drawRectangle({ x: margin + 5, y: margin + 5, width: width - (margin + 5) * 2, height: height - (margin + 5) * 2, borderColor: PDFLib.rgb(0.45, 0.52, 0.65), borderWidth: 1.5, borderDashArray: [4, 4] });
      }
    };

    drawPageBorder(page);

    const lines = content.split("\n");
    let y = height - 56;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) { y -= 14; continue; }

      if (y < 60) {
        page = pdfDoc.addPage(dims);
        drawPageBorder(page);
        y = height - 56;
      }

      if (i === 0) {
        page.drawText(line.slice(0, 65), { x: 52, y: y, size: 18, font: fontHeader, color: PDFLib.rgb(0.06, 0.10, 0.20) });
        y -= 26;
      } else {
        page.drawText(line.slice(0, 85), { x: 52, y: y, size: 11, font: fontNormal, color: PDFLib.rgb(0.18, 0.24, 0.32) });
        y -= 17;
      }
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = `${docName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.pdf`;
    downloadBlob(pdfBytes, fileName);

    status.style.color = "#16a34a";
    status.textContent = "Custom styled PDF generated & downloaded!";

    if (typeof recordHistoryEvent === "function") {
      recordHistoryEvent({
        tool: "text_to_pdf",
        category: "PDF Suite",
        title: "Exported Document to PDF",
        content: `Format: ${selectedSize} | Border: ${selectedBorder} | Document: '${fileName}'`,
        icon: "fa-file-word",
        colorClass: "purple"
      });
    }
  } catch (err) {
    status.style.color = "#dc2626";
    status.textContent = "Error: " + err.message;
  }
});

// 3. Merge PDF
document.getElementById("pdfMergeInput")?.addEventListener("change", () => {
  const list = document.getElementById("mergeFileList");
  const files = Array.from(document.getElementById("pdfMergeInput")?.files || []);
  if (list) list.innerHTML = files.map((f, i) => `${i + 1}. ${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join("<br>");
});

document.getElementById("btnExecuteMergePdf")?.addEventListener("click", async () => {
  const status = document.getElementById("status-merge_pdf");
  if (!status) return;

  status.style.color = "var(--primary)";
  status.textContent = "Initializing PDF engine...";

  let PDFLib;
  try {
    PDFLib = await ensurePDFLib();
  } catch (_) {
    status.style.color = "#dc2626";
    status.textContent = "Engine failed to load. Please refresh.";
    return;
  }

  const files = Array.from(document.getElementById("pdfMergeInput")?.files || []);
  if (files.length < 2) {
    status.style.color = "#dc2626";
    status.textContent = "Please select at least 2 PDF files to merge.";
    return;
  }

  status.textContent = "Merging PDF files...";

  try {
    const mergedDoc = await PDFLib.PDFDocument.create();
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(buffer);
      const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => mergedDoc.addPage(p));
    }
    const pdfBytes = await mergedDoc.save();
    downloadBlob(pdfBytes, "merged_document.pdf");
    status.style.color = "#16a34a";
    status.textContent = "Merged PDF downloaded successfully!";

    if (typeof recordHistoryEvent === "function") {
      recordHistoryEvent({
        tool: "merge_pdf",
        category: "PDF Suite",
        title: "Merged PDFs",
        content: `Successfully merged ${files.length} PDF files into 'merged_document.pdf'.`,
        icon: "fa-layer-group",
        colorClass: "emerald"
      });
    }
  } catch (err) {
    status.style.color = "#dc2626";
    status.textContent = "Error merging: " + err.message;
  }
});

// 4. Split PDF
document.getElementById("btnExecuteSplitPdf")?.addEventListener("click", async () => {
  const status = document.getElementById("status-split_pdf");
  if (!status) return;

  status.style.color = "var(--primary)";
  status.textContent = "Initializing PDF engine...";

  let PDFLib;
  try {
    PDFLib = await ensurePDFLib();
  } catch (_) {
    status.style.color = "#dc2626";
    status.textContent = "Engine failed to load.";
    return;
  }

  const file = document.getElementById("pdfSplitInput")?.files[0];
  if (!file) {
    status.style.color = "#dc2626";
    status.textContent = "Please select a PDF file first.";
    return;
  }

  status.textContent = "Extracting page 1...";

  try {
    const buffer = await file.arrayBuffer();
    const srcDoc = await PDFLib.PDFDocument.load(buffer);
    const newDoc = await PDFLib.PDFDocument.create();
    const [page] = await newDoc.copyPages(srcDoc, [0]);
    newDoc.addPage(page);
    const pdfBytes = await newDoc.save();
    downloadBlob(pdfBytes, "split_page_1.pdf");
    status.style.color = "#16a34a";
    status.textContent = "Page 1 extracted and downloaded successfully!";

    if (typeof recordHistoryEvent === "function") {
      recordHistoryEvent({
        tool: "split_pdf",
        category: "PDF Suite",
        title: "Split PDF Document",
        content: `Extracted first page from '${file.name}'.`,
        icon: "fa-scissors",
        colorClass: "cyan"
      });
    }
  } catch (err) {
    status.style.color = "#dc2626";
    status.textContent = "Error: " + err.message;
  }
});

// 5. Extract Pages
document.getElementById("btnExecuteExtractPdf")?.addEventListener("click", async () => {
  const status = document.getElementById("status-extract_pdf");
  if (!status) return;

  status.style.color = "var(--primary)";
  status.textContent = "Initializing PDF engine...";

  let PDFLib;
  try {
    PDFLib = await ensurePDFLib();
  } catch (_) {
    status.style.color = "#dc2626";
    status.textContent = "Engine failed to load.";
    return;
  }

  const file = document.getElementById("pdfExtractInput")?.files[0];
  const pageStr = document.getElementById("pdfExtractPages")?.value.trim();
  if (!file || !pageStr) {
    status.style.color = "#dc2626";
    status.textContent = "Please select a PDF and enter page numbers (e.g. 1, 2).";
    return;
  }

  status.textContent = "Extracting pages...";

  try {
    const buffer = await file.arrayBuffer();
    const srcDoc = await PDFLib.PDFDocument.load(buffer);
    const newDoc = await PDFLib.PDFDocument.create();
    const pageIndices = pageStr.split(",").map((p) => parseInt(p.trim(), 10) - 1).filter((p) => !isNaN(p) && p >= 0 && p < srcDoc.getPageCount());

    if (!pageIndices.length) throw new Error("No valid page numbers found.");

    const copied = await newDoc.copyPages(srcDoc, pageIndices);
    copied.forEach((p) => newDoc.addPage(p));
    const pdfBytes = await newDoc.save();
    downloadBlob(pdfBytes, "extracted_pages.pdf");
    status.style.color = "#16a34a";
    status.textContent = "Extracted pages downloaded successfully!";

    if (typeof recordHistoryEvent === "function") {
      recordHistoryEvent({
        tool: "extract_pdf",
        category: "PDF Suite",
        title: "Extracted PDF Pages",
        content: `Extracted pages [${pageStr}] from '${file.name}'.`,
        icon: "fa-file-export",
        colorClass: "amber"
      });
    }
  } catch (err) {
    status.style.color = "#dc2626";
    status.textContent = "Error: " + err.message;
  }
});

// 6. Rotate PDF
document.getElementById("btnExecuteRotatePdf")?.addEventListener("click", async () => {
  const status = document.getElementById("status-rotate_pdf");
  if (!status) return;

  status.style.color = "var(--primary)";
  status.textContent = "Initializing PDF engine...";

  let PDFLib;
  try {
    PDFLib = await ensurePDFLib();
  } catch (_) {
    status.style.color = "#dc2626";
    status.textContent = "Engine failed to load.";
    return;
  }

  const file = document.getElementById("pdfRotateInput")?.files[0];
  const angle = parseInt(document.getElementById("pdfRotateAngle")?.value, 10);
  if (!file) {
    status.style.color = "#dc2626";
    status.textContent = "Please select a PDF file.";
    return;
  }

  status.textContent = "Rotating pages...";

  try {
    const buffer = await file.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(buffer);
    const pages = doc.getPages();
    pages.forEach((page) => {
      const currentRotation = page.getRotation().angle;
      page.setRotation(PDFLib.degrees(currentRotation + angle));
    });
    const pdfBytes = await doc.save();
    downloadBlob(pdfBytes, "rotated_document.pdf");
    status.style.color = "#16a34a";
    status.textContent = "Rotated PDF downloaded successfully!";

    if (typeof recordHistoryEvent === "function") {
      recordHistoryEvent({
        tool: "rotate_pdf",
        category: "PDF Suite",
        title: "Rotated PDF Pages",
        content: `Rotated pages by ${angle}° for '${file.name}'.`,
        icon: "fa-rotate",
        colorClass: "purple"
      });
    }
  } catch (err) {
    status.style.color = "#dc2626";
    status.textContent = "Error: " + err.message;
  }
});
