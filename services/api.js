

const { GoogleGenAI } = require("@google/genai");

// Initialize with your API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function runStreaming() {
  try {
    const model = "gemini-2.5-flash";
    const prompt = "Write a professional experience section for a Junior Web Developer.";

    // Use generateContentStream instead of generateContent
    const response = await ai.models.generateContentStream({
      model: model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    console.log("--- Starting Stream ---");

    // Iterate through the chunks as they arrive
    for await (const chunk of response) {
      // Access the text from the current chunk
      const chunkText = chunk.text;
      process.stdout.write(chunkText); // Prints without adding new lines
    }

  } catch (error) {
    console.error("Streaming Error:", error.message);
  }
}

runStreaming();