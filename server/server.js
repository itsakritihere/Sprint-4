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



const upload = multer({
  dest: "uploads/",

  limits: {
    fileSize: 5 * 1024 * 1024, },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed."));
    }
  },
});


app.get("/", (req, res) => {
  res.send("AI Cover Letter API is running");
});




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

      console.log("Starting Gemini streaming...");

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

   
          if (!res.headersSent) {
            res.flushHeaders();
          }

  

          res.write(textChunk);
        }
      );



      console.log("Streaming completed.");

      res.end();

    } catch (error) {

      console.error(
        "Generation error:",
        error
      );

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


      if (!res.headersSent) {

        return res.status(500).json({
          error:
            rawMessage ||
            "Failed to generate cover letter.",
        });

      }

      res.end();
    }
  }
);




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


const PORT = 5000;

app.listen(PORT, () => {

  console.log(
    `Server running on "https://sprint-4-pk8l.onrender.com/"`
  );

});