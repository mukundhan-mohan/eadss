"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, adminRegister } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [confirmPassword, setConfirmPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSignIn() {
    setLoading(true);
    setError(null);
    try {
      await adminLogin(email, password);
      router.push("/try-now");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onRegister() {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await adminRegister(email, password);
      router.push("/try-now");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card stack" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Try EADSS</h1>
            <p className="page-subtitle">
              Sign in or register a new user to start integration.
            </p>
          </div>
        </div>

        <div className="row">
          <button
            className={mode === "signin" ? "button-secondary" : "button-muted"}
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            type="button"
          >
            Sign In
          </button>
          <button
            className={mode === "register" ? "button-secondary" : "button-muted"}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            type="button"
          >
            New User
          </button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>

          {mode === "register" && (
            <>
              <label className="field">
                <span>Confirm Password</span>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </label>
            </>
          )}

          <div className="row">
            {mode === "signin" ? (
              <button className="button-secondary" onClick={onSignIn} disabled={loading || !email || !password}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            ) : (
              <button
                className="button"
                onClick={onRegister}
                disabled={loading || !email || !password || !confirmPassword}
              >
                {loading ? "Creating..." : "Register New User"}
              </button>
            )}
          </div>

          {error && <div className="error">{error}</div>}
        </div>
      </section>
    </main>
  );
}
