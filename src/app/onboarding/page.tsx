"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import MiruLogo from "@/components/MiruLogo";
import CompanyCard from "@/components/CompanyCard";
import { COMPANIES } from "@/lib/types";
import { session } from "@/lib/session";
import { startInterview } from "@/lib/api";

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? 60 : -60, opacity: 0 }),
};

type LanguageMode = "japanese" | "english";
type DurationMode = "demo" | "full";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [cvText, setCvText] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [languageMode, setLanguageMode] = useState<LanguageMode>("english");
  const [durationMode, setDurationMode] = useState<DurationMode>("demo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const goNext = () => { setDir(1); setStep((s) => s + 1); };
  const goBack = () => { setDir(-1); setStep((s) => s - 1); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") setCvText(result);
    };
    reader.readAsText(file);
  };

  const handleBegin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await startInterview({
        user_name: name,
        target_role: role,
        company: selectedCompany,
        language_mode: languageMode,
        duration_mins: durationMode === "demo" ? 3 : 15,
      });

      session.setSessionId(res.session_id);
      session.setCompany(selectedCompany);
      session.setLanguageMode(languageMode);
      session.setCvText(cvText);
      session.setDurationMode(durationMode);
      session.setCandidateName(name);
      session.setTargetRole(role);
      session.setInterviewStarted(true);

      router.push("/interview");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start interview. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const canProceed1 = name.trim().length > 0 && role.trim().length > 0;
  const canProceed2 = selectedCompany.length > 0;

  const selectedCompanyData = COMPANIES.find((c) => c.name === selectedCompany);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          padding: "20px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <MiruLogo size="sm" />

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {[1, 2, 3].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  border: s <= step
                    ? "1px solid var(--accent-primary)"
                    : "1px solid var(--border-subtle)",
                  background: s < step
                    ? "var(--accent-primary)"
                    : s === step
                    ? "rgba(108,99,255,0.15)"
                    : "transparent",
                  color: s < step
                    ? "#fff"
                    : s === step
                    ? "var(--accent-primary)"
                    : "var(--text-dim)",
                  transition: "all 0.3s",
                }}
              >
                {s < step ? "✓" : s}
              </div>
              {i < 2 && (
                <div
                  style={{
                    width: 32,
                    height: 1,
                    background: s < step
                      ? "var(--accent-primary)"
                      : "var(--border-subtle)",
                    transition: "background 0.3s",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div style={{ width: "100%", maxWidth: 640, position: "relative" }}>
        <AnimatePresence mode="wait" custom={dir}>
          {step === 1 && (
            <motion.div
              key="step1"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="glass-card"
                style={{ padding: "40px 36px", position: "relative", overflow: "hidden" }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0,
                    height: 2,
                    background: "linear-gradient(90deg, var(--accent-primary), #8B5CF6)",
                  }}
                />

                <StepHeader
                  number={1}
                  title="Who are you?"
                  sub="Tell us about yourself so we can personalize the interview."
                />

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <FormField
                    label="Your Name"
                    placeholder="Sato Kenji"
                    value={name}
                    onChange={setName}
                  />
                  <FormField
                    label="Target Role"
                    placeholder="Software Engineer, Marketing Manager…"
                    value={role}
                    onChange={setRole}
                  />
                </div>

                <NavButtons onNext={goNext} canNext={canProceed1} hideBack />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="glass-card"
                style={{ padding: "40px 36px", position: "relative", overflow: "hidden" }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0,
                    height: 2,
                    background: "linear-gradient(90deg, var(--accent-primary), #8B5CF6)",
                  }}
                />

                <StepHeader
                  number={2}
                  title="Select your target company"
                  sub="Each company has a different cultural profile. We'll tailor the scoring."
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 12,
                  }}
                >
                  {COMPANIES.map((c) => (
                    <CompanyCard
                      key={c.id}
                      name={c.name}
                      label={c.label}
                      descriptor={c.descriptor}
                      accent={c.accent}
                      bg={c.bg}
                      selected={selectedCompany === c.name}
                      onSelect={() => setSelectedCompany(c.name)}
                    />
                  ))}
                </div>

                <NavButtons onBack={goBack} onNext={goNext} canNext={canProceed2} />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="glass-card"
                style={{ padding: "40px 36px", position: "relative", overflow: "hidden" }}
              >
                {/* Company-colored top accent */}
                <div
                  style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0,
                    height: 2,
                    background: selectedCompanyData
                      ? `linear-gradient(90deg, ${selectedCompanyData.accent}, ${selectedCompanyData.accent}80)`
                      : "linear-gradient(90deg, var(--accent-primary), #8B5CF6)",
                  }}
                />

                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
                  <StepHeader
                    number={3}
                    title="Session setup"
                    sub="Configure your interview preferences."
                  />
                  {selectedCompanyData && (
                    <div
                      style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: `1px solid ${selectedCompanyData.accent}40`,
                        background: selectedCompanyData.bg,
                        flexShrink: 0,
                        marginLeft: 16,
                        marginTop: 4,
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 11,
                          color: selectedCompanyData.accent,
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {selectedCompany.toUpperCase()}
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 13,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {selectedCompanyData.label}
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {/* CV Upload */}
                  <div>
                    <SectionLabel>CV / Resume <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(optional)</span></SectionLabel>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.doc,.docx"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          flex: 1,
                          padding: "13px 16px",
                          borderRadius: 10,
                          border: cvFileName
                            ? `1px solid ${selectedCompanyData?.accent ?? "var(--accent-primary)"}60`
                            : "1px dashed var(--border-subtle)",
                          background: cvFileName
                            ? (selectedCompanyData?.bg ?? "rgba(108,99,255,0.06)")
                            : "rgba(13,13,20,0.6)",
                          color: cvFileName
                            ? (selectedCompanyData?.accent ?? "var(--accent-primary)")
                            : "var(--text-dim)",
                          fontFamily: "var(--font-body)",
                          fontSize: 13,
                          cursor: "pointer",
                          textAlign: "left" as const,
                          transition: "all 0.2s",
                        }}
                      >
                        {cvFileName || "↑ Upload CV (PDF, TXT, DOC)"}
                      </button>
                      {cvFileName && (
                        <button
                          onClick={() => { setCvText(""); setCvFileName(""); }}
                          style={{
                            padding: "0 14px",
                            borderRadius: 10,
                            border: "1px solid var(--border-subtle)",
                            background: "transparent",
                            color: "var(--text-dim)",
                            cursor: "pointer",
                            fontSize: 16,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {!cvFileName && (
                      <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, fontFamily: "var(--font-body)" }}>
                        Skip to use standard questions
                      </p>
                    )}
                  </div>

                  {/* Language Mode */}
                  <div>
                    <SectionLabel>Interview Language</SectionLabel>
                    <div style={{ display: "flex", gap: 10 }}>
                      {(
                        [
                          { value: "english", label: "English", sub: "HR Mode" },
                          { value: "japanese", label: "Japanese", sub: "日本語モード" },
                        ] as const
                      ).map((opt) => (
                        <ToggleButton
                          key={opt.value}
                          selected={languageMode === opt.value}
                          onClick={() => setLanguageMode(opt.value)}
                          accent={selectedCompanyData?.accent}
                        >
                          <span style={{ display: "block", fontWeight: 600, fontSize: 13 }}>{opt.label}</span>
                          <span style={{ display: "block", fontSize: 11, opacity: 0.7, marginTop: 2 }}>{opt.sub}</span>
                        </ToggleButton>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <SectionLabel>Session Duration</SectionLabel>
                    <div style={{ display: "flex", gap: 10 }}>
                      {(
                        [
                          { value: "demo", label: "Demo", sub: "3 questions" },
                          { value: "full", label: "Full", sub: "5 questions" },
                        ] as const
                      ).map((opt) => (
                        <ToggleButton
                          key={opt.value}
                          selected={durationMode === opt.value}
                          onClick={() => setDurationMode(opt.value)}
                          accent={selectedCompanyData?.accent}
                        >
                          <span style={{ display: "block", fontWeight: 600, fontSize: 13 }}>{opt.label}</span>
                          <span style={{ display: "block", fontSize: 11, opacity: 0.7, marginTop: 2 }}>{opt.sub}</span>
                        </ToggleButton>
                      ))}
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: "14px 18px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,107,107,0.3)",
                        background: "rgba(255,107,107,0.06)",
                        color: "var(--accent-warm)",
                        fontSize: 13,
                        fontFamily: "var(--font-body)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      {error}
                      <button
                        onClick={() => setError("")}
                        style={{ background: "none", border: "none", color: "var(--accent-warm)", cursor: "pointer", marginLeft: 12 }}
                      >
                        ×
                      </button>
                    </motion.div>
                  )}
                </div>

                <NavButtons
                  onBack={goBack}
                  onNext={handleBegin}
                  nextLabel={loading ? "Starting…" : "Begin Interview →"}
                  canNext={!loading}
                  nextStyle={{
                    background: selectedCompanyData
                      ? `linear-gradient(135deg, ${selectedCompanyData.accent}, ${selectedCompanyData.accent}CC)`
                      : "linear-gradient(135deg, var(--accent-primary), #8B5CF6)",
                    border: "none",
                    color: "#fff",
                    boxShadow: selectedCompanyData
                      ? `0 0 20px ${selectedCompanyData.accent}40`
                      : "0 0 20px rgba(108,99,255,0.3)",
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepHeader({ number, title, sub }: { number: number; title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p
        style={{
          fontSize: 11,
          color: "var(--accent-secondary)",
          letterSpacing: "0.12em",
          fontFamily: "var(--font-body)",
          marginBottom: 8,
        }}
      >
        STEP {number} OF 3
      </p>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(22px, 4vw, 32px)",
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 8,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        {sub}
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 12,
        color: "var(--text-secondary)",
        marginBottom: 10,
        fontFamily: "var(--font-body)",
        letterSpacing: "0.06em",
        fontWeight: 500,
        textTransform: "uppercase" as const,
      }}
    >
      {children}
    </p>
  );
}

function FormField({ label, placeholder, value, onChange }: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          color: "var(--text-secondary)",
          marginBottom: 8,
          fontFamily: "var(--font-body)",
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          fontWeight: 500,
        }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "13px 16px",
          borderRadius: 10,
          border: "1px solid var(--border-subtle)",
          background: "rgba(13,13,20,0.8)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-body)",
          fontSize: 15,
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxSizing: "border-box" as const,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--border-active)";
          e.target.style.boxShadow = "0 0 0 3px rgba(108,99,255,0.12)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--border-subtle)";
          e.target.style.boxShadow = "none";
        }}
      />
    </div>
  );
}

