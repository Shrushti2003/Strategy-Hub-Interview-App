"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  FileUp,
  Info,
  Loader2,
  RefreshCcw,
  Star,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { deleteReport, generateReport, getAllReports, getReportStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_JOB_DESCRIPTION_LENGTH = 5000;

export default function AiGenerationFlow() {
  const router = useRouter();
  const resumeInputRef = useRef(null);
  const styleResumeInputRef = useRef(null);
  const [jobDescription, setJobDescription] = useState("");
  const [selfDescription, setSelfDescription] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [styleResumeFile, setStyleResumeFile] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [reports, setReports] = useState([]);
  const [deletingReportId, setDeletingReportId] = useState("");
  const [error, setError] = useState("");
  const [processingJob, setProcessingJob] = useState(null);
  const pollTimeoutRef = useRef(null);

  const canGenerate = useMemo(
    () =>
      jobDescription.trim().length > 0 &&
      jobDescription.length <= MAX_JOB_DESCRIPTION_LENGTH &&
      (resumeFile || selfDescription.trim().length > 0) &&
      !isGenerating,
    [jobDescription, resumeFile, selfDescription, isGenerating]
  );

  const loadReports = useCallback(async () => {
    setIsLoadingReports(true);

    try {
      const data = await getAllReports();
      setReports(data.interviewReports || []);
    } catch {
      toast.error("Could not load recent interview plans.");
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(loadReports, 0);
    return () => window.clearTimeout(handle);
  }, [loadReports]);

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        window.clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  function validateFile(file) {
    if (!file) return "";

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    const isAllowedExtension = /\.(pdf|docx|txt)$/i.test(file.name);

    if (!allowedTypes.includes(file.type) && !isAllowedExtension) {
      return "Upload a PDF, DOCX, or TXT file.";
    }

    if (file.size > 5 * 1024 * 1024) {
      return "File size must be 5MB or smaller.";
    }

    return "";
  }

  function handleFileChange(event, setter) {
    const file = event.target.files?.[0] || null;
    const validationMessage = validateFile(file);

    if (validationMessage) {
      toast.error(validationMessage);
      event.target.value = "";
      setter(null);
      return;
    }

    setter(file);
  }

  async function handleGenerate(event) {
    event.preventDefault();

    if (!jobDescription.trim()) {
      setError("Job description is required.");
      return;
    }

    if (!resumeFile && !selfDescription.trim()) {
      setError("Either a resume or a self description is required.");
      return;
    }

    setError("");
    setIsGenerating(true);
    setProcessingJob(null);

    try {
      const formData = new FormData();
      formData.append("jobDescription", jobDescription.trim());
      formData.append("selfDescription", selfDescription.trim());
      if (resumeFile) formData.append("resume", resumeFile);
      if (styleResumeFile) formData.append("styleResume", styleResumeFile);

      const data = await generateReport(formData);
      const reportId = data.reportId || data.interviewReport?._id;

      if (!reportId) {
        throw new Error("The backend did not return a report id.");
      }

      const processingReport = data.interviewReport || {
        _id: reportId,
        title: "Interview strategy is being generated",
        generationStatus: "processing",
        generationStage: "queued",
        createdAt: new Date().toISOString(),
      };

      setReports((current) => [
        processingReport,
        ...current.filter((item) => item._id !== reportId),
      ]);
      setProcessingJob({
        reportId,
        status: "processing",
        stage: "queued",
      });
      toast.success("Interview generation started.");
      pollReportStatus(reportId);
    } catch (err) {
      const backendError = err?.response?.data;
      const isBackendUnreachable = !err?.response;
      const message =
        backendError?.reason ||
        backendError?.message ||
        err?.message ||
        (isBackendUnreachable
          ? "Strategy generation failed. Please confirm the backend is running and try again."
          : "Strategy generation failed. Please try again.");
      const detailedMessage = backendError?.step && !backendError?.reason
        ? `${message} Step: ${backendError.step}`
        : message;
      setError(detailedMessage);
      toast.error(detailedMessage);
      setIsGenerating(false);
      setProcessingJob(null);
    }
  }

  async function pollReportStatus(reportId) {
    if (pollTimeoutRef.current) {
      window.clearTimeout(pollTimeoutRef.current);
    }

    try {
      const statusData = await getReportStatus(reportId);
      setProcessingJob({
        reportId,
        status: statusData.status,
        stage: statusData.stage || "",
      });

      if (statusData.status === "completed") {
        setIsGenerating(false);
        setProcessingJob(null);
        await loadReports();
        if (Array.isArray(statusData.generationWarnings) && statusData.generationWarnings.length) {
          toast.success(
            "Interview generated. Resume Builder may be temporarily unavailable due to Gemini quota."
          );
        } else {
          toast.success("Interview strategy generated.");
        }
        router.push(`/dashboard/interview/${reportId}`);
        return;
      }

      if (statusData.status === "failed") {
        const message = statusData.error || "Interview generation failed. Please try again.";
        setIsGenerating(false);
        setProcessingJob(null);
        setError(message);
        await loadReports();
        toast.error(message);
        return;
      }

      pollTimeoutRef.current = window.setTimeout(() => pollReportStatus(reportId), 2000);
    } catch (err) {
      const message = err?.response?.data?.message || "Could not check generation status.";
      setIsGenerating(false);
      setProcessingJob(null);
      setError(message);
      toast.error(message);
    }
  }

  async function handleDeleteReport(reportId) {
    setDeletingReportId(reportId);

    try {
      await deleteReport(reportId);
      setReports((current) => current.filter((report) => report._id !== reportId));
      toast.success("Interview plan deleted.");
    } catch {
      toast.error("Could not delete this interview plan.");
    } finally {
      setDeletingReportId("");
    }
  }

  return (
    <motion.div
      id="ai-strategy"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="mx-auto w-full max-w-[100rem] pb-8"
    >
      <form
        onSubmit={handleGenerate}
        className="overflow-hidden rounded-xl border border-border bg-card/90 shadow-2xl shadow-black/20"
      >
        <div className="grid lg:grid-cols-[1.05fr_1fr]">
          <section className="border-b border-border p-5 lg:border-b-0 lg:border-r lg:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <BriefcaseBusiness className="size-5 text-fuchsia-400" />
                Target Job Description
              </h2>
              <Badge className="border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200" variant="outline">
                Required
              </Badge>
            </div>
            <div className="relative">
              <Textarea
                value={jobDescription}
                onChange={(event) =>
                  setJobDescription(event.target.value.slice(0, MAX_JOB_DESCRIPTION_LENGTH))
                }
                placeholder="Paste the full job description here... e.g. Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design..."
                className="min-h-[26rem] resize-none rounded-lg border-border bg-surface-1/90 p-5 text-base leading-7 text-white placeholder:text-muted-foreground"
                aria-label="Job description"
              />
              <span className="absolute bottom-4 right-4 text-xs text-muted-foreground">
                {jobDescription.length} / {MAX_JOB_DESCRIPTION_LENGTH} chars
              </span>
            </div>
          </section>

          <section className="space-y-6 p-5 lg:p-7">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <UserRound className="size-5 text-fuchsia-400" />
              Your Profile
            </h2>

            <UploadBlock
              title="Upload Resume"
              badge="Best results"
              icon={UploadCloud}
              file={resumeFile}
              inputRef={resumeInputRef}
              onFileChange={(event) => handleFileChange(event, setResumeFile)}
              onClick={() => resumeInputRef.current?.click()}
              onClear={() => setResumeFile(null)}
              description="Click to upload or drag & drop"
              caption="PDF or DOCX (Max 5MB)"
            />

            <UploadBlock
              title="Style Reference Resume"
              badge="Match uploaded resume style"
              icon={FileUp}
              file={styleResumeFile}
              inputRef={styleResumeInputRef}
              onFileChange={(event) => handleFileChange(event, setStyleResumeFile)}
              onClick={() => styleResumeInputRef.current?.click()}
              onClear={() => setStyleResumeFile(null)}
              description="Upload a sample resume to match its format"
              caption="We clone spacing, section order, and layout style"
            />

            <div className="flex items-center gap-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              Or
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-white" htmlFor="self-description">
                Quick Self-Description
              </label>
              <Textarea
                id="self-description"
                value={selfDescription}
                onChange={(event) => setSelfDescription(event.target.value)}
                placeholder="Briefly describe your experience, key skills, and years of experience if you don't have a resume handy..."
                className="min-h-28 resize-none rounded-lg border-border bg-surface-1/90 p-4 text-white placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex gap-3 rounded-lg border border-blue-500/35 bg-blue-500/12 p-4 text-sm text-blue-100">
              <Info className="mt-0.5 size-4 shrink-0 text-blue-300" />
              <p>
                Either a <strong>Resume</strong> or a <strong>Self Description</strong> is required to generate a personalized plan.
              </p>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between lg:p-7">
          <p className="text-sm text-muted-foreground">
            AI-Powered Strategy Generation • Background processing keeps the dashboard responsive
          </p>
          <Button
            type="submit"
            size="lg"
            disabled={!canGenerate}
            className="h-12 min-w-64 bg-gradient-to-r from-fuchsia-500 to-pink-600 text-base text-white shadow-lg shadow-fuchsia-950/30 hover:brightness-110"
          >
            {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4" />}
            {isGenerating ? "Generating in Background" : "Generate My Interview Strategy"}
          </Button>
        </div>

        {processingJob ? (
          <div className="border-t border-fuchsia-400/25 bg-fuchsia-500/10 px-5 py-4 text-sm text-fuchsia-100 lg:px-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-2 font-semibold">
                <Loader2 className="size-4 animate-spin" />
                Strategy generation is running in the background
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-fuchsia-200/80">
                {formatStage(processingJob.stage)}
              </span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="border-t border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive lg:px-7">
            {error}
          </div>
        ) : null}
      </form>

      <section className="mt-10">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">My Recent Interview Plans</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Saved strategies stay here until you delete them.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={loadReports} disabled={isLoadingReports}>
            {isLoadingReports ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            Refresh
          </Button>
        </div>

        {isLoadingReports ? (
          <div className="rounded-xl border border-border bg-card/80 p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 size-6 animate-spin text-fuchsia-300" />
            Loading saved interview plans...
          </div>
        ) : reports.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reports.map((report) => (
              <RecentPlanCard
                key={report._id}
                report={report}
                onOpen={() => router.push(`/dashboard/interview/${report._id}`)}
                onDelete={() => handleDeleteReport(report._id)}
                isDeleting={deletingReportId === report._id}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/70 p-8 text-center">
            <p className="font-semibold text-white">No interview plans yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Generate your first strategy to start tracking preparation plans.
            </p>
          </div>
        )}
      </section>
    </motion.div>
  );
}

function RecentPlanCard({ report, onOpen, onDelete, isDeleting }) {
  const title = report.jobTitle || report.title || "Interview Plan";
  const company = report.company || "";
  const generationStatus = report.generationStatus || "completed";
  const isProcessing = generationStatus === "processing";
  const isFailed = generationStatus === "failed";

  return (
    <article className="group rounded-xl border border-border bg-card/90 p-5 shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-fuchsia-400/45">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Job Description
          </p>
          <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-6 text-white">{title}</h3>
          {company ? <p className="mt-1 truncate text-sm text-muted-foreground">{company}</p> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label={`Delete ${title}`}
          className="shrink-0 text-pink-200 hover:bg-pink-500/15 hover:text-pink-100"
        >
          {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <CalendarDays className="size-4 text-fuchsia-300" />
        <span>{isProcessing ? "Started" : isFailed ? "Failed" : "Generated"} on {formatDate(report.createdAt)}</span>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <Badge className={cn(
          "border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-100",
          isProcessing && "border-blue-400/35 bg-blue-500/15 text-blue-100",
          isFailed && "border-red-400/35 bg-red-500/15 text-red-100"
        )} variant="outline">
          {isProcessing
            ? formatStage(report.generationStage || "processing")
            : isFailed
              ? "Generation failed"
              : `Match Score: ${Number(report.matchScore || 0)}%`}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpen}
          disabled={isProcessing || isFailed}
          className="text-fuchsia-200 hover:text-white"
        >
          {isProcessing ? <Loader2 className="size-4 animate-spin" /> : null}
          {isProcessing ? "Processing" : isFailed ? "Failed" : "Open"}
          {!isProcessing && !isFailed ? (
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          ) : null}
        </Button>
      </div>
      {isFailed && report.generationError?.reason ? (
        <p className="mt-3 line-clamp-2 text-sm text-red-200/90">{report.generationError.reason}</p>
      ) : null}
    </article>
  );
}

function UploadBlock({
  title,
  badge,
  icon: Icon,
  file,
  inputRef,
  onFileChange,
  onClick,
  onClear,
  description,
  caption,
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <Badge className="border-fuchsia-500/35 bg-fuchsia-500/12 text-fuchsia-200" variant="outline">
          {badge}
        </Badge>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="sr-only"
        onChange={onFileChange}
      />
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-36 w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-1/85 p-5 text-center transition-colors hover:border-fuchsia-400/60 hover:bg-fuchsia-500/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/70",
          file && "border-fuchsia-400/60 bg-fuchsia-500/10"
        )}
      >
        <Icon className="mb-4 size-8 text-fuchsia-400" />
        <span className="font-semibold text-white">{file ? file.name : description}</span>
        <span className="mt-2 text-sm text-muted-foreground">{file ? formatFileSize(file.size) : caption}</span>
      </button>
      {file ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Remove file
        </Button>
      ) : null}
    </div>
  );
}

function formatFileSize(size) {
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function formatStage(value = "") {
  const label = String(value || "processing")
    .replace(/[-_]+/g, " ")
    .trim();

  return label
    ? label.charAt(0).toUpperCase() + label.slice(1)
    : "Processing";
}

function formatDate(value) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
