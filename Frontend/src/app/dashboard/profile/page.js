"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/providers/auth-provider";

export default function ProfilePage() {
  const { user, updateCurrentAccount, isLoading } = useAuth();
  const [form, setForm] = useState({
    username: user?.username || "",
    email: user?.email || "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const displayName = user?.username || "";
  const displayEmail = user?.email || "";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  const details = [
    { icon: Mail, label: "Email", value: displayEmail || "Not set" },
    { icon: Briefcase, label: "Workspace", value: "Personal" },
    { icon: ShieldCheck, label: "Session", value: "Signed in" },
  ];
  const isDirty =
    form.username.trim() !== displayName ||
    form.email.trim().toLowerCase() !== displayEmail;

  async function handleSave(event) {
    event.preventDefault();
    setStatus({ type: "", message: "" });

    if (form.username.trim().length < 2) {
      setStatus({ type: "error", message: "Name must be at least 2 characters." });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setStatus({ type: "error", message: "Enter a valid email address." });
      return;
    }

    try {
      const nextAccount = {
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
      };
      await updateCurrentAccount(nextAccount);
      setForm(nextAccount);
      setStatus({ type: "success", message: "Profile updated successfully." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.response?.data?.message || "Could not update profile.",
      });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Profile
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage the real account details attached to this session.
        </p>
      </div>

      <Card className="relative overflow-hidden bg-card/90">
        <div className="pointer-events-none absolute inset-0 animate-ambient bg-[radial-gradient(circle_at_22%_0%,rgba(124,58,237,0.16),transparent_36%)]" />
        <CardContent className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-20">
              <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {displayName}
                </h2>
                <Badge variant="secondary">Active</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {displayEmail}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                This profile is populated from your authenticated account.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => window.location.assign("/dashboard/settings")}>
            Security settings
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Card className="bg-card/90">
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
            <CardDescription>
              These fields reflect your registered account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Full name
                </span>
                <Input
                  value={form.username}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, username: event.target.value }))
                  }
                  className="h-10"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email address
                </span>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  className="h-10"
                />
              </label>
              </div>
              {status.message ? <StatusMessage status={status} /> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isDirty || isLoading}
                  onClick={() =>
                    setForm({
                      username: displayName,
                      email: displayEmail,
                    })
                  }
                >
                  Reset
                </Button>
                <Button type="submit" disabled={!isDirty || isLoading}>
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-card/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" />
              Account summary
            </CardTitle>
            <CardDescription>
              Current session and account status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {details.map((item, index) => (
              <div key={item.label}>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-1 text-primary">
                    <item.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.value}
                    </p>
                  </div>
                </div>
                {index < details.length - 1 ? <Separator className="mt-4" /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

function StatusMessage({ status }) {
  const isSuccess = status.type === "success";

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        isSuccess
          ? "border-success/30 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
    >
      {isSuccess ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
      {status.message}
    </div>
  );
}
