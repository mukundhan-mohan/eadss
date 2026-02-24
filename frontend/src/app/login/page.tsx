"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, adminRegister } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordChecks = useMemo(
    () => [
      { label: "At least 8 characters", ok: password.length >= 8 },
      { label: "At least one uppercase letter", ok: /[A-Z]/.test(password) },
      { label: "At least one lowercase letter", ok: /[a-z]/.test(password) },
      { label: "At least one number", ok: /[0-9]/.test(password) },
      { label: "At least one special character", ok: /[^A-Za-z0-9]/.test(password) },
      { label: "Password and confirm password match", ok: !!password && password === confirmPassword },
    ],
    [password, confirmPassword]
  );

  function isValidEmail(value: string) {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value.trim());
  }

  function validateRegisterInput() {
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) return "Enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
    if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
    if (!/[0-9]/.test(password)) return "Password must include at least one number.";
    if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least one special character.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }

  async function onSignIn() {
    setLoading(true);
    setError(null);
    try {
      await adminLogin(email.trim(), password);
      localStorage.setItem("eadss_admin_logged_in", "1");
      router.push("/try-now");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onRegister() {
    const validationError = validateRegisterInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await adminRegister(email.trim(), password);
      localStorage.setItem("eadss_admin_logged_in", "1");
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
              <details>
                <summary className="meta" style={{ cursor: "pointer" }}>
                  Password checks ({passwordChecks.filter((c) => c.ok).length}/{passwordChecks.length})
                </summary>
                <div className="list" style={{ marginTop: 8 }}>
                  {passwordChecks.map((check) => (
                    <div key={check.label} className="list-item split">
                      <span>{check.label}</span>
                      <strong style={{ color: check.ok ? "#18794e" : "#b73239" }}>
                        {check.ok ? "Matched" : "Mismatch"}
                      </strong>
                    </div>
                  ))}
                </div>
              </details>
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
