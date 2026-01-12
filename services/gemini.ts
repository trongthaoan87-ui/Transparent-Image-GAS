
import { GoogleGenAI, Type } from "@google/genai";

// Initialize the GoogleGenAI client using process.env.API_KEY directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const identifySubject = async (base64Image: string): Promise<string> => {
  try {
    // Generate content to identify the subject in the image. 
    // Uses 'gemini-3-flash-preview' for basic identification tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: "Identify the main subject in this image in 3-5 words. Be specific (e.g., 'A golden retriever dog' or 'A vintage red car'). Return only the name." },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1],
            },
          },
        ],
      },
      config: {
        // Temperature 0.1 for more deterministic results.
        // Removed maxOutputTokens to prevent potential truncation without a thinkingBudget.
        temperature: 0.1,
      },
    });

    // Extract the text output using the .text property as recommended.
    return response.text?.trim() || "Main Subject";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Processed Image";
  }
};
