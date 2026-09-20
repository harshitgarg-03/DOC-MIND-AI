"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  FileText,
  Sparkles,
  Search,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkle,
  BarChart3,
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || "Invalid email or password.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });

      if (authError) {
        setError(authError.message || "Google login failed.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Google login error:", err);
      setError("Google login failed. Please try again.");
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await authClient.signIn.social({
        provider: "github",
        callbackURL: "/",
      });

      if (authError) {
        setError(authError.message || "GitHub login failed.");
        setLoading(false);
      }
    } catch (err) {
      console.error("GitHub login error:", err);
      setError("GitHub login failed. Please try again.");
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
          <p className="eyebrow">AI-POWERED DOCUMENT INTELLIGENCE</p>

          <h2>
            Turn your PDFs
            <br />
            into <span>knowledge.</span>
          </h2>

          <p className="visual-description">
            Upload documents, ask questions, and get intelligent answers
            grounded in your files.
          </p>

          <div className="features">
            <div className="feature">
              <div className="feature-icon">
                <Sparkles size={16} />
              </div>

              <div>
                <strong>Instant PDF analysis</strong>
                <p>Understand lengthy documents in seconds.</p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">
                <Search size={16} />
              </div>

              <div>
                <strong>Ask anything</strong>
                <p>Chat naturally with your documents.</p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon">
                <ShieldCheck size={16} />
              </div>

              <div>
                <strong>Private by design</strong>
                <p>Your documents stay inside your workspace.</p>
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
            <Search size={12} />
            Ask Questions
          </div>

          <div className="illu-chip illu-chip-c">
            <BarChart3 size={12} />
            Find Insights
          </div>
        </div>

        <div className="visual-footer">
          <span className="status-dot" />
          AI document workspace
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
            <p className="form-label">WELCOME BACK</p>

            <h1>Sign in to your workspace</h1>

            <p>Continue analyzing and exploring your documents with AI.</p>
          </div>

          {/* SOCIAL LOGIN */}

          <div className="social-buttons">
            <button type="button" onClick={handleGoogleLogin} disabled={loading}>
              <span className="google-icon">G</span>
              Continue with Google
            </button>

            <button type="button" onClick={handleGithubLogin} disabled={loading}>
              <span className="github-icon">●</span>
              Continue with GitHub
            </button>
          </div>

          <div className="divider">
            <span />
            <small>OR CONTINUE WITH EMAIL</small>
            <span />
          </div>

          {/* EMAIL LOGIN */}

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
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
              <div className="label-row">
                <label>Password</label>
                <a href="/forgot-password">Forgot password?</a>
              </div>

              <div className="input-icon-wrap">
                <Lock size={15} className="input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
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

            {/* ERROR */}

            {error && (
              <p
                style={{
                  color: "#f87171",
                  fontSize: "13px",
                  marginTop: "4px",
                }}
              >
                {error}
              </p>
            )}

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          <p className="switch-text">
            Don&apos;t have an account? <a href="/signup">Create one</a>
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
