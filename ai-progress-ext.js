/* =========================================================
   AI SLEEK ICON ANIMATION, UNIQUE RESPONSES & CLEAN UI
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

    // Clean up any stray copy buttons near the action row
    const workspace = resultBox.closest(".workspace-form");
    if (workspace) {
      const strayButtons = workspace.querySelectorAll("button");
      strayButtons.forEach(b => {
        if (b.textContent.includes("Copy Output") && b !== generateBtn && !b.closest(".result-box")) {
          // Remove rogue copy buttons near top
          const parentGroup = b.closest("div");
          if (parentGroup && parentGroup.children.length === 2) {
            b.style.display = "none";
          }
        }
      });
    }

    const generateBtn = workspace ? workspace.querySelector("button.btn-primary") : null;
    const originalBtnHTML = generateBtn ? generateBtn.innerHTML : "";
    if (generateBtn) {
      generateBtn.disabled = true;
    }

    let format = "email";
    if (toolKey === "writer") {
      const formatEl = document.getElementById("aiWriterType");
      if (formatEl) format = formatEl.value;
    }

    const promptGenerators = {
      writer: (fmt, txt) => `You are an expert writing assistant. Format the output strictly as a ${fmt}. Instructions/Topic: "${txt}".`,
      summariser: (_, txt) => `Summarise the following text into crisp, high-yield bullet points with an executive takeaway:\n\n${txt}`,
      improver: (_, txt) => `Rewrite the following text to enhance vocabulary, eliminate fluff, and fix grammar while keeping clear prose:\n\n${txt}`,
      email: (_, txt) => `Generate a polite, structured business email with a clear subject line and call to action based on these notes:\n\n${txt}`,
      code: (_, txt) => `Explain this code snippet clearly: 1) What it does, 2) Step-by-step logic, and 3) Potential optimizations:\n\n${txt}`,
      prompt: (_, txt) => `Rewrite the following simple prompt into a structured, highly-effective prompt for LLMs including Role, Task, Context, and Constraints:\n\n${txt}`
    };

    const promptGen = promptGenerators[toolKey] || ((_, txt) => txt);
    // Append a random micro-seed so the AI model generates a fresh, unique response every time
    const uniqueSeed = ` [Variation ID: ${Math.random().toString(36.substring(7))}]`;
    const finalPrompt = promptGen(format, input) + uniqueSeed;

    // Slick, interactive, icon-based loading states
    const iconSteps = [
      { icon: "fa-solid fa-brain fa-beat", text: "Neural Sync..." },
      { icon: "fa-solid fa-wand-magic-sparkles fa-spin", text: "Crafting Draft..." },
      { icon: "fa-solid fa-bolt fa-bounce", text: "Polishing Prose..." },
      { icon: "fa-solid fa-circle-notch fa-spin", text: "Finalizing..." }
    ];

    resultBox.innerHTML = `
      <div style="font-weight:700;color:var(--primary);margin-bottom:8px; display:flex; align-items:center; gap:8px;">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Synthesizing fresh response...
      </div>
      <div style="font-size:12px;color:var(--muted);">Building a unique variation tailored to your notes.</div>
    `;

    let stepIdx = 0;
    const iconInterval = setInterval(() => {
      if (generateBtn && stepIdx < iconSteps.length) {
        const s = iconSteps[stepIdx];
        generateBtn.style.background = "linear-gradient(135deg, #2563eb, #7c3aed)";
        generateBtn.innerHTML = `<i class="${s.icon}" style="margin-right:8px;"></i> ${s.text}`;
        stepIdx = (stepIdx + 1) % iconSteps.length;
      }
    }, 500);

    try {
      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a helpful, direct, and articulate AI productivity assistant. Always provide fresh, varied phrasing." },
            { role: "user", content: finalPrompt }
          ],
          model: "openai"
        })
      });

      clearInterval(iconInterval);

      if (generateBtn) {
        generateBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
        generateBtn.innerHTML = `<i class="fa-solid fa-check-circle" style="margin-right:6px;"></i> Ready!`;
        setTimeout(() => {
          generateBtn.style.background = "";
          generateBtn.innerHTML = originalBtnHTML;
          generateBtn.disabled = false;
        }, 1200);
      }

      if (!response.ok) throw new Error(`Engine status: ${response.status}`);

      const rawText = await response.text();
      let generatedText = rawText;
      try {
        const parsed = JSON.parse(rawText);
        if (parsed?.choices?.[0]?.message?.content) {
          generatedText = parsed.choices[0].message.content;
        }
      } catch (_) {}

      // Clean up seed tag if visible in text
      generatedText = generatedText.replace(/\[Variation ID:.*?\]/g, "").trim();

      const safeText = typeof escapeHTML === "function" ? escapeHTML(generatedText) : generatedText;
      
      // Render output with ONLY bottom buttons (Copy & Download PDF)
      resultBox.innerHTML = `
        <div style="white-space: pre-wrap; font-size: 13px; line-height: 1.7; margin-bottom: 16px;" id="ai-output-text-${toolKey}">${safeText}</div>
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

    } catch (err) {
      clearInterval(iconInterval);
      if (generateBtn) {
        generateBtn.style.background = "";
        generateBtn.innerHTML = originalBtnHTML;
        generateBtn.disabled = false;
      }
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
