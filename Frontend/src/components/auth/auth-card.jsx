"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";

const authPanelContent = {
  register: {
    badge: "Get started",
    heading: "Build Your Career with AI.",
    description:
      "Create your Strategy Hub workspace and unlock smarter interview preparation, ATS resume optimization, and personalized career guidance.",
    features: [
      "AI Interview Practice",
      "ATS Resume Analysis",
      "Personalized Career Roadmap",
    ],
  },
  login: {
    badge: "Welcome back",
    heading: "Continue Your Journey.",
    description:
      "Sign in to access your interview progress, AI insights, resume analysis, and personalized career strategy.",
    features: [
      "Resume Progress",
      "Interview History",
      "AI Career Insights",
    ],
  },
};

export default function AuthCard({ mode }) {
  const isRegister = mode === "register";
  const panelContent = authPanelContent[isRegister ? "register" : "login"];
  const { login, register, isLoading } = useAuth();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const username = form.username.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (isRegister && username.length < 2) {
      setError("Enter a name with at least 2 characters.");
      return;
    }

    if (isRegister && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) {
      setError("Password must be at least 8 characters and include a letter and a number.");
      return;
    }

    try {
      if (isRegister) {
        await register({ username, email, password });
      } else {
        await login({ email, password });
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Authentication failed.");
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative hidden overflow-hidden border-r border-border bg-[#0B0F14] lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(124,58,237,0.34),transparent_34%),linear-gradient(225deg,rgba(34,211,238,0.22),transparent_36%),linear-gradient(180deg,#0B0F14_0%,#121821_100%)]" />
          <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(230,234,240,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(230,234,240,0.28)_1px,transparent_1px)] [background-size:72px_72px]" />

          <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#22D3EE]">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Strategy Hub</p>
                <p className="mt-1 text-xs text-[#9AA4B2]">AI career workspace</p>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="max-w-xl"
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-[#9AA4B2]">
                <ShieldCheck className="size-3.5 text-[#22D3EE]" />
                {panelContent.badge}
              </div>
              <h1 className="text-5xl font-semibold leading-tight tracking-normal text-[#E6EAF0]">
                {panelContent.heading}
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#9AA4B2]">
                {panelContent.description}
              </p>
            </motion.div>

            <div className="grid gap-3">
              {panelContent.features.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-[#E6EAF0] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <CheckCircle2 className="size-4 text-[#22D3EE]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-[27rem]"
          >
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface-1 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Strategy Hub</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  AI career workspace
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-2xl shadow-black/25 transition-transform duration-200 hover:-translate-y-0.5 sm:p-7">
              <div>
                <p className="text-xs font-medium uppercase text-[#22D3EE]">
                  {isRegister ? "Create account" : "Welcome back"}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-normal">
                  {isRegister ? "Start your workspace" : "Sign in to continue"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {isRegister
                    ? "Create a real account and go straight to your empty dashboard."
                    : "Use the account you created to access your dashboard."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {isRegister ? (
                  <Field label="Name" icon={UserRound}>
                    <Input
                      required
                      autoComplete="name"
                      value={form.username}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                      className="h-11 bg-[#0B0F14]/60 pl-10 focus-visible:ring-[#7C3AED]/40"
                      placeholder="Your name"
                    />
                  </Field>
                ) : null}

                <Field label="Email" icon={Mail}>
                  <Input
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className="h-11 bg-[#0B0F14]/60 pl-10 focus-visible:ring-[#7C3AED]/40"
                    placeholder="you@company.com"
                  />
                </Field>

                <Field label="Password" icon={Lock}>
                  <Input
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    minLength={8}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    className="h-11 bg-[#0B0F14]/60 pl-10 pr-12 focus-visible:ring-[#7C3AED]/40"
                    placeholder="At least 8 characters"
                  />
                  <PasswordVisibilityButton
                    isVisible={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                  />
                </Field>

                {!isRegister ? (
                  <div className="flex justify-end">
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium text-[#22D3EE] transition-colors hover:text-[#E6EAF0]"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                ) : null}

                {error ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {error}
                  </motion.div>
                ) : null}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-11 w-full bg-[#7C3AED] transition-all duration-200 hover:scale-[1.01] hover:bg-[#7C3AED] hover:shadow-[0_0_28px_rgba(124,58,237,0.38)]"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="size-4" />
                  )}
                  {isLoading
                    ? "Securing session"
                    : isRegister
                      ? "Create account"
                      : "Sign in"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isRegister ? "Already have an account?" : "New here?"}{" "}
                <Link
                  href={isRegister ? "/login" : "/register"}
                  className="font-medium text-[#22D3EE] transition-colors hover:text-[#E6EAF0]"
                >
                  {isRegister ? "Sign in" : "Create account"}
                </Link>
              </p>
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
