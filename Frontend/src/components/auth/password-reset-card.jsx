"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetToken,
} from "@/lib/api";

export default function PasswordResetCard({ mode }) {
  const isRequest = mode === "request";
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(!isRequest);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [tokenIsValid, setTokenIsValid] = useState(false);

  useEffect(() => {
    if (isRequest) return;

    let active = true;

    async function checkToken() {
      if (!token) {
        setStatus({ type: "error", message: "Password reset link is missing a token." });
        setIsCheckingToken(false);
        return;
      }

      try {
        await verifyPasswordResetToken(token);
        if (active) {
          setTokenIsValid(true);
          setStatus({ type: "", message: "" });
        }
      } catch (err) {
        if (active) {
          setTokenIsValid(false);
          setStatus({
            type: "error",
            message: err?.response?.data?.message || "This password reset link is invalid or expired.",
          });
        }
      } finally {
        if (active) setIsCheckingToken(false);
      }
    }

    checkToken();
    return () => {
      active = false;
    };
  }, [isRequest, token]);

  async function handleRequest(event) {
    event.preventDefault();
    setStatus({ type: "", message: "" });

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setStatus({ type: "error", message: "Enter a valid email address." });
      return;
    }

    setIsLoading(true);
    try {
      const data = await requestPasswordReset({ email: normalizedEmail });
      setStatus({ type: "success", message: data.message });
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.response?.data?.message || "Unable to send a reset link right now.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();
    setStatus({ type: "", message: "" });

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setStatus({
        type: "error",
        message: "Password must be at least 8 characters and include a letter and a number.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    setIsLoading(true);
    try {
      const data = await resetPassword({ token, password });
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setTokenIsValid(false);
      setStatus({ type: "success", message: data.message });
    } catch (err) {
      setStatus({
        type: "error",
        message: err?.response?.data?.message || "Unable to reset password right now.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative hidden overflow-hidden border-r border-border bg-[#0B0F14] lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(124,58,237,0.30),transparent_34%),linear-gradient(225deg,rgba(34,211,238,0.20),transparent_36%),linear-gradient(180deg,#0B0F14_0%,#121821_100%)]" />
          <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(230,234,240,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(230,234,240,0.28)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#22D3EE]">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Strategy Hub</p>
                <p className="mt-1 text-xs text-[#9AA4B2]">Account recovery</p>
              </div>
            </div>
            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-[#9AA4B2]">
                <ShieldCheck className="size-3.5 text-[#22D3EE]" />
                Secure reset link
              </div>
              <h1 className="text-5xl font-semibold leading-tight tracking-normal text-[#E6EAF0]">
                Recover access without creating a new account.
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#9AA4B2]">
                Reset links are single-use, time-limited, and stored as hashes so your account stays protected.
              </p>
            </div>
            <div className="grid gap-3">
              {["One-time token", "Short expiry window", "Existing account preserved"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-[#E6EAF0]">
                  <CheckCircle2 className="size-4 text-[#22D3EE]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-[27rem]"
          >
            <Link href="/login" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>

            <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-2xl shadow-black/25 sm:p-7">
              <div>
                <p className="text-xs font-medium uppercase text-[#22D3EE]">
                  {isRequest ? "Forgot password" : "Reset password"}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-normal">
                  {isRequest ? "Send reset link" : "Create new password"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {isRequest
                    ? "Enter your registered email and we will send instructions if the account exists."
                    : "Choose a strong password to regain access to your existing account."}
                </p>
              </div>

              {isCheckingToken ? (
                <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-[#0B0F14]/60 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-[#22D3EE]" />
                  Checking reset link
                </div>
              ) : (
                <form onSubmit={isRequest ? handleRequest : handleReset} className="mt-6 space-y-4">
                  {isRequest ? (
                    <Field label="Registered email" icon={Mail}>
                      <Input
                        required
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-11 bg-[#0B0F14]/60 pl-10 focus-visible:ring-[#7C3AED]/40"
                        placeholder="you@company.com"
                      />
                    </Field>
                  ) : (
                    <>
                      <Field label="New password" icon={Lock}>
                        <Input
                          required
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          disabled={!tokenIsValid || isLoading}
                          className="h-11 bg-[#0B0F14]/60 pl-10 pr-12 focus-visible:ring-[#7C3AED]/40"
                          placeholder="At least 8 characters"
                        />
                        <PasswordVisibilityButton
                          isVisible={showPassword}
                          disabled={!tokenIsValid || isLoading}
                          onClick={() => setShowPassword((current) => !current)}
                        />
                      </Field>
                      <Field label="Confirm password" icon={Lock}>
                        <Input
                          required
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          disabled={!tokenIsValid || isLoading}
                          className="h-11 bg-[#0B0F14]/60 pl-10 pr-12 focus-visible:ring-[#7C3AED]/40"
                          placeholder="Repeat password"
                        />
                        <PasswordVisibilityButton
                          isVisible={showConfirmPassword}
                          disabled={!tokenIsValid || isLoading}
                          onClick={() => setShowConfirmPassword((current) => !current)}
                        />
                      </Field>
                    </>
                  )}

                  {status.message ? (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={
                        status.type === "error"
                          ? "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                          : "rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
                      }
                    >
                      {status.message}
                    </motion.div>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={isLoading || (!isRequest && !tokenIsValid)}
                    className="h-11 w-full bg-[#7C3AED] transition-all duration-200 hover:scale-[1.01] hover:bg-[#7C3AED] hover:shadow-[0_0_28px_rgba(124,58,237,0.38)]"
                  >
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                    {isLoading ? "Please wait" : isRequest ? "Send reset link" : "Reset password"}
                  </Button>
                </form>
              )}

              {!isRequest && status.type === "success" ? (
                <Button asChild variant="outline" className="mt-4 h-11 w-full">
                  <Link href="/login">Return to sign in</Link>
                </Button>
              ) : null}
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

function PasswordVisibilityButton({ isVisible, onClick, disabled = false }) {
  const Icon = isVisible ? Eye : EyeOff;

  return (
    <button
      type="button"
      aria-label={isVisible ? "Hide password" : "Show password"}
      aria-pressed={isVisible}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
      className="absolute right-2 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-white/[0.06] hover:text-[#22D3EE] hover:shadow-[0_0_18px_rgba(34,211,238,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/45 disabled:pointer-events-none disabled:opacity-45"
    >
      <Icon className="size-4" />
    </button>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <div className="block space-y-2">
      <span className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        {children}
      </span>
    </div>
  );
}
