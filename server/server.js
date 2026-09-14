import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import extractResumeText from "./services/resumeParse.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

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

app.post("/api/generate", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Resume file is required.",
      });
    }

    const { jobDescription } = req.body;

    if (!jobDescription?.trim()) {
      return res.status(400).json({
        error: "Job description is required.",
      });
    }

    const resumeText = await extractResumeText(req.file);

    console.log("Resume extracted successfully.");

    res.json({
      success: true,
      message: "Resume processed successfully.",
      resumeText,
      jobDescription,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to process resume.",
    });
  }
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});