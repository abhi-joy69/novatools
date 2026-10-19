/* =========================================================
   IN-BROWSER PDF SUITE & MS WORD LIVE STUDIO
   (Self-contained: Zero external CDN dependencies)
========================================================= */

// Native PDF generator from images using raw binary PDF specification
function createPdfFromImages(imageBitmaps) {
  let objects = [];
  let xrefOffsets = [];

  // Minimal standard 1-based cross-reference table builder
  function addObject(content) {
    objects.push(content);
    return objects.length;
  }

  // 1: Catalog
  addObject("<< /Type /Catalog /Pages 2 0 R >>");

  // Placeholder for Pages object (Index 2)
  objects.push("");

  let pageObjIndices = [];

  imageBitmaps.forEach((item) => {
    // Image XObject
    const imgObjIndex = addObject(
      `<< /Type /XObject /Subtype /Image /Width ${item.width} /Height ${item.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${item.bytes.length} >>\nstream\n`
    );
    objects[imgObjIndex - 1] = {
      header: `<< /Type /XObject /Subtype /Image /Width ${item.width} /Height ${item.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${item.bytes.length} >>\nstream\n`,
      binary: item.bytes,
      footer: "\nendstream"
    };

    // Content stream to paint image on full canvas
    const contentStream = `q ${item.pageWidth} 0 0 ${item.pageHeight} 0 0 cm /Im1 Do Q`;
    const contentObjIndex = addObject(
      `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`
    );

    // Page Object
    const pageObjIndex = addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${item.pageWidth} ${item.pageHeight}] /Contents ${contentObjIndex} 0 R /Resources << /XObject << /Im1 ${imgObjIndex} 0 R >> >> >>`
    );
    pageObjIndices.push(pageObjIndex);
  });

  // Now fill Object 2 (Pages tree)
  const kidsArray = pageObjIndices.map((idx) => `${idx} 0 R`).join(" ");
  objects[1] = `<< /Type /Pages /Kids [${kidsArray}] /Count ${pageObjIndices.length} >>`;

  // Build final binary file
  let binaryChunks = [];
  let currentOffset = 0;

  function writeAscii(str) {
    const enc = new TextEncoder().encode(str);
    binaryChunks.push(enc);
    currentOffset += enc.length;
  }

  function writeBytes(bytes) {
    binaryChunks.push(bytes);
    currentOffset += bytes.length;
  }

  // PDF Header
  writeAscii("%PDF-1.4\n%âãÏÓ\n");

  for (let i = 0; i < objects.length; i++) {
    xrefOffsets.push(currentOffset);
    const objNum = i + 1;
    writeAscii(`${objNum} 0 obj\n`);

    if (typeof objects[i] === "object" && objects[i].binary) {
      writeAscii(objects[i].header);
      writeBytes(objects[i].binary);
      writeAscii(objects[i].footer + "\nendobj\n");
    } else {
      writeAscii(objects[i] + "\nendobj\n");
    }
  }

  // Cross Reference Table
  const startXref = currentOffset;
  writeAscii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (let i = 0; i < xrefOffsets.length; i++) {
    const offsetStr = String(xrefOffsets[i]).padStart(10, "0");
    writeAscii(`${offsetStr} 00000 n \n`);
  }

  // Trailer
  writeAscii(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`);

  return new Blob(binaryChunks, { type: "application/pdf" });
}

// Download helper
function downloadBlob(blob, filename) {
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

// 1. Photo to PDF (Native Browser Processing)
document.getElementById("btnExecutePhotoPdf")?.addEventListener("click", async () => {
  const status = document.getElementById("status-photo_to_pdf");
  if (!status) return;

  const files = Array.from(document.getElementById("pdfPhotoInput")?.files || []);
  const docName = document.getElementById("pdfPhotoDocTitle")?.value.trim() || "Photos_Archive";

  if (!files.length) {
    status.style.color = "#dc2626";
    status.textContent = "Please select at least one JPG or PNG photo.";
    return;
  }

  status.style.color = "var(--primary)";
  status.textContent = "Processing images in browser...";

  try {
    let processedImages = [];

    for (const file of files) {
      const dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = dataUrl;
      });

      // Normalize canvas to JPEG binary for standard PDF support
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const jpegBlob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
      const arrayBuf = await jpegBlob.arrayBuffer();

      // Fit into standard A4 proportions (595 x 842 pt)
      let pWidth = 595.28;
      let pHeight = 841.89;
      if (img.width > img.height) {
        pWidth = 841.89;
        pHeight = 595.28;
      }

      processedImages.push({
        width: img.width,
        height: img.height,
        pageWidth: pWidth,
        pageHeight: pHeight,
        bytes: new Uint8Array(arrayBuf)
      });
    }

    const pdfBlob = createPdfFromImages(processedImages);
    downloadBlob(pdfBlob, `${docName}.pdf`);

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
    status.textContent = "Error processing photos: " + err.message;
  }
});

// 2. Text to PDF (Clean Printable Document Generator)
document.getElementById("btnExecuteTextPdf")?.addEventListener("click", () => {
  const status = document.getElementById("status-text_to_pdf");
  const canvas = document.getElementById("wordCanvas");
  const docName = document.getElementById("pdfDocTitle")?.value.trim() || "My_Document";
  const content = canvas ? canvas.innerHTML : "";

  if (!canvas || !canvas.innerText.trim()) {
    if (status) {
      status.style.color = "#dc2626";
      status.textContent = "Please type document content on the page first.";
    }
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
        <div class="document-sheet">
          ${content}
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 400);

  if (status) {
    status.style.color = "#16a34a";
    status.textContent = "Print & PDF export dialog opened successfully!";
  }

  if (typeof recordHistoryEvent === "function") {
    recordHistoryEvent({
      tool: "text_to_pdf",
      category: "PDF Suite",
      title: "Exported Document",
      content: `Generated printable PDF for '${docName}'.`,
      icon: "fa-file-word",
      colorClass: "purple"
    });
  }
});
