/* =========================================================
   AI PROGRESS BAR & STEP-BY-STEP ANIMATION EXTENSION
========================================================= */
(function() {
  // Save reference to the original processAITool function from ai-tools.js
  const originalProcessAITool = window.processAITool;

  if (!originalProcessAITool) return;

  window.processAITool = async function(toolKey) {
    const inputEl = document.getElementById(`input-${toolKey}`);
    const resultBox = document.getElementById(`res-${toolKey}`);
    const input = inputEl ? inputEl.value.trim() : "";

    if (!resultBox) return;

    if (!input) {
      resultBox.textContent = "Please enter some text, instructions, or points above first.";
      return;
    }

    // Step-by-step progress animation messages
    const steps = [
      { pct: 15, msg: "Analyzing your request..." },
      { pct: 40, msg: "Structuring content & refining tone..." },
      { pct: 75, msg: "Adding final touches and polishing prose..." },
      { pct: 95, msg: "Finalizing response..." }
    ];

    for (const step of steps) {
      resultBox.innerHTML = `
        <div style="font-weight:700;color:var(--primary);margin-bottom:8px;">
          <i class="fa-solid fa-spinner fa-spin"></i> Generating... (${step.pct}%)
        </div>
        <div style="font-size:12px;color:var(--muted);">${step.msg}</div>
        <div style="width:100%;background:#e2e8f0;height:6px;border-radius:3px;margin-top:10px;overflow:hidden;">
          <div style="width:${step.pct}%;background:var(--primary);height:100%;transition:width 0.3s ease;"></div>
        </div>
      `;
      // Pause briefly to simulate realistic progress steps
      await new Promise(r => setTimeout(r, 350));
    }

    // Now call the original function to get the actual AI response
    await originalProcessAITool(toolKey);
  };
})();
