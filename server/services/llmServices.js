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
You are a professional cover letter writer with 15 years of experience helping candidates land interviews.

Write a complete, personalized cover letter using ONLY:
- the candidate's resume
- the target job description

IMPORTANT RULES:
- Output ONLY the final cover letter. No analysis, no reasoning, no headings, no word-count notes.
- Do not invent skills, experience, projects, companies, achievements, or technologies.
- Pull 2-3 SPECIFIC, concrete details from the resume (real project names, tools, metrics, achievements) and connect them directly to requirements in the job description. Avoid generic filler like "I am a hardworking team player."
- Vary sentence length. Avoid starting multiple sentences with "I".
- Write approximately 300 words. The final answer MUST be between 250 and 350 words.
- Use a confident, professional, natural tone — not robotic or overly formal.
- Start directly with the salutation/opening line. No preamble like "Here is the cover letter:".
- End with a professional sign-off (e.g. "Sincerely,") followed by the candidate's name from the resume.

STRUCTURE:
1. Opening paragraph — role being applied for + a strong, specific hook (not "I am writing to apply for...").
2. Relevant experience and skills — grounded in real resume details, tied to job requirements.
3. Why the candidate is a good fit — connect their trajectory/goals to the company/role.
4. Closing paragraph — brief, confident call to action, then sign-off.

EXAMPLE OPENING (for tone/style reference only — do not reuse its content):
"When [Company]'s job posting mentioned [specific requirement], it read like a description of the last two years of my work on [specific resume project]. That overlap is why I'm applying for the [Role] position."

Return ONLY the complete cover letter text.
`;

function buildPrompt(resumeText, jobDescription) {
  return `
CANDIDATE RESUME:
${resumeText}

TARGET JOB DESCRIPTION:
${jobDescription}

Write the complete cover letter now, following all system instructions exactly.
`;
}

async function callGemini(prompt, maxOutputTokens) {
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.6,
      maxOutputTokens,
      thinkingConfig: {
        // A cover letter doesn't need deep reasoning — keep thinking light
        // so the token budget goes to the actual letter, not silent thought.
        thinkingLevel: "low",
      },
    },
  });

  const candidate = response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const usage = response.usageMetadata;

  console.log("Finish reason:", finishReason);
  console.log(
    "Tokens — thoughts:",
    usage?.thoughtsTokenCount,
    "| output:",
    usage?.candidatesTokenCount
  );

  const text = response.text?.trim();

  return { text, finishReason };
}

export async function generateCoverLetter(resumeText, jobDescription) {
  const prompt = buildPrompt(resumeText, jobDescription);

  const MAX_ATTEMPTS = 3;
  let lastText = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Bump the token ceiling on retries in case truncation is the cause
    const maxOutputTokens = 2048 + attempt * 1024;

    try {
      const { text, finishReason } = await callGemini(prompt, maxOutputTokens);

      if (!text) {
        console.warn(`Attempt ${attempt}: empty response, retrying...`);
        continue;
      }

      lastText = text;

      const wordCount = text.split(/\s+/).filter(Boolean).length;
      console.log(`Attempt ${attempt}: ${wordCount} words, finishReason=${finishReason}`);

      const truncated = finishReason === "MAX_TOKENS";
      const wrongLength = wordCount < 250 || wordCount > 350;

      if (!truncated && !wrongLength) {
        return text;
      }

      console.warn(
        `Attempt ${attempt} rejected (truncated=${truncated}, wrongLength=${wrongLength}), retrying...`
      );
    } catch (error) {
      console.error(`Attempt ${attempt} error:`, error);
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(error?.message || "Failed to generate cover letter.");
      }
    }
  }

  if (lastText) {
    console.warn("Returning best-effort result after max attempts.");
    return lastText;
  }

  throw new Error("Gemini returned an empty response after all retries.");
}