function ToggleButton({ selected, onClick, children, accent }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: string;
}) {
  const activeColor = accent ?? "var(--accent-primary)";
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "12px 16px",
        borderRadius: 10,
        border: selected
          ? `1px solid ${accent ? accent + "80" : "var(--accent-primary)"}`
          : "1px solid var(--border-subtle)",
        background: selected
          ? (accent ? `${accent}14` : "rgba(108,99,255,0.12)")
          : "rgba(13,13,20,0.6)",
        color: selected ? activeColor : "var(--text-secondary)",
        fontFamily: "var(--font-body)",
        fontSize: 13,
        cursor: "pointer",
        transition: "all 0.2s",
        textAlign: "left" as const,
      }}
    >
      {children}
    </button>
  );
}

function NavButtons({ onBack, onNext, canNext = true, hideBack = false, nextLabel = "Continue →", nextStyle = {} }: {
  onBack?: () => void;
  onNext?: () => void;
  canNext?: boolean;
  hideBack?: boolean;
  nextLabel?: string;
  nextStyle?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
      {!hideBack && (
        <button
          onClick={onBack}
          style={{
            padding: "13px 24px",
            borderRadius: 10,
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
      )}
      <motion.button
        onClick={onNext}
        disabled={!canNext}
        whileHover={canNext ? { scale: 1.02 } : {}}
        whileTap={canNext ? { scale: 0.98 } : {}}
        style={{
          flex: 1,
          padding: "13px 24px",
          borderRadius: 10,
          border: "1px solid var(--border-active)",
          background: "rgba(108,99,255,0.08)",
          color: canNext ? "var(--text-primary)" : "var(--text-dim)",
          fontFamily: "var(--font-body)",
          fontSize: 14,
          fontWeight: 600,
          cursor: canNext ? "pointer" : "not-allowed",
          opacity: canNext ? 1 : 0.5,
          transition: "box-shadow 0.2s",
          ...nextStyle,
        }}
      >
        {nextLabel}
      </motion.button>
    </div>
  );
}
