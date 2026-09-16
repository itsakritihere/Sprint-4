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
- Output ONLY the final cover letter.
- Do not invent skills, experience, projects, companies, achievements, or technologies.
- Pull 2-3 specific details from the resume and connect them directly to the job description.
- Avoid generic filler.
- Vary sentence length.
- Avoid starting multiple sentences with "I".
- Write approximately 300 words.
- The final answer MUST be between 250 and 350 words.
- Use a confident, professional, natural tone.
- Start directly with the salutation/opening line.
- End with a professional sign-off followed by the candidate's name.

STRUCTURE:
1. Opening paragraph — role + strong specific hook.
2. Relevant experience and skills.
3. Why the candidate is a good fit.
4. Closing paragraph + sign-off.

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Only retry temporary server overload/unavailability.
// Do NOT retry quota-exceeded 429 errors.
function isRetryableApiError(error) {
  const code = error?.code || error?.status || error?.response?.status;
  const message = (error?.message || "").toLowerCase();

  return (
    code === 503 ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("high demand")
  );
}

async function callGeminiWithBackoff(
  prompt,
  maxOutputTokens,
  maxRetries = 3
) {
  let delay = 1000;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",

        contents: prompt,

        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.6,
          maxOutputTokens,

          thinkingConfig: {
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

      return {
        text,
        finishReason,
      };
    } catch (error) {
      const retryable = isRetryableApiError(error);

      // Quota errors should NOT be retried.
      if (!retryable || i === maxRetries) {
        throw error;
      }

      console.warn(
        `Gemini unavailable (attempt ${i + 1}/${maxRetries + 1}). ` +
          `Retrying in ${delay}ms...`
      );

      await sleep(delay);

      delay *= 2;
    }
  }
}

export async function generateCoverLetter(
  resumeText,
  jobDescription
) {
  const prompt = buildPrompt(
    resumeText,
    jobDescription
  );

  const MAX_ATTEMPTS = 3;

  let lastText = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const maxOutputTokens = 2048 + attempt * 1024;

    try {
      const { text, finishReason } =
        await callGeminiWithBackoff(
          prompt,
          maxOutputTokens
        );

      if (!text) {
        console.warn(
          `Attempt ${attempt}: empty response`
        );

        continue;
      }

      lastText = text;

      const wordCount = text
        .split(/\s+/)
        .filter(Boolean)
        .length;

      console.log(
        `Attempt ${attempt}: ${wordCount} words, finishReason=${finishReason}`
      );

      const truncated =
        finishReason === "MAX_TOKENS";

      const wrongLength =
        wordCount < 250 || wordCount > 350;

      if (!truncated && !wrongLength) {
        return text;
      }

      console.warn(
        `Attempt ${attempt} rejected. ` +
          `truncated=${truncated}, wrongLength=${wrongLength}`
      );
    } catch (error) {
      console.error(
        `Attempt ${attempt} error:`,
        error
      );

      // Immediately stop on quota errors.
      const message =
        error?.message?.toLowerCase() || "";

      const isQuotaError =
        error?.code === 429 ||
        error?.status === 429 ||
        message.includes("quota") ||
        message.includes("resource_exhausted");

      if (isQuotaError) {
        throw new Error(
          "Gemini API quota exceeded. Please wait for the quota to reset or check your Gemini API billing/limits."
        );
      }

      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          error?.message ||
            "Failed to generate cover letter."
        );
      }
    }
  }

  if (lastText) {
    console.warn(
      "Returning best-effort result after max attempts."
    );

    return lastText;
  }

  throw new Error(
    "Gemini returned an empty response."
  );
}