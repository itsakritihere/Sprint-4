import { useState } from "react";
import "./App.css";

function App() {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a PDF or DOCX file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5 MB.");
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
      alert("Please enter the job description.");
      return;
    }

    try {
      setLoading(true);
      setCoverLetter("");

      const formData = new FormData();

      formData.append("resume", resumeFile);
      formData.append("jobDescription", jobDescription);

      console.log("Sending request to backend...");

      const response = await fetch(
        "http://localhost:5000/api/generate",
        {
          method: "POST",
          body: formData,
        }
      );

      console.log("Backend response status:", response.status);

      const data = await response.json();

      console.log("Backend response:", data);

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to generate cover letter."
        );
      }

      setCoverLetter(data.coverLetter);

    } catch (error) {
      console.error("Generate error:", error);
      alert(error.message || "Connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app">

      <section className="hero">
        <span className="badge">AI POWERED</span>

        <h1>
          Create Your Perfect
          <br />
          Cover Letter
        </h1>

        <p>
          Upload your resume and provide a job description
          to generate a personalized cover letter.
        </p>
      </section>

      <section className="generator-container">

        {/* LEFT SIDE */}

        <div className="input-section">

          <div className="section-heading">
            <h2>Your Details</h2>

            <p>
              Upload your resume and add the job description.
            </p>
          </div>

          {/* Resume Upload */}

          <div className="input-group">

            <label>Your Resume</label>

            <label className="upload-box">

              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
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
                  ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB`
                  : "PDF or DOCX • Maximum 5 MB"}
              </p>

              <span className="choose-file">
                Choose File
              </span>

            </label>
          </div>

          {/* Job Description */}

          <div className="input-group">

            <label>Target Job Description</label>

            <textarea
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />

          </div>

          {/* Generate Button */}

          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading
              ? "Generating..."
              : "✨ Generate Cover Letter"}
          </button>

        </div>

        {/* RIGHT SIDE */}

        <div className="output-section">

          <div className="section-heading">

            <h2>Your Cover Letter</h2>

            <p>
              Your AI-generated cover letter will appear here.
            </p>

          </div>

          <div className="cover-letter-box">

            {loading ? (

              <div className="empty-state">
                <span>✨</span>

                <h3>
                  Generating...
                </h3>

                <p>
                  AI is analyzing your resume and job
                  description.
                </p>
              </div>

            ) : coverLetter ? (

              <div className="cover-letter-content">
                <p>{coverLetter}</p>
              </div>

            ) : (

              <div className="empty-state">

                <span>✦</span>

                <h3>
                  Ready to Create
                </h3>

                <p>
                  Upload your resume and enter a job
                  description to generate your personalized
                  cover letter.
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