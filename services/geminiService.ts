import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

// Helper to get client (safe initialization)
const getClient = (): GoogleGenAI => {
  if (!aiClient) {
    if (!process.env.API_KEY) {
      throw new Error("API Key not found");
    }
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
};

export const generateLeaveReason = async (type: string, mood: string): Promise<string> => {
  try {
    const ai = getClient();
    const prompt = `Write a professional short reason for a leave request. 
    Type: ${type}. 
    Tone/Mood: ${mood}. 
    Keep it under 30 words. Return only the text.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Unable to generate text.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating reason.";
  }
};

export const analyzeAttendance = async (records: any[]): Promise<string> => {
  try {
    const ai = getClient();
    const dataStr = JSON.stringify(records.slice(0, 10)); // Analyze last 10 records
    const prompt = `Analyze these attendance records (JSON) and give a 1-sentence summary of the employee's punctuality. 
    Data: ${dataStr}`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Could not analyze data.";
  }
};