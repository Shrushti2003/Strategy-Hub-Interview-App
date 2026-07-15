"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { changePassword } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const sections = [
  { id: "account", label: "Account", icon: User },
  { id: "security", label: "Security", icon: Shield },
];

const DEVICE_TRUST_KEY = "strategyhub.trustedDevice";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("account");
  const { user } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage your account identity, password, current session, and
            permanent account deletion.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        <Card className="h-fit rounded-lg bg-card/90 transition-transform duration-200 hover:-translate-y-0.5">
          <CardContent className="p-2">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-muted-foreground transition-all hover:bg-surface-1 hover:text-foreground",
                  activeSection === section.id &&
                    "bg-surface-1 text-foreground shadow-sm shadow-black/10"
                )}
              >
                <section.icon className="size-4" />
                {section.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {activeSection === "account" ? (
            <AccountSettings key={user?.id || "account"} user={user} />
          ) : null}
          {activeSection === "security" ? <SecuritySettings /> : null}
        </div>
      </div>
    </motion.div>
  );
}

function AccountSettings({ user }) {
  const { updateCurrentAccount, deleteCurrentAccount, isLoading } = useAuth();
  const [form, setForm] = useState({
    username: user?.username || "",
    email: user?.email || "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const isDirty =
    form.username.trim() !== (user?.username || "") ||
    form.email.trim().toLowerCase() !== (user?.email || "");
  const canDelete = confirmText.trim().toLowerCase() === "delete";

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
      await updateCurrentAccount({
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
      });
      setStatus({ type: "success", message: "Account updated successfully." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.response?.data?.message || "Could not update account.",
      });
    }
  }

  async function handleDeleteAccount() {
    if (!canDelete) return;

    try {
      setDeleteError("");
      await deleteCurrentAccount();
    } catch (error) {
      setDeleteError(
        error?.response?.data?.message || "Could not delete account. Try again."
      );
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-lg bg-card/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4 text-primary" />
            Account
          </CardTitle>
          <CardDescription>
            Keep your profile identity accurate across the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  Name
                </span>
                <Input
                  value={form.username}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  className="h-10"
                  placeholder="Your name"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  Email
                </span>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="h-10"
                  placeholder="you@company.com"
                />
              </label>
            </div>

            <StatusMessage status={status} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={!isDirty || isLoading}
                onClick={() =>
                  setForm({
                    username: user?.username || "",
                    email: user?.email || "",
                  })
                }
              >
                Reset
              </Button>
              <Button type="submit" disabled={!isDirty || isLoading}>
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Save account
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-destructive/25 bg-destructive/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            Delete account
          </CardTitle>
          <CardDescription>
            Permanently remove this account and all generated workspace data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            This clears your auth session and cannot be undone.
          </p>
          <Dialog>
            <DialogTrigger render={<Button variant="destructive" />}>
              <Trash2 className="size-4" />
              Delete account
            </DialogTrigger>
            <DialogContent className="border-border bg-popover">
              <DialogHeader>
                <DialogTitle>Delete this account?</DialogTitle>
                <DialogDescription>
                  Type delete to confirm permanent account removal.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  className="h-10"
                  placeholder="delete"
                />
                {deleteError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {deleteError}
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button
                  variant="destructive"
                  disabled={!canDelete || isLoading}
                  onClick={handleDeleteAccount}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Permanently delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

function SecuritySettings() {
  const { logout, isLoading } = useAuth();
  const [trustedDevice, setTrustedDevice] = useState(() =>
    typeof window !== "undefined"
      ? window.localStorage.getItem(DEVICE_TRUST_KEY) === "true"
      : false
  );
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });

  function toggleTrustedDevice() {
    setTrustedDevice((current) => {
      const next = !current;
      window.localStorage.setItem(DEVICE_TRUST_KEY, String(next));
      return next;
    });
  }

  async function handlePasswordSave(event) {
    event.preventDefault();
    setStatus({ type: "", message: "" });

    if (
      passwordForm.newPassword.length < 8 ||
      !/[A-Za-z]/.test(passwordForm.newPassword) ||
      !/\d/.test(passwordForm.newPassword)
    ) {
      setStatus({
        type: "error",
        message: "New password must be at least 8 characters and include a letter and a number.",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setStatus({ type: "error", message: "New passwords do not match." });
      return;
    }

    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setStatus({ type: "success", message: "Password updated successfully." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.response?.data?.message || "Could not update password.",
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-lg bg-card/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            Password
          </CardTitle>
          <CardDescription>
            Change your password after confirming the current one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSave} className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <PasswordField
                label="Current password"
                value={passwordForm.currentPassword}
                onChange={(value) =>
                  setPasswordForm((current) => ({
                    ...current,
                    currentPassword: value,
                  }))
                }
              />
              <PasswordField
                label="New password"
                value={passwordForm.newPassword}
                onChange={(value) =>
                  setPasswordForm((current) => ({
                    ...current,
                    newPassword: value,
                  }))
                }
              />
              <PasswordField
                label="Confirm password"
                value={passwordForm.confirmPassword}
                onChange={(value) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirmPassword: value,
                  }))
                }
              />
            </div>

            <StatusMessage status={status} />

            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Update password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-lg bg-card/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Laptop className="size-4 text-primary" />
            Current session
          </CardTitle>
          <CardDescription>
            Manage this browser session and local device trust.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Trust this device</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Saves a local marker so this browser can be recognized as your
                usual device.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={trustedDevice}
              onClick={toggleTrustedDevice}
              className={cn(
                "relative h-7 w-12 rounded-full border border-border bg-surface-3 transition-colors",
                trustedDevice && "border-primary bg-primary/80"
              )}
            >
              <span
                className={cn(
                  "absolute left-1 top-1 size-5 rounded-full bg-white transition-transform",
                  trustedDevice && "translate-x-5"
                )}
              />
            </button>
          </div>

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Clear this browser session and return to the public landing page.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={logout} disabled={isLoading}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordField({ label, value, onChange }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <label className="space-y-2">
      <span className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <span className="relative block">
        <Input
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 pr-10"
          autoComplete={label === "Current password" ? "current-password" : "new-password"}
        />
        <button
          type="button"
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsVisible((current) => !current)}
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </button>
      </span>
    </label>
  );
}

function StatusMessage({ status }) {
  if (!status.message) return null;

  const isSuccess = status.type === "success";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        isSuccess
          ? "border-success/30 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      {isSuccess ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
      {status.message}
    </div>
  );
}
