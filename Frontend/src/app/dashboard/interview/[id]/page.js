"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  Clipboard,
  Code2,
  Copy,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ResumeBuilder from "@/components/resume/resume-builder";
import {
  downloadResumePdf,
  exportReport,
  getReportById,
  regenerateResumeBuilder,
  updateDashboardState,
  updateQuestionState,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { key: "technical", label: "Technical Questions", icon: Code2 },
  { key: "behavioral", label: "Behavioral Questions", icon: MessageSquare },
  { key: "resume", label: "Resume Questions", icon: FileText },
  { key: "strategy", label: "Strategy", icon: Sparkles },
  { key: "roadmap", label: "Road Map", icon: Send },
  { key: "ats", label: "ATS Resume", icon: FileText },
];

const difficultyClass = {
  beginner: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
  intermediate: "border-amber-400/35 bg-amber-500/12 text-amber-100",
  advanced: "border-pink-400/35 bg-pink-500/12 text-pink-100",
};

export default function InterviewPlanPage() {
  const { id } = useParams();
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("technical");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("default");
  const [expanded, setExpanded] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [isRegeneratingResumeBuilder, setIsRegeneratingResumeBuilder] = useState(false);
  const [atsReturnState, setAtsReturnState] = useState({ section: "technical", scrollY: 0 });

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const data = await getReportById(id);
      const fetchedReport = data.interviewReport;
      const dashboardState = fetchedReport.dashboardState || {};

      setReport(fetchedReport);
      setActiveSection(dashboardState.activeSection || "technical");
      setSearch(dashboardState.search || "");
      setDifficulty(dashboardState.difficulty || "all");
      setStatus(dashboardState.status || "all");
      setSort(dashboardState.sort || "default");
    } catch (err) {
      const message = err?.response?.data?.message || "Could not load this interview plan.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;

    getReportById(id)
      .then((data) => {
        if (!active) return;

        const fetchedReport = data.interviewReport;
        const dashboardState = fetchedReport.dashboardState || {};

        setReport(fetchedReport);
        setActiveSection(dashboardState.activeSection || "technical");
        setSearch(dashboardState.search || "");
        setDifficulty(dashboardState.difficulty || "all");
        setStatus(dashboardState.status || "all");
        setSort(dashboardState.sort || "default");
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.response?.data?.message || "Could not load this interview plan.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!report?._id) return undefined;

    const handle = window.setTimeout(() => {
      updateDashboardState(report._id, {
        activeSection,
        search,
        difficulty,
        status,
        sort,
      }).catch(() => {});
    }, 450);

    return () => window.clearTimeout(handle);
  }, [activeSection, difficulty, report?._id, search, sort, status]);

  const questionState = useMemo(() => normalizeQuestionState(report?.questionState), [report]);
  const technicalQuestions = useMemo(
    () => normalizeQuestions(report?.technicalQuestions || [], "technical"),
    [report]
  );
  const behavioralQuestions = useMemo(
    () => normalizeQuestions(report?.behavioralQuestions || [], "behavioral"),
    [report]
  );
  const resumeQuestions = useMemo(() => {
    const generatedQuestions = Array.isArray(report?.resumeQuestions) ? report.resumeQuestions : [];
    return generatedQuestions.length
      ? normalizeQuestions(generatedQuestions, "resume")
      : buildResumeQuestions(report);
  }, [report]);
  const allQuestions = useMemo(
    () => [...technicalQuestions, ...behavioralQuestions, ...resumeQuestions],
    [behavioralQuestions, resumeQuestions, technicalQuestions]
  );
  const completedCount = allQuestions.filter((question) => questionState[question.key]?.completed).length;
  const completionPercentage = allQuestions.length
    ? Math.round((completedCount / allQuestions.length) * 100)
    : 0;

  const activeQuestions = useMemo(() => {
    const source =
      activeSection === "technical"
        ? technicalQuestions
        : activeSection === "behavioral"
          ? behavioralQuestions
          : activeSection === "resume"
            ? resumeQuestions
            : [];

    const searched = source.filter((question) => {
      const haystack = [
        question.question,
        question.answer,
        question.explanation,
        question.bestPractices.join(" "),
        question.followUps.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      const matchesDifficulty = difficulty === "all" || question.difficulty === difficulty;
      const state = questionState[question.key] || {};
      const matchesStatus =
        status === "all" ||
        (status === "completed" && state.completed) ||
        (status === "bookmarked" && state.bookmarked) ||
        (status === "open" && !state.completed);

      return matchesSearch && matchesDifficulty && matchesStatus;
    });

    return [...searched].sort((a, b) => {
      if (sort === "difficulty") return difficultyRank(b.difficulty) - difficultyRank(a.difficulty);
      if (sort === "frequency") return b.frequency - a.frequency;
      return a.index - b.index;
    });
  }, [activeSection, behavioralQuestions, difficulty, questionState, resumeQuestions, search, sort, status, technicalQuestions]);

  async function toggleQuestionState(question, patch) {
    if (!report?._id) return;
    const current = questionState[question.key] || {};
    const nextState = {
      ...questionState,
      [question.key]: {
        completed: patch.completed ?? Boolean(current.completed),
        bookmarked: patch.bookmarked ?? Boolean(current.bookmarked),
      },
    };

    setReport((currentReport) => ({
      ...currentReport,
      questionState: nextState,
    }));

    try {
      await updateQuestionState(report._id, {
        questionKey: question.key,
        ...nextState[question.key],
      });
    } catch {
      toast.error("Could not save question progress.");
      loadReport();
    }
  }

  async function copyAnswer(question) {
    const text = [
      question.question,
      "",
      "Expected Answer:",
      question.answer,
      "",
      "Detailed Explanation:",
      question.explanation,
      "",
      "Follow-up Questions:",
      ...question.followUps.map((item) => `- ${item}`),
    ].join("\n");

    await navigator.clipboard.writeText(text);
    toast.success("Answer copied.");
  }

  async function handleResumeDownload() {
    try {
      await downloadResumePdf(report._id);
      toast.success("Resume download started.");
    } catch {
      toast.error("Could not download the generated resume.");
    }
  }

  async function handleExport(format) {
    setIsExporting(true);

    try {
      const blob = await exportReport(report._id, format);
      downloadBlob(blob, `interview_strategy_${report._id}.${format === "markdown" ? "md" : "json"}`);
      toast.success(`${format === "markdown" ? "Markdown" : "JSON"} export ready.`);
    } catch {
      toast.error("Could not export this strategy.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleRegenerateResumeBuilder() {
    if (!report?._id) return;
    setIsRegeneratingResumeBuilder(true);

    try {
      const data = await regenerateResumeBuilder(report._id);
      setReport((currentReport) => data.interviewReport || {
        ...currentReport,
        resumeBuilder: data.resumeBuilder,
        atsResumeData: data.atsResumeData,
      });
      toast.success("Resume Builder regenerated.");
    } catch (err) {
      const message = err?.response?.data?.reason || err?.response?.data?.message || "Resume Builder regeneration failed. Please try again later.";
      toast.error(message);
    } finally {
      setIsRegeneratingResumeBuilder(false);
    }
  }

  function handleSectionChange(nextSection) {
    if (nextSection === "ats" && activeSection !== "ats") {
      setAtsReturnState({
        section: activeSection,
        scrollY: typeof window === "undefined" ? 0 : window.scrollY,
      });
    }

    setActiveSection(nextSection);

    if (nextSection === "ats" && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }
  }

  function handleBackFromAts() {
    const targetSection = atsReturnState.section && atsReturnState.section !== "ats"
      ? atsReturnState.section
      : "technical";

    setActiveSection(targetSection);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo(0, atsReturnState.scrollY || 0);
      });
    }
  }

  if (isLoading) {
    return (
      <div className="grid min-h-[65vh] place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 size-8 animate-spin text-fuchsia-300" />
          <p className="text-sm text-muted-foreground">Loading interview dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card/90 p-8 text-center">
        <p className="text-lg font-semibold text-white">{error || "Interview plan not found."}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Button variant="outline" onClick={loadReport}>
            <RotateCcw className="size-4" />
            Retry
          </Button>
          <Button onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isAtsSection = activeSection === "ats";

  if (isAtsSection) {
    return (
      <AtsResumeWorkspace
        report={report}
        onBack={handleBackFromAts}
        onRegenerateResumeBuilder={handleRegenerateResumeBuilder}
        isRegeneratingResumeBuilder={isRegeneratingResumeBuilder}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="mx-auto w-full max-w-[106rem] pb-8"
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card/92 shadow-2xl shadow-black/25">
        <div
          className="grid min-h-[calc(100vh-3rem)] lg:grid-cols-[19.5rem_minmax(0,1fr)_22rem]"
        >
          <WorkspaceNav
            activeSection={activeSection}
            setActiveSection={handleSectionChange}
            completedCount={completedCount}
            totalCount={allQuestions.length}
            completionPercentage={completionPercentage}
            isExporting={isExporting}
            onResumeDownload={handleResumeDownload}
            onExport={() => handleExport("markdown")}
          />

          <main className="min-w-0 border-y border-border p-5 lg:border-y-0 lg:border-l lg:p-7">
            <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="border-fuchsia-400/35 bg-fuchsia-500/12 text-fuchsia-200" variant="outline">
                    Personalized
                  </Badge>
                  <Badge variant="outline">{formatDate(report.createdAt)}</Badge>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  {sectionTitle(activeSection)}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {report.title || "Interview strategy"} generated from your role, profile, resume, and skill gaps.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {isQuestionSection(activeSection) ? (
                  <>
                  <FilterSelect label="Difficulty" value={difficulty} onChange={setDifficulty} options={["all", "beginner", "intermediate", "advanced"]} />
                  <FilterSelect label="Status" value={status} onChange={setStatus} options={["all", "open", "completed", "bookmarked"]} />
                  <FilterSelect label="Sort" value={sort} onChange={setSort} options={["default", "difficulty", "frequency"]} />
                  </>
                ) : null}
              </div>
            </div>

            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {isQuestionSection(activeSection) ? (
                <QuestionSection
                  questions={activeQuestions}
                  totalCount={
                    activeSection === "technical"
                      ? technicalQuestions.length
                      : activeSection === "behavioral"
                        ? behavioralQuestions.length
                        : resumeQuestions.length
                  }
                  search={search}
                  setSearch={setSearch}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  questionState={questionState}
                  toggleQuestionState={toggleQuestionState}
                  copyAnswer={copyAnswer}
                />
              ) : activeSection === "strategy" ? (
                <StrategySection report={report} />
              ) : activeSection === "roadmap" ? (
                <RoadmapSection days={report.preparationPlan || []} />
              ) : (
                null
              )}
            </motion.div>
          </main>

          <SummaryPanel report={report} completionPercentage={completionPercentage} />
        </div>
      </div>
    </motion.div>
  );
}

function WorkspaceNav({
  activeSection,
  setActiveSection,
  completedCount,
  totalCount,
  completionPercentage,
  isExporting,
  onResumeDownload,
  onExport,
}) {
  return (
    <aside className="flex flex-col gap-6 border-b border-border bg-surface-1/40 p-5 backdrop-blur-xl lg:border-b-0">
      <Link
        href="/dashboard"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-fuchsia-400/45 bg-fuchsia-500/15 px-4 text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/20 transition-colors hover:bg-fuchsia-500/25"
      >
        <ArrowLeft className="size-4" />
        Back to Dashboard
      </Link>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Sections
        </p>
        <nav className="space-y-2" aria-label="Interview workspace sections">
          {SECTIONS.map((item) => (
            <SectionButton
              key={item.key}
              item={item}
              active={activeSection === item.key}
              onClick={() => setActiveSection(item.key)}
            />
          ))}
        </nav>
      </div>

      <div className="rounded-xl border border-border bg-card/70 p-4 shadow-inner shadow-black/20">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Progress</p>
            <p className="mt-1 text-xs text-muted-foreground">Questions Completed</p>
          </div>
          <p className="text-xl font-bold text-fuchsia-200">{completionPercentage}%</p>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {completedCount} of {totalCount} questions complete
        </p>
      </div>

      <div className="mt-auto space-y-3">
        <Button
          type="button"
          className="h-12 w-full bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white shadow-lg shadow-fuchsia-950/30"
          onClick={onResumeDownload}
        >
          <Download className="size-4" />
          Download Resume
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled={isExporting}
          onClick={onExport}
        >
          <Clipboard className="size-4" />
          Export Strategy
        </Button>
      </div>
    </aside>
  );
}

function SectionButton({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-muted-foreground transition-all hover:bg-fuchsia-500/10 hover:text-white",
        active && "border border-fuchsia-400/45 bg-fuchsia-500/15 text-white shadow-sm shadow-fuchsia-950/20"
      )}
    >
      <item.icon className={cn("size-4", active ? "text-fuchsia-300" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </button>
  );
}

function AtsResumeWorkspace({ report, onBack, onRegenerateResumeBuilder, isRegeneratingResumeBuilder }) {
  const initialResumeData = useMemo(() => buildResumeSeedFromReport(report), [report]);
  const resumeBuilderUnavailable = report?.resumeBuilder?.status === "unavailable";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="mx-auto w-full max-w-none pb-8"
    >
      <div className="rounded-xl border border-border bg-card/92 shadow-2xl shadow-black/25">
        <main className="min-w-0 p-4 sm:p-5 lg:p-6">
          <div className="mb-5 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                className="-ml-2 mb-4 h-10 px-2 text-muted-foreground hover:text-white"
              >
                <ArrowLeft className="size-4" />
                Back to Interview
              </Button>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="border-fuchsia-400/35 bg-fuchsia-500/12 text-fuchsia-200" variant="outline">
                  Personalized
                </Badge>
                <Badge variant="outline">{formatDate(report.createdAt)}</Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Resume Builder
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Build and export the ATS-optimized resume using the existing Strategy Hub resume tools.
              </p>
            </div>
          </div>

          {resumeBuilderUnavailable ? (
            <div className="mb-5 flex flex-col gap-3 rounded-lg border border-amber-400/35 bg-amber-500/12 p-4 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Resume Builder is temporarily unavailable due to Gemini API quota and can be regenerated later.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={onRegenerateResumeBuilder}
                disabled={isRegeneratingResumeBuilder}
                className="shrink-0"
              >
                {isRegeneratingResumeBuilder ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Regenerate Resume Builder
              </Button>
            </div>
          ) : null}

          <ResumeBuilder
            initialData={initialResumeData}
            storageKey={`strategyhub.resumeDraft.report.${report?._id || "workspace"}`}
            workspaceMode
          />
        </main>
      </div>
    </motion.div>
  );
}

function buildResumeSeedFromReport(report) {
  if (hasMeaningfulAtsSeed(report?.atsResumeData)) {
    return prioritizeCurrentCandidateIdentity(report.atsResumeData, report);
  }

  if (hasMeaningfulAtsSeed(report?.resumeBuilder)) {
    return prioritizeCurrentCandidateIdentity(report.resumeBuilder, report);
  }

  const candidateSource = [report?.resume, report?.selfDescription].filter(Boolean).join("\n");
  const source = [candidateSource, report?.jobDescription, report?.title].filter(Boolean).join("\n");
  const skills = extractResumeSkills(source);
  const jobTitle = report?.jobTitle || report?.jobAnalysis?.jobTitle || report?.title || "Target Role Candidate";
  const candidateName = extractCandidateName(candidateSource) ||
    extractNamedValue(source, /(?:employee\s*name|candidate\s*name|name)\s*[:\-]\s*([A-Za-z .'-]{2,80})/i);
  const degree = extractNamedValue(source, /(b\.?\s?tech|bachelor(?:'s)?(?: of [a-z ]+)?|m\.?\s?tech|master(?:'s)?(?: of [a-z ]+)?|bca|mca|bsc|msc|engineering|computer science|information technology)/i);
  const certifications = extractCertifications(source);
  const keywords = uniqueStrings([
    jobTitle,
    ...skills,
    ...(report?.skillGaps || []).map((gap) => gap.skill),
    ...certifications,
  ]).slice(0, 22);

  return {
    template: "executive",
    accent: "violet",
    personalInfo: {
      name: candidateName,
      title: jobTitle,
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      github: "",
      portfolio: "",
    },
    summary: `${jobTitle} candidate with hands-on experience across ${skills.slice(0, 6).join(", ") || "role-relevant responsibilities"} and a focus on delivering reliable, measurable outcomes for the target role.`,
    technicalSkills: skills.join(", "),
    softSkills: "Communication, Ownership, Problem Solving, Collaboration, Adaptability",
    keywords: keywords.join(", "),
    workExperience: [
      {
        id: "generated-role-1",
        role: jobTitle,
        company: "",
        location: "",
        startDate: "",
        endDate: "",
        bullets: [
          `Delivered role-relevant work using ${skills.slice(0, 4).join(", ") || "the highest-priority job requirements"}.`,
          "Translated requirements into practical deliverables with clear documentation and maintainable implementation.",
          "Improved quality through review, feedback, validation, and iterative delivery.",
        ],
      },
    ],
    internships: [],
    freelance: [],
    projects: buildClientProjectSeeds(jobTitle, skills),
    education: degree
      ? [
          {
            id: "generated-education-1",
            school: "",
            degree: degree.toUpperCase(),
            location: "",
            year: "",
            details: "Editable education requirement suggested from the job description.",
          },
        ]
      : [],
    certifications: certifications.map((title, index) => ({
      id: `generated-certification-${index + 1}`,
      title,
      issuer: "",
      date: "",
    })),
    achievements: [
      `Prepared interview evidence around ${skills.slice(0, 3).join(", ") || jobTitle}.`,
      "Mapped experience to job requirements and ATS keywords.",
    ],
    extracurricular: [""],
    languages: "",
    interests: "",
    references: "",
  };
}

function prioritizeCurrentCandidateIdentity(seed = {}, report = {}) {
  const candidateSource = [report?.resume, report?.selfDescription].filter(Boolean).join("\n");
  const candidateName = extractCandidateName(candidateSource);
  if (!candidateName) return seed;

  return {
    ...seed,
    personalInfo: {
      ...(seed.personalInfo || {}),
      name: candidateName,
    },
  };
}

function hasMeaningfulAtsSeed(data = {}) {
  if (!data || typeof data !== "object") return false;
  const workExperience = Array.isArray(data.workExperience) ? data.workExperience : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];

  return Boolean(
    normalizeText(data.summary) ||
      compactList(data.technicalSkills).length ||
      compactList(data.skills).length ||
      compactList(data.keywords || data.atsKeywords).length ||
      normalizeText(data.personalInfo?.name || data.name) ||
      normalizeText(data.personalInfo?.title || data.headline || data.title) ||
      workExperience.some((item) => normalizeText(item?.role || item?.title) || compactList(item?.bullets).length) ||
      projects.some((item) => normalizeText(item?.name || item?.title) || compactList(item?.bullets).length)
  );
}

function extractResumeSkills(source = "") {
  const catalog = [
    "React", "Next.js", "Node.js", "Express.js", "TypeScript", "JavaScript", "MongoDB", "PostgreSQL",
    "SQL", "Tailwind CSS", "HTML", "CSS", "REST APIs", "Docker", "Git", "GitHub", "AWS", "Redis",
    "Authentication", "Testing", "Python", "Java", "Spring", "Django", "Figma", "Playwright", "GraphQL",
  ];
  const lower = source.toLowerCase();
  return uniqueStrings(catalog.filter((skill) => lower.includes(skill.toLowerCase()))).slice(0, 18);
}

function extractCertifications(source = "") {
  const matches = [
    ["AWS", /\baws\b|amazon web services/i],
    ["Azure", /\bazure\b|microsoft certified/i],
    ["Google Cloud", /\bgcp\b|google cloud/i],
    ["Scrum", /\bscrum\b|certified scrum|csm\b/i],
    ["PMP", /\bpmp\b|project management professional/i],
    ["ISTQB", /\bistqb\b/i],
  ];

  return matches.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
}

function extractCandidateName(source = "") {
  const explicit = extractNamedValue(source, /(?:employee\s*name|candidate\s*name|name)\s*[:\-]\s*([A-Za-z .'-]{2,80})/i);
  if (explicit) return explicit;

  return String(source || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) =>
      /^[A-Za-z][A-Za-z .'-]{2,80}$/.test(line) &&
      line.split(/\s+/).length >= 2 &&
      !/(resume|curriculum vitae|summary|profile|experience|education|skills|projects|certifications|contact|email|phone|linkedin|github)/i.test(line)
    ) || "";
}

function buildClientProjectSeeds(jobTitle, skills) {
  const stack = skills.slice(0, 5).join(", ");
  const projects = [
    {
      id: "generated-project-1",
      name: `${jobTitle} Portfolio Project`,
      stack,
      link: "",
      description: "Editable project suggestion aligned with the target job description.",
      bullets: [
        "Built a role-relevant project that demonstrates the required technical stack.",
        "Documented implementation decisions, tradeoffs, and measurable outcomes for interview discussion.",
      ],
    },
  ];

  if (/(react|next|node|express|mongo|typescript|javascript)/i.test(skills.join(" "))) {
    projects.push({
      id: "generated-project-2",
      name: "Full-Stack Feature Delivery Project",
      stack,
      link: "",
      description: "Editable project suggestion for frontend, backend, and API responsibilities.",
      bullets: [
        "Connected responsive UI flows with backend APIs and validation.",
        "Improved maintainability through reusable components and clear service boundaries.",
      ],
    });
  }

  return projects.slice(0, 3);
}

function extractNamedValue(source, pattern) {
  const match = source.match(pattern);
  return match?.[1]?.trim() || "";
}

function QuestionSection({
  questions,
  totalCount,
  search,
  setSearch,
  expanded,
  setExpanded,
  questionState,
  toggleQuestionState,
  copyAnswer,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Badge variant="outline">{totalCount} questions</Badge>
        <label className="relative block w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search questions, answers, tips..."
            className="h-10 w-full rounded-lg border border-border bg-surface-1 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-muted-foreground focus:border-fuchsia-400"
            aria-label="Search questions"
          />
        </label>
      </div>

      {questions.length ? (
        <div className="space-y-3">
          {questions.map((question) => {
            const state = questionState[question.key] || {};
            const isExpanded = Boolean(expanded[question.key]);

            return (
              <article key={question.key} className="rounded-xl border border-border bg-surface-1/90">
                <button
                  type="button"
                  className="flex w-full items-center gap-4 p-4 text-left"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpanded((current) => ({
                      ...current,
                      [question.key]: !current[question.key],
                    }))
                  }
                >
                  <span className="rounded-md border border-fuchsia-400/35 bg-fuchsia-500/15 px-2 py-1 text-xs font-bold text-fuchsia-200">
                    Q{question.index}
                  </span>
                  <span className="min-w-0 flex-1 text-base font-semibold leading-6 text-white">
                    {question.question}
                  </span>
                  <Badge className={difficultyClass[question.difficulty]} variant="outline">
                    {question.difficulty}
                  </Badge>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                </button>

                {isExpanded ? (
                  <div className="border-t border-border p-4">
                    <QuestionDetails question={question} />
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">Frequency: {question.frequency}%</Badge>
                        <Badge variant="outline">Practice: {state.completed ? "Completed" : "Open"}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={state.completed ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => toggleQuestionState(question, { completed: !state.completed })}
                        >
                          <Check className="size-4" />
                          {state.completed ? "Completed" : "Mark Complete"}
                        </Button>
                        <Button
                          type="button"
                          variant={state.bookmarked ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => toggleQuestionState(question, { bookmarked: !state.bookmarked })}
                        >
                          {state.bookmarked ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                          {state.bookmarked ? "Bookmarked" : "Bookmark"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => copyAnswer(question)}>
                          <Copy className="size-4" />
                          Copy Answer
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface-1 p-8 text-center">
          <Search className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="font-semibold text-white">No questions match these filters</p>
          <p className="mt-2 text-sm text-muted-foreground">Clear search or filters to see the full question set.</p>
        </div>
      )}
    </div>
  );
}

function StrategySection({ report }) {
  const priorityGroups = buildPriorityGroups(report);
  const cards = buildStrategyCards(report);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-4">
        {priorityGroups.map((group, groupIndex) => (
          <article key={listItemKey("priority-group", group.title, groupIndex)} className="rounded-xl border border-border bg-surface-1 p-5">
            <Badge className={group.className} variant="outline">{group.title}</Badge>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              {group.items.map((item, itemIndex) => (
                <li key={listItemKey(group.title, item, itemIndex)} className="flex gap-3">
                  <Star className="mt-1 size-4 shrink-0 text-fuchsia-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <ResumeMatchSection report={report} />

      <div className="grid gap-4 xl:grid-cols-2">
        {cards.map((card, cardIndex) => (
          <article key={listItemKey("strategy-card", card.title, cardIndex)} className="rounded-xl border border-border bg-surface-1 p-5">
            <h2 className="text-lg font-semibold text-white">{card.title}</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              {card.items.map((item, itemIndex) => (
                <li key={listItemKey(card.title, item, itemIndex)} className="flex gap-3">
                  <Star className="mt-1 size-4 shrink-0 text-fuchsia-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

function QuestionDetails({ question }) {
  if (question.kind === "behavioral") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <DetailBlock title="Why Interviewers Ask" content={question.whyInterviewerAsks} />
        <DetailBlock title="Answer Framework" content={question.framework} />
        <DetailBlock title="Suggested Duration" content={question.duration} />
        <ListBlock title="Skills Being Evaluated" items={question.skills} />
        <DetailBlock title="Situation" content={question.star.situation} />
        <DetailBlock title="Task" content={question.star.task} />
        <DetailBlock title="Action" content={question.star.action} />
        <DetailBlock title="Result" content={question.star.result} />
        <ListBlock title="Excellent Answer Checklist" items={question.excellentChecklist} tone="success" />
        <ListBlock title="Important Keywords" items={question.keywords} />
        <ListBlock title="Answer Quality Ladder" items={question.answerTiers} tone="success" />
        <ListBlock title="Recruiter Tip" items={question.tips} tone="success" />
        <ListBlock title="Follow-up Questions" items={question.followUps} />
        <ListBlock title="Common Mistakes" items={question.commonMistakes} tone="warning" />
        <ListBlock title="Red Flags" items={question.redFlags} tone="warning" />
      </div>
    );
  }

  if (question.kind === "resume") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <DetailBlock title="Why Interviewers Ask" content={question.whyInterviewerAsks} />
        <DetailBlock title="Answer Framework" content={question.framework} />
        <DetailBlock title="Expected Duration" content={question.duration} />
        <ListBlock title="Skills Being Evaluated" items={question.skills} />
        <DetailBlock title="Ideal Answer" content={question.answer} />
        <DetailBlock title="Deep Explanation" content={question.explanation} />
        <ListBlock title="Excellent Answer Checklist" items={question.excellentChecklist} tone="success" />
        <ListBlock title="Important Keywords" items={question.keywords} />
        <ListBlock title="Answer Quality Ladder" items={question.answerTiers} tone="success" />
        <ListBlock title="Possible Cross Questions" items={question.followUps} />
        <ListBlock title="How Interviewer Evaluates It" items={question.evaluation} tone="success" />
        <ListBlock title="Common Mistakes" items={question.commonMistakes} tone="warning" />
        <ListBlock title="Red Flags" items={question.redFlags} tone="warning" />
        <ListBlock title="Interview Tips" items={question.tips} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <DetailBlock title="Why Interviewers Ask" content={question.whyInterviewerAsks} />
      <DetailBlock title="Answer Framework" content={question.framework} />
      <DetailBlock title="Expected Duration" content={question.duration} />
      <ListBlock title="Skills Being Evaluated" items={question.skills} />
      <DetailBlock title="Expected Answer" content={question.answer} />
      <DetailBlock title="Detailed Explanation" content={question.explanation} />
      <ListBlock title="Excellent Answer Checklist" items={question.excellentChecklist} tone="success" />
      <ListBlock title="Important Keywords" items={question.keywords} />
      <ListBlock title="Answer Quality Ladder" items={question.answerTiers} tone="success" />
      <ListBlock title="Best Practices" items={question.bestPractices} />
      <ListBlock title="Common Mistakes" items={question.commonMistakes} tone="warning" />
      <ListBlock title="Red Flags" items={question.redFlags} tone="warning" />
      <ListBlock title="Follow-up Questions" items={question.followUps} />
      <ListBlock title="Real Interview Tips" items={question.tips} tone="success" />
    </div>
  );
}

function RoadmapSection({ days }) {
  return (
    <div className="space-y-8">
      {days.map((day, index) => (
        <RoadmapDay
          key={listItemKey("roadmap-day", `${day.day}-${day.focus}`, index)}
          day={day}
          index={index}
          totalDays={days.length}
        />
      ))}
    </div>
  );
}

function RoadmapDay({ day, index, totalDays }) {
  const details = roadmapDetails(day);
  const visibleTasks = roadmapVisibleTasks(day);

  return (
        <article
          className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4"
        >
          <div className="relative flex justify-center">
            {index < totalDays - 1 ? (
              <span
                data-roadmap-line
                className="absolute left-1/2 top-6 h-[calc(100%+2rem)] w-0.5 -translate-x-1/2 rounded-full bg-fuchsia-500"
              />
            ) : null}
            <span
              data-roadmap-marker
              className="relative z-10 mt-1 size-5 rounded-full border-2 border-fuchsia-400 bg-card shadow-[0_0_0_6px_rgba(24,13,38,0.95)]"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-200" variant="outline">
                Day {day.day}
              </Badge>
              <h2 className="text-lg font-semibold text-white">{day.focus}</h2>
            </div>
            {visibleTasks.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {visibleTasks.map((task, taskIndex) => (
                <li key={listItemKey(`day-${day.day}-task`, task, taskIndex)} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  {task}
                </li>
              ))}
              </ul>
            ) : null}
            {details.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {details.map((detail, detailIndex) => (
                  <DetailBlock key={listItemKey(`day-${day.day}-detail`, detail.title, detailIndex)} title={detail.title} content={detail.content} />
                ))}
              </div>
            ) : null}
          </div>
        </article>
  );
}

function SummaryPanel({ report, completionPercentage }) {
  const score = Number(report.matchScore || 0);
  const scoreLabel = score >= 82 ? "Strong Match" : score >= 65 ? "Moderate Match" : "Weak Match";

  return (
    <aside className="p-5 lg:border-l lg:border-border">
      <div className="sticky top-24 space-y-7">
        <section>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Match Score
          </p>
          <div className="mx-auto grid size-32 place-items-center rounded-full border-[0.55rem] border-emerald-500 text-center">
            <div>
              <p className="text-3xl font-bold text-white">{score}</p>
              <p className="-mt-1 text-xs text-muted-foreground">%</p>
            </div>
          </div>
          <p className="mt-4 text-center text-sm font-medium text-emerald-300">{scoreLabel} for this role</p>
          <div className="mt-5 rounded-lg border border-border bg-surface-1 p-3 text-sm text-muted-foreground">
            Completion: <span className="font-semibold text-white">{completionPercentage}%</span>
          </div>
        </section>

        <section className="border-t border-border pt-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Skill Gaps
          </p>
          <div className="space-y-3">
            {(report.skillGaps || []).map((gap, gapIndex) => {
              const insight = skillGapInsight(gap, report);

              return (
                <div
                  key={listItemKey("skill-gap", `${gap.skill}-${gap.severity}`, gapIndex)}
                  className="rounded-lg border border-border bg-surface-1 p-3"
                >
                  <Badge
                    variant="outline"
                    className={cn("h-auto w-full justify-start rounded-lg px-3 py-2 text-sm", gapClass(gap.severity))}
                  >
                    {gap.skill}
                  </Badge>
                  <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                    <p>{insight.reason}</p>
                    <p>Confidence: <span className="text-white">{insight.confidence}</span></p>
                    <p>Study time: <span className="text-white">{insight.studyTime}</span></p>
                    <p>Practice: <span className="text-white">{insight.practice}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
}

function DetailBlock({ title, content }) {
  const text = normalizeText(content);
  if (!text) return null;

  return (
    <section className="rounded-lg border border-border bg-card/60 p-4">
      <h3 className="mb-2 text-sm font-semibold text-white">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{text}</p>
    </section>
  );
}

function ListBlock({ title, items, tone = "default" }) {
  const normalizedItems = compactList(items);
  if (!normalizedItems.length) return null;

  const color =
    tone === "warning" ? "text-amber-300" : tone === "success" ? "text-emerald-300" : "text-fuchsia-300";

  return (
    <section className="rounded-lg border border-border bg-card/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
        {normalizedItems.map((item, index) => (
          <li key={listItemKey(title, item, index)} className="flex gap-2">
            <span className={cn("mt-2 size-1.5 shrink-0 rounded-full bg-current", color)} />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs text-muted-foreground">
      <span className="sr-only">{label}</span>
      <span aria-hidden>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-white outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-slate-950 text-white">
            {labelize(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function normalizeQuestionState(state) {
  if (!state) return {};
  return state;
}

function normalizeQuestions(questions, section) {
  return questions.map((question, index) => {
    const answer = question.answer || "Use a concise answer that connects your experience to the role requirements.";
    const intention = question.intention || question.whyInterviewerAsks || "";
    const explanation = question.explanation || question.detailedExplanation || intention;
    const bestPractices = compactList(question.bestPractices);
    const evaluation = compactList(question.evaluation);
    const commonMistakes = compactList(question.commonMistakes);
    const recruiterTips = compactList(question.recruiterTips || question.tips);
    const followUps = compactList(question.followUps);
    const star = question.star || {};
    const meta = parseCoachingMeta(explanation);
    const skills = uniqueStrings([
      ...compactList(question.relevantSkills || question.skillsBeingEvaluated),
      ...extractLabeledItems(evaluation, "Skills evaluated"),
    ]);
    const framework = meta.framework ||
      extractLabeledValue(bestPractices, "Framework") ||
      (section === "behavioral" ? "STAR: situation, task, action, result" : "Context, decision, tradeoff, measurable result");
    const duration = meta.duration ||
      extractLabeledValue(recruiterTips, "Duration") ||
      (section === "technical" ? "2-4 minutes" : "60-90 seconds");
    const keywords = uniqueStrings([
      ...meta.keywords,
      ...compactList(question.importantKeywords || question.keywords),
      ...skills,
    ]).slice(0, 8);
    const redFlags = uniqueStrings([
      ...extractLabeledItems(commonMistakes, "Red flag"),
      ...compactList(question.redFlags),
    ]);
    const answerTiers = compactList([
      extractLabeledValue(recruiterTips, "Ideal answer") || `Ideal: ${answer}`,
      extractLabeledValue(recruiterTips, "Good answer"),
      extractLabeledValue(recruiterTips, "Weak answer"),
    ]);
    const excellentChecklist = uniqueStrings([
      ...extractLabeledItems(bestPractices, "Excellent checklist"),
      ...compactList(question.excellentAnswerChecklist),
      ...bestPractices.filter((item) => !isLabeledItem(item, "Framework")),
    ]).slice(0, 6);

    return {
      key: `${section}-${index}-${slug(question.question)}`,
      kind: section,
      index: index + 1,
      question: question.question,
      answer,
      explanation: meta.summary || explanation,
      whyInterviewerAsks: question.whyInterviewerAsks || intention || "This reveals whether your experience maps to the role's real expectations.",
      framework,
      duration,
      skills,
      keywords,
      redFlags,
      answerTiers,
      excellentChecklist,
      bestPractices,
      commonMistakes,
      followUps,
      tips: recruiterTips.length ? recruiterTips : compactList([question.whyInterviewerAsks]),
      star: {
        situation: star.situation || "",
        task: star.task || "",
        action: star.action || answer,
        result: star.result || "",
      },
      evaluation,
      difficulty: question.difficulty || "intermediate",
      frequency: Math.max(62, 92 - index * 4),
    };
  });
}

function buildResumeQuestions(report) {
  const skills = uniqueStrings([
    ...(report?.technicalQuestions || []).flatMap((question) =>
      (question.question || "").match(/\b[A-Z][A-Za-z0-9.+#-]{1,}\b/g) || []
    ),
    ...(report?.skillGaps || []).map((gap) => gap.skill),
  ]).slice(0, 6);

  const source = skills.length ? skills : ["your strongest project", "authentication", "deployment", "architecture decisions"];

  return source.slice(0, 6).map((skill, index) => ({
    key: `resume-${index}-${slug(skill)}`,
    kind: "resume",
    index: index + 1,
    question:
      index === 0
        ? `Explain the project or experience that best proves your fit for ${report?.title || "this role"}.`
        : `Why did you choose ${skill}, and what tradeoffs did it create?`,
    answer:
      index === 0
        ? "Pick one project, explain the problem, your ownership, the technical decisions, and the measurable outcome. Tie the story back to the role requirements."
        : `Explain the problem ${skill} solved, the alternatives you considered, and the operational result after implementation.`,
    explanation:
      "Resume questions test whether the candidate can defend claimed experience with concrete decisions, constraints, and results.",
    whyInterviewerAsks:
      "Interviewers use this to verify that the resume claim is real, relevant, and backed by decisions you can explain.",
    bestPractices: [
      "Use the STAR structure for project stories.",
      "Mention exact responsibilities instead of saying the team built it.",
      "Prepare one short and one deep version of the same answer.",
    ],
    commonMistakes: [
      "Claiming ownership without explaining personal contribution.",
      "Over-indexing on buzzwords instead of design decisions.",
      "Forgetting to connect the project to the job description.",
    ],
    followUps: [
      "What was the hardest bug or production issue in this project?",
      "What would you redesign if you had another week?",
    ],
    tips: [
      "Bring the interviewer back to impact after technical details.",
      "Use simple diagrams verbally when explaining architecture.",
    ],
    evaluation: [
      "Clarity of ownership and whether the experience is genuinely yours.",
      "Ability to explain technical choices, tradeoffs, and outcomes.",
      "Relevance of the story to the target job description.",
    ],
    relevantSkills: [skill],
    difficulty: index % 3 === 2 ? "advanced" : "intermediate",
    frequency: Math.max(58, 88 - index * 5),
  }));
}

function ResumeMatchSection({ report }) {
  const match = buildResumeMatch(report);
  const blocks = [
    { title: "Matched Skills", items: match.matchedSkills, tone: "success" },
    { title: "Missing Skills", items: match.missingSkills, tone: "warning" },
    { title: "Weak Skills", items: match.weakSkills, tone: "warning" },
    { title: "Resume Strengths", items: match.resumeStrengths, tone: "success" },
    { title: "Resume Improvements", items: match.resumeImprovements },
  ].filter((block) => block.items.length);

  if (!blocks.length) return null;

  return (
    <section className="rounded-xl border border-border bg-surface-1 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FileText className="size-5 text-fuchsia-300" />
        <h2 className="text-lg font-semibold text-white">Resume vs Job Description</h2>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {blocks.map((block) => (
          <ListBlock key={block.title} title={block.title} items={block.items} tone={block.tone} />
        ))}
      </div>
    </section>
  );
}

function buildResumeMatch(report) {
  const ats = report?.atsAnalysis || {};
  const job = report?.jobAnalysis || {};
  const skillGaps = report?.skillGaps || [];

  return {
    matchedSkills: uniqueStrings([
      ...compactList(ats.matchedKeywords),
      ...compactList(job.requiredSkills).filter((skill) => !skillGaps.some((gap) => sameText(gap.skill, skill))),
    ]).slice(0, 12),
    missingSkills: uniqueStrings([
      ...compactList(ats.missingSkills),
      ...compactList(ats.missingKeywords),
      ...skillGaps.map((gap) => gap.skill),
    ]).slice(0, 12),
    weakSkills: uniqueStrings([
      ...compactList(ats.weakBullets),
      ...compactList(ats.skillsImprovements),
    ]).slice(0, 8),
    resumeStrengths: uniqueStrings([
      ...compactList(ats.matchedKeywords).map((skill) => `${skill} appears aligned with the job description.`),
      ...compactList(report?.resumeBuilder?.achievements),
    ]).slice(0, 8),
    resumeImprovements: uniqueStrings([
      ...compactList(ats.suggestedImprovements),
      ...compactList(ats.summarySuggestions),
      ...compactList(ats.projectImprovements),
      ...compactList(report?.resumeSuggestions),
    ]).slice(0, 10),
  };
}

function buildPriorityGroups(report) {
  const strategy = report?.strategy || {};
  const fallback = {
    priorityCritical: compactList(strategy.topicsToPrioritize || strategy.importantTopics).slice(0, 4),
    priorityHigh: compactList(strategy.highImpactConcepts || strategy.frequentlyAskedAreas).slice(0, 4),
    priorityMedium: compactList(strategy.skillsToStrengthen || strategy.preparationOrder).slice(0, 4),
    priorityLow: compactList(strategy.topicsSafeToSkip || strategy.freeLearningResources).slice(0, 4),
  };

  return [
    {
      title: "Critical",
      items: compactList(strategy.priorityCritical).length ? compactList(strategy.priorityCritical) : fallback.priorityCritical,
      className: "border-red-400/35 bg-red-500/12 text-red-200",
    },
    {
      title: "High",
      items: compactList(strategy.priorityHigh).length ? compactList(strategy.priorityHigh) : fallback.priorityHigh,
      className: "border-amber-400/35 bg-amber-500/12 text-amber-100",
    },
    {
      title: "Medium",
      items: compactList(strategy.priorityMedium).length ? compactList(strategy.priorityMedium) : fallback.priorityMedium,
      className: "border-fuchsia-400/35 bg-fuchsia-500/12 text-fuchsia-100",
    },
    {
      title: "Low",
      items: compactList(strategy.priorityLow).length ? compactList(strategy.priorityLow) : fallback.priorityLow,
      className: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
    },
  ].map((group) => ({
    ...group,
    items: group.items.length ? group.items : ["No priority items returned for this level."],
  }));
}

function buildStrategyCards(report) {
  const generatedStrategy = report?.strategy || {};
  const generatedCards = [
    { title: "High-Priority Topics", items: generatedStrategy.importantTopics },
    { title: "Topics to Prioritize", items: generatedStrategy.topicsToPrioritize },
    { title: "Topics Safe to Skip", items: generatedStrategy.topicsSafeToSkip },
    { title: "Frequently Asked Areas", items: generatedStrategy.frequentlyAskedAreas },
    { title: "Likely Interview Rounds", items: generatedStrategy.likelyInterviewRounds },
    { title: "Preparation Order", items: generatedStrategy.preparationOrder },
    { title: "Time Allocation", items: generatedStrategy.timeAllocation },
    { title: "Company Expectations", items: generatedStrategy.companyExpectations },
    { title: "High-Impact Concepts", items: generatedStrategy.highImpactConcepts },
    { title: "Most Probable Questions", items: generatedStrategy.mostProbableQuestions },
    { title: "Skills to Strengthen", items: generatedStrategy.skillsToStrengthen },
    { title: "Common Mistakes", items: generatedStrategy.commonMistakes },
    { title: "Common Rejection Reasons", items: generatedStrategy.commonRejectionReasons },
    { title: "Salary Negotiation Tips", items: generatedStrategy.salaryNegotiationTips },
    { title: "Interview Tips", items: generatedStrategy.interviewTips },
    { title: "Final Interview Tips", items: generatedStrategy.finalInterviewTips },
    { title: "Immediate Learning", items: generatedStrategy.roadmapImmediate },
    { title: "1 Week Roadmap", items: generatedStrategy.roadmapOneWeek },
    { title: "2 Week Roadmap", items: generatedStrategy.roadmapTwoWeeks },
    { title: "1 Month Roadmap", items: generatedStrategy.roadmapOneMonth },
    { title: "Advanced Roadmap", items: generatedStrategy.roadmapAdvanced },
    { title: "Interview Ready Checklist", items: generatedStrategy.interviewReadyChecklist },
    { title: "Free Learning Resources", items: generatedStrategy.freeLearningResources },
    { title: "Final Checklist", items: generatedStrategy.finalChecklist },
  ].filter((card) => compactList(card.items).length);

  if (generatedCards.length) {
    return generatedCards.map((card) => ({
      ...card,
      items: compactList(card.items),
    }));
  }

  const skills = (report.skillGaps || []).map((gap) => gap.skill).slice(0, 4);
  const technical = (report.technicalQuestions || []).slice(0, 4).map((item) => item.question);
  const behavioral = (report.behavioralQuestions || []).slice(0, 4).map((item) => item.question);

  return [
    {
      title: "Personalized Strategy",
      items: [
        `Open with a ${report.title || "target role"} pitch that connects your strongest project to the job description.`,
        "Prepare one deep technical walkthrough and one concise version of the same project.",
        "Use the job description as a checklist and attach proof for each major requirement.",
      ],
    },
    {
      title: "Technical Round Preparation",
      items: technical.length ? technical : ["Review system design, API design, authentication, caching, and testing tradeoffs."],
    },
    {
      title: "HR Round Preparation",
      items: behavioral.length
        ? behavioral
        : ["Tell me about yourself", "Why this company and role", "Availability and work preference", "Compensation expectations"],
    },
    {
      title: "Skill Gap Closing",
      items: skills.length
        ? skills.map((skill) => `Create a short explainer and one project example for ${skill}.`)
        : ["Identify the top missing skills and prepare ramp-up stories."],
    },
    {
      title: "Questions to Ask Interviewer",
      items: [
        "What are the first problems this role should solve in 90 days?",
        "How does the team evaluate technical quality and ownership?",
        "What does success look like for this position after six months?",
      ],
    },
    {
      title: "Salary and Offer Strategy",
      items: [
        "Anchor compensation around role scope, impact, and market expectations.",
        "Ask about total compensation, growth path, and review cadence.",
        "Avoid negotiating before understanding responsibilities and team expectations.",
      ],
    },
  ];
}

function roadmapDetails(day) {
  const tasks = compactList(day?.tasks);
  const labels = [
    "Goal",
    "Estimated study time",
    "Topics",
    "Practice questions",
    "Checkpoint",
    "Expected confidence",
  ];

  return labels
    .map((label) => ({
      title: label,
      content: extractLabeledValue(tasks, label),
    }))
    .filter((item) => item.content);
}

function roadmapVisibleTasks(day) {
  const tasks = compactList(day?.tasks);
  const structuredLabels = [
    "Goal",
    "Estimated study time",
    "Topics",
    "Practice questions",
    "Checkpoint",
    "Expected confidence",
  ];
  const visible = tasks.filter((task) => !structuredLabels.some((label) => isLabeledItem(task, label)));
  return visible.length ? visible : tasks.slice(0, 3);
}

function skillGapInsight(gap, report) {
  const severity = String(gap?.severity || "medium").toLowerCase();
  const requiredSkills = compactList(report?.jobAnalysis?.requiredSkills);
  const preferredSkills = compactList(report?.jobAnalysis?.preferredSkills);
  const isRequired = requiredSkills.some((skill) => sameText(skill, gap.skill));
  const isPreferred = preferredSkills.some((skill) => sameText(skill, gap.skill));
  const confidence = severity === "high" ? "High" : severity === "medium" ? "Medium" : "Low";
  const studyTime = severity === "high" ? "6-10 focused hours" : severity === "medium" ? "3-5 focused hours" : "1-2 focused hours";
  const source = isRequired ? "required skill" : isPreferred ? "preferred skill" : "job/resume alignment signal";

  return {
    reason: `${gap.skill} appears as a ${source} that needs stronger evidence in the interview story.`,
    confidence,
    studyTime,
    practice: `Prepare one concise explanation and one project example involving ${gap.skill}.`,
  };
}

function parseCoachingMeta(value = "") {
  const parts = String(value || "").split("|").map((part) => part.trim()).filter(Boolean);
  const summary = parts.filter((part) => !/^(framework|duration|keywords)\s*:/i.test(part)).join(" | ");
  const framework = extractLabeledValue(parts, "Framework");
  const duration = extractLabeledValue(parts, "Duration");
  const keywords = compactList(extractLabeledValue(parts, "Keywords"));

  return {
    summary,
    framework,
    duration,
    keywords,
  };
}

function extractLabeledValue(items, label) {
  const match = compactList(items).find((item) => isLabeledItem(item, label));
  if (!match) return "";
  return match.replace(new RegExp(`^${escapeRegExp(label)}\\s*:\\s*`, "i"), "").trim();
}

function extractLabeledItems(items, label) {
  return compactList(items)
    .filter((item) => isLabeledItem(item, label))
    .flatMap((item) => compactList(item.replace(new RegExp(`^${escapeRegExp(label)}\\s*:\\s*`, "i"), "")));
}

function isLabeledItem(item, label) {
  return new RegExp(`^${escapeRegExp(label)}\\s*:`, "i").test(String(item || "").trim());
}

function sameText(a, b) {
  return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();
}

function sectionTitle(section) {
  if (section === "technical") return "Technical Questions";
  if (section === "behavioral") return "Behavioral Questions";
  if (section === "resume") return "Resume-Based Questions";
  if (section === "strategy") return "Interview Strategy";
  if (section === "ats") return "ATS Resume";
  return "Road Map";
}

function isQuestionSection(section) {
  return ["technical", "behavioral", "resume"].includes(section);
}

function difficultyRank(value) {
  return { beginner: 1, intermediate: 2, advanced: 3 }[value] || 0;
}

function labelize(value) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function gapClass(severity) {
  if (severity === "high") return "border-red-400/35 bg-red-500/12 text-red-200";
  if (severity === "medium") return "border-amber-400/35 bg-amber-500/12 text-amber-100";
  return "border-emerald-400/35 bg-emerald-500/12 text-emerald-200";
}

function slug(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function listItemKey(prefix, value, index) {
  return `${slug(prefix) || "item"}-${index}-${slug(value) || "value"}`;
}

function uniqueStrings(values) {
  return [...new Set(compactList(values))];
}

function compactList(values = []) {
  const source = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? values.split(/[\n,;]+/)
      : values == null
        ? []
        : [values];

  return source.flatMap((value) => {
    if (Array.isArray(value)) return compactList(value);
    const text = normalizeText(value);
    return text ? [text] : [];
  });
}

function normalizeText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (Array.isArray(value)) return compactList(value).join(", ");
  if (typeof value === "object") {
    for (const key of ["text", "value", "label", "name", "title", "skill", "keyword", "summary", "description", "role", "reason"]) {
      const text = normalizeText(value[key]);
      if (text) return text;
    }
  }

  return "";
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDate(value) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(new Blob([blob]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
