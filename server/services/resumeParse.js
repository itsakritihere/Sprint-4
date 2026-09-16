import fs from "fs";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export default async function extractResumeText(file) {
  const filePath = file.path;

  const extension = file.originalname
    .split(".")
    .pop()
    .toLowerCase();

  try {
    if (extension === "pdf") {
      const buffer = fs.readFileSync(filePath);

      const parser = new PDFParse({
        data: buffer,
      });

      const result = await parser.getText();

      await parser.destroy();

      return result.text;
    }

    if (extension === "docx") {
      const result =
        await mammoth.extractRawText({
          path: filePath,
        });

      return result.value;
    }

    throw new Error("Unsupported file type.");
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}