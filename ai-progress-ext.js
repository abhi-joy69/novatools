/* =========================================================
   AI PROGRESS EXTENSION - REAL-TIME SYNC & PDF EXPORT
========================================================= */
(function() {
  window.processAITool = async function(toolKey) {
    const inputEl = document.getElementById(`input-${toolKey}`);
    const resultBox = document.getElementById(`res-${toolKey}`);
    const input = inputEl ? inputEl.value.trim() : "";

    if (!resultBox) return;

    if (!input) {
      resultBox.textContent = "Please enter some text, instructions, or points above first.";
      return;
    }

    let format = "email";
    if (toolKey === "writer") {
      const formatEl = document.getElementById("aiWriterType");
      if (formatEl) format = formatEl.value;
    }

    const promptGenerator = typeof TOOL_SYSTEM_PROMPTS !== "undefined" && TOOL_SYSTEM_PROMPTS[toolKey]
      ? TOOL_SYSTEM_PROMPTS[toolKey]
      : (_, text) => text;

    const finalPrompt = promptGenerator(format, input);

    // Show live progress UI and hide copy/download buttons until complete
    resultBox.innerHTML = `
      <div style="font-weight:700;color:var(--primary);margin-bottom:8px;">
        <i class="fa-solid fa-spinner fa-spin"></i> Generating Response... (15%)
      </div>
      <div style="font-size:12px;color:var(--muted);" id="ai-progress-status-${toolKey}">Connecting to AI engine...</div>
      <div style="width:100%;background:#e2e8f0;height:6px;border-radius:3px;margin:10px 0 16px;overflow:hidden;">
        <div id="ai-progress-bar-${toolKey}" style="width:15%;background:var(--primary);height:100%;transition:width 0.4s ease;"></div>
      </div>
    `;

    const progressBar = document.getElementById(`ai-progress-bar-${toolKey}`);
    const progressStatus = document.getElementById(`ai-progress-status-${toolKey}`);

    const updateStep = (pct, msg) => {
      if (progressBar) progressBar.style.width = pct + "%";
      if (progressStatus) {
        progressStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating Response... (${pct}%) — ${msg}`;
      }
    };

    const timer1 = setTimeout(() => updateStep(40, "Analyzing instructions & context..."), 500);
    const timer2 = setTimeout(() => updateStep(75, "Structuring prose and refining tone..."), 1200);

    try {
      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a helpful, direct, and articulate AI productivity assistant." },
            { role: "user", content: finalPrompt }
          ],
          model: "openai"
        })
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      updateStep(100, "Finalizing output...");

      if (!response.ok) throw new Error(`Engine status: ${response.status}`);

      const rawText = await response.text();
      let generatedText = rawText;
      try {
        const parsed = JSON.parse(rawText);
        if (parsed?.choices?.[0]?.message?.content) {
          generatedText = parsed.choices[0].message.content;
        }
      } catch (_) {}

      setTimeout(() => {
        // Render final text and reveal action buttons (Copy & Download PDF)
        resultBox.innerHTML = `
          <div style="white-space: pre-wrap; font-size: 13px; line-height: 1.7; margin-bottom: 16px;" id="ai-output-text-${toolKey}">${escapeHTML(generatedText)}</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; border-top:1px solid var(--border); padding-top:14px;">
            <button class="btn btn-primary" type="button" onclick="copyResultText('ai-output-text-${toolKey}')"><i class="fa-regular fa-copy"></i> Copy Output</button>
            <button class="btn btn-light" type="button" onclick="downloadAiPdf('${toolKey}', 'ai_generated_document.pdf')"><i class="fa-solid fa-file-pdf"></i> Download PDF</button>
          </div>
        `;
        if (typeof recordHistoryEvent === "function") {
          recordHistoryEvent({
            tool: toolKey,
            category: "AI Productivity",
            title: `AI ${toolKey.toUpperCase()}`,
            content: generatedText,
            icon: "fa-bolt",
            colorClass: "blue"
          });
        }
      }, 400);

    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resultBox.textContent = "Error generating response: " + err.message;
    }
  };

  window.copyResultText = function(elementId) {
    const el = document.getElementById(elementId);
    const text = el ? el.textContent : "";
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard!"));
  };

  window.downloadAiPdf = async function(toolKey, filename) {
    const el = document.getElementById(`ai-output-text-${toolKey}`);
    const text = el ? el.textContent : "";
    if (!text) return;

    if (window.PDFLib) {
      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      page.drawText(text.slice(0, 1500), {
        x: 50,
        y: 780,
        size: 12,
        font: font,
        color: rgb(0.1, 0.1, 0.1),
        lineHeight: 18,
        maxWidth: 495
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 400);
    } else {
      alert("PDF library loading... please try downloading again in a moment.");
    }
  };
})();
