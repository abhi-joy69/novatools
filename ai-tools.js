// Replace with your actual Gemini API key
const GEMINI_API_KEY = "AQ.Ab8RN6LFyKeai5uq-VCPYYdNlkgaV9tiSB9AwqF5c2uIImetKQ";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const TOOL_SYSTEM_PROMPTS = {
  writer: (format, text) => `You are an expert writing assistant. Format the output strictly as a ${format}. Content to write: "${text}".`,
  summariser: (_, text) => `Summarise the following text into crisp, high-yield bullet points with a brief takeaway:\n\n${text}`,
  improver: (_, text) => `Rewrite the following text to enhance vocabulary, eliminate fluff, and fix grammar while keeping clear prose:\n\n${text}`,
  email: (_, text) => `Generate a polite, structured business email with a clear subject line and call to action based on these notes:\n\n${text}`,
  code: (_, text) => `Explain this code snippet clearly: 1) What it does, 2) Step-by-step logic, and 3) Potential optimizations:\n\n${text}`,
  prompt: (_, text) => `Rewrite the following simple prompt into a structured, highly-effective prompt for LLMs including Role, Task, Context, and Constraints:\n\n${text}`
};

window.processAITool = async function(toolKey) {
  const inputEl = document.getElementById(`input-${toolKey}`);
  const resultBox = document.getElementById(`res-${toolKey}`);
  const input = inputEl ? inputEl.value.trim() : "";

  if (!input) {
    resultBox.textContent = "Please enter some text, instructions, or points above first.";
    return;
  }

  let format = "email";
  if (toolKey === "writer") {
    const formatEl = document.getElementById("aiWriterType");
    if (formatEl) format = formatEl.value;
  }

  resultBox.textContent = "Connecting to Gemini AI and generating response...";

  const promptGenerator = TOOL_SYSTEM_PROMPTS[toolKey];
  const finalPrompt = promptGenerator ? promptGenerator(format, input) : input;

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";

    resultBox.textContent = generatedText;

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
    resultBox.textContent = "Error generating response: " + err.message;
  }
};

window.copyResult = function(boxId) {
  const text = document.getElementById(boxId)?.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard!"));
};
