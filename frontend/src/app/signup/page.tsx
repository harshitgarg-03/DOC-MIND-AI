"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  FileText,
  Sparkles,
  Search,
  ShieldCheck,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkle,
  MessageSquare,
  BarChart3,
} from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSignup = async () => {
    setError("");

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
            <FileText size={19} strokeWidth={2} />
          </div>

          <div className="brand-text">
            <span>
              DocMind <b>AI</b>
            </span>
            <small>PDF ANALYZER</small>
          </div>
        </div>

        <div className="visual-content">
          <p className="eyebrow">YOUR AI DOCUMENT WORKSPACE</p>

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
              <div className="feature-icon">
                <Sparkles size={16} />
              </div>

              <div>
                <strong>AI-powered summaries</strong>
                <p>Get the important points without reading every page.</p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">
                <Search size={16} />
              </div>

              <div>
                <strong>Context-aware answers</strong>
                <p>Ask questions directly against your documents.</p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">
                <ShieldCheck size={16} />
              </div>

              <div>
                <strong>One secure workspace</strong>
                <p>Keep your research and documents organized.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="visual-illustration">
          <div className="illu-stack">
            <div className="illu-card illu-card-3" />
            <div className="illu-card illu-card-2" />
            <div className="illu-card illu-card-1">
              <span className="illu-pdf-badge">PDF</span>
            </div>
          </div>

          <div className="illu-chip illu-chip-a">
            <Sparkle size={12} />
            Summarize
          </div>

          <div className="illu-chip illu-chip-b">
            <MessageSquare size={12} />
            Chat with PDF
          </div>

          <div className="illu-chip illu-chip-c">
            <BarChart3 size={12} />
            Extract Insights
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
              <FileText size={19} strokeWidth={2} />
            </div>

            <div className="brand-text">
              <span>
                DocMind <b>AI</b>
              </span>
              <small>PDF ANALYZER</small>
            </div>
          </div>

          <div className="form-header">
            <p className="form-label">
              GET STARTED <span className="form-label-badge">3</span>
            </p>

            <h1>Create your workspace</h1>

            <p>Start analyzing your PDFs with AI in a few seconds.</p>
          </div>

          {/* SOCIAL SIGNUP */}

          <div className="social-buttons">
            <button type="button" onClick={handleGoogleSignup} disabled={loading}>
              <span className="google-icon">G</span>
              Continue with Google
            </button>

            <button type="button" onClick={handleGithubSignup} disabled={loading}>
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

              <div className="input-icon-wrap">
                <User size={15} className="input-icon" />
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="input-group">
              <label>Email address</label>

              <div className="input-icon-wrap">
                <Mail size={15} className="input-icon" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>

              <div className="input-icon-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="input-trailing-icon"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label>Confirm password</label>

              <div className="input-icon-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="input-trailing-icon"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
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

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          <p className="switch-text">
            Already have an account? <a href="/login">Sign in</a>
          </p>

          <p className="terms">
            By continuing, you agree to our <span>Terms of Service</span> and{" "}
            <span>Privacy Policy</span>.
          </p>
        </div>
      </section>
    </main>
  );
}
