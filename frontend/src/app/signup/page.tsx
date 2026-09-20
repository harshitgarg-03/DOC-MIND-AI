"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSignup = async () => {
    setError("");

    // Password validation
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (authError) {
        setError(authError.message || "Could not create account.");
        return;
      }

      // Signup successful
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Signup error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });

      if (authError) {
        setError(authError.message || "Google signup failed.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Google signup error:", err);
      setError("Google signup failed. Please try again.");
      setLoading(false);
    }
  };

  const handleGithubSignup = async () => {
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await authClient.signIn.social({
        provider: "github",
        callbackURL: "/",
      });

      if (authError) {
        setError(authError.message || "GitHub signup failed.");
        setLoading(false);
      }
    } catch (err) {
      console.error("GitHub signup error:", err);
      setError("GitHub signup failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">

      {/* LEFT SIDE */}

      <section className="auth-visual">
        <div className="grid-bg" />

        <div className="brand">
          <div className="brand-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M8 13h8M8 17h5" />
            </svg>
          </div>

          <span>DocMind AI</span>
        </div>

        <div className="visual-content">
          <p className="eyebrow">
            YOUR AI DOCUMENT WORKSPACE
          </p>

          <h2>
            Read less.
            <br />
            <span>Understand more.</span>
          </h2>

          <p className="visual-description">
            Bring your PDFs into one intelligent workspace and let AI help
            you find the information that matters.
          </p>

          <div className="features">
            <div className="feature">
              <div className="feature-icon">✦</div>

              <div>
                <strong>AI-powered summaries</strong>
                <p>Get the important points without reading every page.</p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">⌕</div>

              <div>
                <strong>Context-aware answers</strong>
                <p>Ask questions directly against your documents.</p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">◈</div>

              <div>
                <strong>One secure workspace</strong>
                <p>Keep your research and documents organized.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="visual-footer">
          <span className="status-dot" />
          Built for intelligent document workflows
        </div>
      </section>

      {/* RIGHT SIDE */}

      <section className="auth-form-section">
        <div className="auth-card">

          <div className="mobile-brand">
            <div className="brand-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8M8 17h5" />
              </svg>
            </div>

            DocMind AI
          </div>

          <div className="form-header">
            <p className="form-label">GET STARTED</p>

            <h1>Create your workspace</h1>

            <p>
              Start analyzing your PDFs with AI in a few seconds.
            </p>
          </div>

          {/* SOCIAL SIGNUP */}

          <div className="social-buttons">
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
            >
              <span className="google-icon">G</span>
              Continue with Google
            </button>

            <button
              type="button"
              onClick={handleGithubSignup}
              disabled={loading}
            >
              <span className="github-icon">●</span>
              Continue with GitHub
            </button>
          </div>

          <div className="divider">
            <span />
            <small>OR CONTINUE WITH EMAIL</small>
            <span />
          </div>

          {/* EMAIL SIGNUP */}

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSignup();
            }}
          >
            <div className="input-group">
              <label>Full name</label>

              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="input-group">
              <label>Email address</label>

              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="input-group">
              <label>Password</label>

              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="input-group">
              <label>Confirm password</label>

              <input
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <p
                style={{
                  color: "#f87171",
                  fontSize: "13px",
                }}
              >
                {error}
              </p>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="switch-text">
            Already have an account?{" "}
            <a href="/login">Sign in</a>
          </p>

          <p className="terms">
            By continuing, you agree to our{" "}
            <span>Terms of Service</span> and{" "}
            <span>Privacy Policy</span>.
          </p>

        </div>
      </section>
    </main>
  );
}