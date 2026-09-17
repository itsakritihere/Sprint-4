import { useState } from "react";
import { marked } from "marked";
import "./App.css";

function App() {
  const [resumeFile, setResumeFile] = useState(null);

  const [jobDescription, setJobDescription] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] =useState(false);
  const [copied, setCopied] =useState(false);

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",];

    if (!allowedTypes.includes(file.type)) {
      alert(
        "Please upload a PDF or DOCX file."
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(
        "File size must be less than 5 MB."
      );
      return;
    }

    setResumeFile(file);
  };

  const handleGenerate = async () => {
    if (!resumeFile) {
      alert("Please upload your resume.");
      return;
    }

    if (!jobDescription.trim()) {
      alert(
        "Please enter the job description."
      );
      return;
    }

    try {
      setLoading(true);
      setIsStreaming(false);
      setCoverLetter("");
      setCopied(false);
     const formData = new FormData();

      formData.append( "resume", resumeFile );

      formData.append( "jobDescription", jobDescription);

      console.log(
        "We are sending request to backend..."
      );

      const response = await fetch(
        "api/generate-cover-letter/api/generate",
        {
          method: "POST",
          body: formData,
        }
      );


      if (!response.ok) {
        let message =
          response.status === 429
            ? "Gemini is rate-limited right now. We retried automatically but it's still busy ,please try again shortly."
            : "Failed to generate cover letter.";

        try {
          const errData =
            await response.json();
          message =
            errData.error || message;
        } catch {
          // response wasn't valid JSON; so fall back to default message
        }

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error(
          "Streaming is not supported in this browser."
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let accumulated = "";
      let receivedFirstChunk = false;

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) break;

        const chunkText = decoder.decode(
          value,
          { stream: true }
        );

        if (!chunkText) continue;

        if (!receivedFirstChunk) {
          receivedFirstChunk = true;
          setLoading(false);
          setIsStreaming(true);
        }

        accumulated += chunkText;

        setCoverLetter(accumulated);
      }

      if (!receivedFirstChunk) {
        // Stream closed without ever sending text.
        throw new Error(
          "No response was generated. Please try again."
        );
      }
    } catch (error) {
      console.error(
        "Generate error:",
        error
      );

      alert(
        error.message ||
          "Connection error."
      );
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const handleCopy = async () => {
    if (!coverLetter) return;

    try {
      await navigator.clipboard.writeText(
        coverLetter
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "Copy failed:",
        error
      );

      alert(
        "Failed to copy cover letter."
      );
    }
  };

  return (
    <main className="app">

      <section className="hero">

        <span className="badge">
          AI POWERED
        </span>

        <h1>
          Create Your Perfect
          <br />
          Cover Letter
        </h1>

        <p>
          Upload your resume and provide
          a job description to generate a
          personalized cover letter.
        </p>

      </section>

      <section className="generator-container">

        {/* LEFT SIDE */}

        <div className="input-section">

          <div className="section-heading">

            <h2>Your Details</h2>

            <p>
              Upload your resume and add
              the job description.
            </p>

          </div>

          {/* Resume Upload... */}

          <div className="input-group">

            <label>
              Your Resume
            </label>

            <label className="upload-box">

              <input
                type="file"
                accept=".pdf,.docx"
                onChange={
                  handleFileChange
                }
              />

              <div className="upload-icon">
                📄
              </div>

              <h3>
                {resumeFile
                  ? resumeFile.name
                  : "Upload your resume"}
              </h3>

              <p>
                {resumeFile
                  ? `${(
                      resumeFile.size /
                      1024 /
                      1024
                    ).toFixed(2)} MB`
                  : "PDF or DOCX • Maximum 5 MB"}
              </p>

              <span className="choose-file">
                Choose File
              </span>

            </label>

          </div>

          {/* Job Description.... */}

          <div className="input-group">

            <label>
              Target Job Description
            </label>

            <textarea
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(e) =>
                setJobDescription(
                  e.target.value
                )
              }
            />

          </div>

          {/* Generate Button..... */}

          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={loading || isStreaming}
          >
            {loading
              ? "Starting..."
              : isStreaming
              ? "Generating..."
              : "✨ Generate Cover Letter"}
          </button>

        </div>

        {/* RIGHT SIDE */}

        <div className="output-section">

          <div className="section-heading">

            <h2>
              Your Cover Letter
            </h2>

            <p>
              Your AI-generated cover
              letter will appear here.
            </p>

          </div>

          <div className="cover-letter-box">

            {loading ? (

              <div className="empty-state">

                <span>✨</span>

                <h3>
                  Connecting...
                </h3>

                <p>
                  Reaching out to the AI
                  model (automatically
                  retries if it's briefly
                  rate-limited).
                </p>

              </div>

            ) : coverLetter ? (

              <div className="cover-letter-content">

                {/* Markdown → HTML, re-parsed on every
                    chunk so the letter renders lives in it */}

                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      marked.parse(
                        coverLetter
                      ),
                  }}
                />

                {isStreaming && (
                  <span className="cursor">
                    ▍
                  </span>
                )}

                {/* Copy button only once
                    streaming has finished */}

                {!isStreaming && (
                  <button
                    className="copy-btn"
                    onClick={
                      handleCopy
                    }
                  >
                    {copied
                      ? "✓ Copied!"
                      : "📋 Copy"}
                  </button>
                )}

              </div>

            ) : (

              <div className="empty-state">

                <span>✦</span>

                <h3>
                  Ready to Create
                </h3>

                <p>
                  Upload your resume and
                  enter a job description
                  to generate your
                  personalized cover letter.
                </p>

              </div>

            )}

          </div>

        </div>

      </section>

    </main>
  );
}

export default App;