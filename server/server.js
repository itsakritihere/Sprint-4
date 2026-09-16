import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";

import extractResumeText from "./services/resumeParse.js";
import {
  generateCoverLetterStream,
  isQuotaError,
} from "./services/llmServices.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());


// ================================
// MULTER CONFIGURATION
// ================================

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


// ================================
// HOME ROUTE
// ================================

app.get("/", (req, res) => {
  res.send("AI Cover Letter API is running");
});


// ================================
// GENERATE COVER LETTER - STREAMING
// ================================

app.post(
  "/api/generate",
  upload.single("resume"),
  async (req, res) => {
    try {

      // ----------------------------
      // Check resume
      // ----------------------------

      if (!req.file) {
        return res.status(400).json({
          error: "Resume file is required.",
        });
      }


      // ----------------------------
      // Check job description
      // ----------------------------

      const { jobDescription } = req.body;

      if (!jobDescription || !jobDescription.trim()) {
        return res.status(400).json({
          error: "Job description is required.",
        });
      }


      // ----------------------------
      // Extract resume text
      // ----------------------------

      console.log("Processing resume...");

      const resumeText = await extractResumeText(req.file);

      console.log("Resume extracted successfully.");

      console.log("Starting Gemini streaming...");


      // ============================
      // STREAM RESPONSE HEADERS
      // ============================
      //
      // NOTE: these are only buffered until the first res.write()/
      // res.flushHeaders() call, so a 429 raised *before* any text
      // has been generated (see llmServices' backoff wrapper) can
      // still be reported as a clean JSON error below — the client
      // never sees a half-open stream for a request that ultimately
      // failed before producing any content.

      res.setHeader(
        "Content-Type",
        "text/plain; charset=utf-8"
      );

      res.setHeader(
        "Cache-Control",
        "no-cache"
      );

      res.setHeader(
        "Connection",
        "keep-alive"
      );

      res.setHeader(
        "Transfer-Encoding",
        "chunked"
      );


      // ============================
      // STREAM GEMINI RESPONSE
      // ============================

      await generateCoverLetterStream(
        resumeText,
        jobDescription,

        (textChunk) => {

          // Flush headers on the very first chunk so the browser
          // starts receiving bytes immediately (Fetch Streams API
          // on the frontend reads these as they arrive).

          if (!res.headersSent) {
            res.flushHeaders();
          }

          // Send every Gemini chunk
          // immediately to React

          res.write(textChunk);
        }
      );


      // ----------------------------
      // Finish response
      // ----------------------------

      console.log("Streaming completed.");

      res.end();

    } catch (error) {

      console.error(
        "Generation error:",
        error
      );


      // ============================
      // QUOTA ERROR
      // ============================
      //
      // By the time we get here, generateCoverLetterStream has
      // already exhausted its exponential-backoff retries (or the
      // error happened mid-stream). Either way, if headers were
      // never flushed we can still return a clean 429 JSON error.

      const rawMessage =
        typeof error?.message === "string"
          ? error.message
          : JSON.stringify(error);

      const isQuota = isQuotaError(error);


      if (isQuota) {

        if (!res.headersSent) {

          return res.status(429).json({
            error:
              "Gemini API quota exceeded after multiple retries. Please wait for the quota to reset or check your Gemini API limits.",
          });

        }

        return res.end();
      }


      // ============================
      // OTHER ERROR
      // ============================

      if (!res.headersSent) {

        return res.status(500).json({
          error:
            rawMessage ||
            "Failed to generate cover letter.",
        });

      }


      // Headers already sent,
      // so just close the stream.

      res.end();
    }
  }
);


// ================================
// ERROR HANDLER
// ================================

app.use((error, req, res, next) => {

  console.error("Server error:", error);

  if (error.message) {

    return res.status(400).json({
      error: error.message,
    });

  }

  return res.status(500).json({
    error: "Something went wrong.",
  });
});


// ================================
// START SERVER
// ================================

const PORT = 5000;

app.listen(PORT, () => {

  console.log(
    `Server running on http://localhost:${PORT}`
  );

});