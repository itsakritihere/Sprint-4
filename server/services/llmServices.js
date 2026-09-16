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
- No analysis or reasoning.
- Do not invent skills, experience, projects, companies, achievements, or technologies.
- Pull 2-3 SPECIFIC details from the resume and connect them directly to requirements in the job description.
- Avoid generic filler.
- Vary sentence length.
- Avoid starting multiple sentences with "I".
- Write approximately 300 words.
- The final answer MUST be between 250 and 350 words.
- Use a confident, professional, natural tone.
- Start directly with the salutation/opening line.
- End with a professional sign-off followed by the candidate's name from the resume.

STRUCTURE:
1. Opening paragraph — role being applied for + strong specific hook.
2. Relevant experience and skills — grounded in real resume details.
3. Why the candidate is a good fit.
4. Closing paragraph — brief call to action and professional sign-off.

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

// RATE LIMIT (429) DETECTion

function isQuotaError(error) {
  const rawMessage =
    typeof error?.message === "string"
      ? error.message
      : JSON.stringify(error);

  const lowerMessage = rawMessage.toLowerCase();

  return (
    error?.code === 429 ||
    error?.status === 429 ||
    lowerMessage.includes('"code":429') ||
    lowerMessage.includes("resource_exhausted") ||
    lowerMessage.includes("quota exceeded") ||
    lowerMessage.includes("generate_content_free_tier_requests")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ================================
// EXPONENTIAL BACKOFF WRAPPER



async function withExponentialBackoff(
  fn,
  {
    maxRetries = 5,
    baseDelay = 1000,
    maxDelay = 20000,
    shouldRetry = () => true,
    onRetry = () => {},
  } = {}
) {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;

      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const jitter = Math.random() * 250;
      const delay =
        Math.min(maxDelay, baseDelay * 2 ** (attempt - 1)) + jitter;

      onRetry({ attempt, delay, error });

      await sleep(delay);
    }
  }
}


export async function generateCoverLetterStream(
  resumeText,
  jobDescription,
  onChunk
) {
  const prompt = buildPrompt(resumeText, jobDescription);

  let streamingStarted = false;

  await withExponentialBackoff(
    async () => {
      const response = await ai.models.generateContentStream({
        model: "gemini-3.6-flash",

        contents: prompt,

        config: {
          systemInstruction: SYSTEM_PROMPT,

          temperature: 0.6,

          maxOutputTokens: 4096,

          thinkingConfig: {
            thinkingLevel: "low",
          },
        },
      });

      for await (const chunk of response) {
        streamingStarted = true;

        const text = chunk.text;

        if (text) {
          onChunk(text);
        }
      }
    },
    {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 20000,
      
      shouldRetry: (error) => !streamingStarted && isQuotaError(error),
      onRetry: ({ attempt, delay }) => {
        console.warn(
          `Gemini rate limited (429). Retry ${attempt}/5 in ${Math.round(
            delay
          )}ms...`
        );
      },
    }
  );
}

export { isQuotaError };