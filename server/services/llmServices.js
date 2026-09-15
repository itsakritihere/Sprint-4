import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, "../.env"),
});

console.log(
  "Gemini API key loaded:",
  process.env.GEMINI_API_KEY ? "YES" : "NO"
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_PROMPT = `
You are a professional AI cover letter generator.

Your task is to create a personalized cover letter using ONLY
the candidate's resume and the target job description.

Rules:
1. Return the cover letter in Markdown.
2. Keep it between 250 and 350 words.
3. Use a professional and natural tone.
4. Do not invent skills, qualifications, projects, companies,
   experiences, or achievements.
5. Only mention skills and experience supported by the resume.
6. Match relevant candidate experience with the job requirements.
7. Include:
   - Professional opening
   - Relevant skills and experience
   - Why the candidate is suitable for the role
   - Professional closing
8. Do not provide explanations outside the cover letter.

Return ONLY the cover letter.
`;

export async function generateCoverLetter(resumeText, jobDescription) {
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",

    contents: `
CANDIDATE RESUME:

${resumeText}

TARGET JOB DESCRIPTION:

${jobDescription}
    `,

    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
  });

  return response.text;
}