import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";

import  extractResumeText  from "./services/resumeParse.js";
import { generateCoverLetter } from "./services/llmServices.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// File upload configuration
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed."));
    }
  },
});

// Test route
app.get("/", (req, res) => {
  res.send("AI Cover Letter API is running");
});

// Generate cover letter
app.post(
  "/api/generate",
  upload.single("resume"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Resume file is required.",
        });
      }

      const { jobDescription } = req.body;

      if (!jobDescription || !jobDescription.trim()) {
        return res.status(400).json({
          error: "Job description is required.",
        });
      }

      console.log("Processing resume...");

      const resumeText = await extractResumeText(req.file);

      console.log("Resume extracted successfully.");

      console.log("Generating cover letter...");

      const coverLetter = await generateCoverLetter(
        resumeText,
        jobDescription
      );

      console.log("Cover letter generated successfully.");

      res.json({
        success: true,
        coverLetter,
      });

    } catch (error) {
  console.error("Generation error:", error);

  const message = error?.message || "";
  const lowerMessage = message.toLowerCase();

  const isQuotaError =
    error?.code === 429 ||
    error?.status === 429 ||
    lowerMessage.includes("quota exceeded") ||
    lowerMessage.includes("resource_exhausted") ||
    lowerMessage.includes("generate_content_free_tier_requests");

  if (isQuotaError) {
    return res.status(429).json({
      error:
        "Gemini API quota exceeded. Please wait for the quota to reset or check your Gemini API limits.",
    });
  }

  return res.status(500).json({
    error:
      message ||
      "Failed to generate cover letter.",
  });
}
  }
);

// Start server
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});