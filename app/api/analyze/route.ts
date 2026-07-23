import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const prompt = `Analyze the brand safety of the creator or content associated with this YouTube URL: ${url}. 
Use Google Search to find information about this specific video, its content, and the creator's reputation.
Provide a comprehensive, STRICT brand safety report for e-commerce brands considering sponsoring this creator.
BE EXTREMELY STRICT: If there is ANY swearing, profanity, controversial topics, or political discussion associated with this video or creator, the risk_level MUST be 'High' and the brand_safety_score MUST be below 50.
Output the analysis in JSON format adhering to the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brand_safety_score: {
              type: Type.INTEGER,
              description: "A score from 0 to 100 indicating brand safety.",
            },
            risk_level: {
              type: Type.STRING,
              description: "Risk level: 'Low', 'Medium', or 'High'",
            },
            summary_verdict: {
              type: Type.STRING,
              description: "A 2-sentence summary of the verdict.",
            },
            red_flags: {
              type: Type.ARRAY,
              description: "List of potential red flags.",
              items: {
                type: Type.OBJECT,
                properties: {
                  category: {
                    type: Type.STRING,
                    description: "E.g., Profanity, Controversy, Competitor, NSFW",
                  },
                  description: {
                    type: Type.STRING,
                    description: "Description of the red flag.",
                  },
                  timestamp: {
                    type: Type.STRING,
                    description: "Approximate timestamp (e.g., 'MM:SS') if applicable, or 'N/A'.",
                  },
                },
                required: ["category", "description", "timestamp"],
              },
            },
            positive_highlights: {
              type: Type.ARRAY,
              description: "List of positive aspects of the creator/content.",
              items: {
                type: Type.STRING,
              },
            },
          },
          required: [
            "brand_safety_score",
            "risk_level",
            "summary_verdict",
            "red_flags",
            "positive_highlights",
          ],
        },
      },
    });

    const result = JSON.parse(response.text!);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze the URL. Please check if the URL is correct or try again." },
      { status: 500 }
    );
  }
}
