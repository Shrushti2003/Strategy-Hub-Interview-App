"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Briefcase,
  Camera,
  Download,
  FileText,
  Languages,
  LayoutTemplate,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { downloadResumeBuilderPdf } from "@/lib/api";
import ResumePreview from "./resume-preview";

const STORAGE_KEY = "strategyhub.resumeDraft.v2";

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const blankRole = () => ({
  id: createId(),
  role: "",
  company: "",
  location: "",
  startDate: "",
  endDate: "",
  bullets: [""],
});

const blankProject = () => ({
  id: createId(),
  name: "",
  stack: "",
  link: "",
  description: "",
  bullets: [""],
});

const blankEducation = () => ({
  id: createId(),
  school: "",
  degree: "",
  location: "",
  year: "",
  details: "",
});

const blankSimple = () => ({ id: createId(), title: "", issuer: "", date: "" });

const createDefaultData = () => ({
  template: "executive",
  accent: "slate",
  personalInfo: {
    name: "",
    title: "",
    photo: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    portfolio: "",
  },
  summary: "",
  technicalSkills: "",
  softSkills: "",
  workExperience: [blankRole()],
  internships: [],
  freelance: [],
  projects: [],
  education: [blankEducation()],
  certifications: [],
  keywords: "",
  achievements: [""],
  extracurricular: [""],
  languages: "",
  interests: "",
  references: "",
});

const templates = [
  { id: "executive", label: "Executive", description: "Classic ATS hierarchy" },
  { id: "compact", label: "Compact", description: "Dense one-page layout" },
  { id: "modern", label: "Modern", description: "Subtle accent headers" },
];

const accents = [
  { id: "slate", label: "Slate" },
  { id: "violet", label: "Violet" },
  { id: "cyan", label: "Cyan" },
];

const TEXT_FIELD_KEYS = [
  "text",
  "value",
  "label",
  "name",
  "title",
  "skill",
  "keyword",
  "technology",
  "tool",
  "summary",
  "description",
  "degree",
  "school",
  "company",
  "role",
  "issuer",
  "url",
  "link",
];

export default function ResumeBuilder({ initialData = null, storageKey = STORAGE_KEY, workspaceMode = false }) {
  const seededData = useMemo(
    () => normalizeDraft({ ...createDefaultData(), ...(initialData || {}) }),
    [initialData]
  );
  const hasInitialSeed = useMemo(() => hasMeaningfulResumeContent(initialData || {}), [initialData]);
  const [data, setData] = useState(() => {
    const defaults = normalizeDraft({ ...createDefaultData(), ...(initialData || {}) });
    if (hasInitialSeed || typeof window === "undefined") return defaults;

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return defaults;

      const savedDraft = normalizeDraft({ ...defaults, ...JSON.parse(saved) });
      return hasMeaningfulResumeContent(savedDraft) ? savedDraft : defaults;
    } catch {
      return defaults;
    }
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isTailoring, setIsTailoring] = useState(false);
  const fileInputRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [manualPageCount, setManualPageCount] = useState(0);

  const atsScore = useMemo(() => calculateScore(data), [data]);
  const resumeInsights = useMemo(
    () => buildResumeInsights(data, atsScore, lastSavedAt),
    [atsScore, data, lastSavedAt]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    if (hasInitialSeed) {
      const frameId = window.requestAnimationFrame(() => {
        setData(seededData);
        setLastSavedAt(null);
        setManualPageCount(0);
        setStatus({ type: "", message: "" });
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved && hasMeaningfulResumeContent(normalizeDraft(JSON.parse(saved)))) {
        return undefined;
      }
    } catch {
      // Malformed or stale drafts should not block the latest AI-generated seed.
    }

    const frameId = window.requestAnimationFrame(() => {
      setData(seededData);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [hasInitialSeed, seededData, storageKey]);

  function update(path, value) {
    setData((current) => {
      const next = cloneDraft(current);
      let target = next;
      for (let index = 0; index < path.length - 1; index += 1) {
        target = target[path[index]];
      }
      target[path[path.length - 1]] = value;
      return next;
    });
    setStatus({ type: "", message: "" });
  }

  function saveDraft() {
    window.localStorage.setItem(storageKey, JSON.stringify(data));
    setLastSavedAt(new Date());
    setStatus({ type: "success", message: "Resume draft saved locally." });
  }

  function clearDraft() {
    window.localStorage.removeItem(storageKey);
    setData(seededData);
    setLastSavedAt(null);
    setManualPageCount(0);
    setStatus({ type: "success", message: "Draft cleared. You can start fresh." });
  }

  async function downloadResume() {
    const resumeNode = document.getElementById("resume-print-area");
    if (!resumeNode) {
      setStatus({ type: "error", message: "Resume preview is still loading. Try again in a moment." });
      return;
    }

    saveDraft();
    const candidateName = normalizeString(data.personalInfo.name) || "resume";
    const fileName = `${toProfessionalFileName(candidateName)}-Resume.pdf`;

    setIsDownloading(true);
    setStatus({
      type: "success",
      message: "Preparing your PDF download...",
    });

    try {
      const blob = await downloadResumeBuilderPdf({
        resumeHtml: serializeResumeForPdf(resumeNode),
        fileName,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setStatus({ type: "success", message: "Resume PDF downloaded successfully." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.response?.data?.message || "Unable to download resume PDF right now.",
      });
    } finally {
      setIsDownloading(false);
    }
  }

  function autoTailor() {
    setIsTailoring(true);
    window.setTimeout(() => {
      setData((current) => normalizeDraft(mergeDraftWithSuggestions(current, seededData)));
      setIsTailoring(false);
      setStatus({ type: "success", message: "AI suggestions filled empty resume fields." });
    }, 800);
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", message: "Choose a valid image file." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => update(["personalInfo", "photo"], reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div
      className={cn(
        "grid gap-6",
        workspaceMode
          ? "xl:grid-cols-[minmax(34rem,0.49fr)_minmax(38rem,0.51fr)]"
          : "xl:grid-cols-[minmax(34rem,0.96fr)_minmax(36rem,1.04fr)] 2xl:grid-cols-[minmax(38rem,0.98fr)_minmax(42rem,1.02fr)]"
      )}
    >
      <section className="min-w-0 space-y-5">
        <div className="-mx-1 rounded-lg border border-border bg-background/90 p-3 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border bg-surface-1">
                  ATS resume builder
                </Badge>
                <Badge variant="secondary">{atsScore}% complete</Badge>
              </div>
              <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
                Resume Builder
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Build a complete, printable, ATS-friendly resume with live preview.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={clearDraft}>
                <RotateCcw className="size-4" />
                Reset
              </Button>
              <Button type="button" variant="outline" onClick={saveDraft}>
                <Save className="size-4" />
                Save
              </Button>
              <Button
                type="button"
                onClick={downloadResume}
                disabled={isDownloading}
                className="bg-[#7C3AED] shadow-[0_0_24px_rgba(124,58,237,0.28)] transition-all duration-200 hover:bg-[#8B5CF6] hover:shadow-[0_0_32px_rgba(236,72,153,0.28)]"
              >
                {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {isDownloading ? "Downloading" : "Download Resume"}
              </Button>
              <Button type="button" onClick={autoTailor} disabled={isTailoring}>
                {isTailoring ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                Auto tailor
              </Button>
            </div>
          </div>

          {status.message ? (
            <div
              className={cn(
                "mt-3 rounded-lg border px-3 py-2 text-sm",
                status.type === "error"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-success/30 bg-success/10 text-success"
              )}
            >
              {status.message}
            </div>
          ) : null}
        </div>

        <ScoreCard score={atsScore} data={data} />

        <EditorCard title="Template and theme" icon={LayoutTemplate}>
          <div className="grid gap-3 md:grid-cols-3">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => update(["template"], template.id)}
                className={cn(
                  "rounded-lg border border-border bg-surface-1 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40",
                  data.template === template.id && "border-primary bg-primary/10"
                )}
              >
                <p className="text-sm font-medium">{template.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {template.description}
                </p>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {accents.map((accent) => (
              <Button
                key={accent.id}
                type="button"
                variant={data.accent === accent.id ? "default" : "outline"}
                onClick={() => update(["accent"], accent.id)}
              >
                {accent.label}
              </Button>
            ))}
          </div>
        </EditorCard>

        <EditorCard title="Personal information" icon={FileText}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Full name" value={data.personalInfo.name} onChange={(value) => update(["personalInfo", "name"], value)} />
            <TextInput label="Professional title" value={data.personalInfo.title} onChange={(value) => update(["personalInfo", "title"], value)} />
            <TextInput label="Email" type="email" value={data.personalInfo.email} onChange={(value) => update(["personalInfo", "email"], value)} />
            <TextInput label="Phone number" value={data.personalInfo.phone} onChange={(value) => update(["personalInfo", "phone"], value)} />
            <TextInput label="Address / location" value={data.personalInfo.location} onChange={(value) => update(["personalInfo", "location"], value)} />
            <TextInput label="LinkedIn" value={data.personalInfo.linkedin} onChange={(value) => update(["personalInfo", "linkedin"], value)} />
            <TextInput label="GitHub" value={data.personalInfo.github} onChange={(value) => update(["personalInfo", "github"], value)} />
            <TextInput label="Portfolio website" value={data.personalInfo.portfolio} onChange={(value) => update(["personalInfo", "portfolio"], value)} />
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-background">
                <Camera className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Profile photo</p>
                <p className="text-sm text-muted-foreground">
                  Optional. Empty photos are hidden from the resume.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                Upload
              </Button>
              <Button type="button" variant="ghost" onClick={() => update(["personalInfo", "photo"], "")}>
                Remove
              </Button>
            </div>
          </div>
        </EditorCard>

        <EditorCard title="Professional summary" icon={Sparkles}>
          <Textarea
            value={data.summary}
            onChange={(event) => update(["summary"], event.target.value)}
            className="min-h-28"
            placeholder="Write 3-4 lines summarizing your role, strengths, domain experience, and measurable impact."
          />
        </EditorCard>

        <EditorCard title="Skills" icon={BadgeCheck}>
          <div className="grid gap-4 md:grid-cols-2">
            <Textarea
              value={data.technicalSkills}
              onChange={(event) => update(["technicalSkills"], event.target.value)}
              className="min-h-24"
              placeholder="Technical skills, separated by commas"
            />
            <Textarea
              value={data.softSkills}
              onChange={(event) => update(["softSkills"], event.target.value)}
              className="min-h-24"
              placeholder="Soft skills, separated by commas"
            />
            <Textarea
              value={data.keywords}
              onChange={(event) => update(["keywords"], event.target.value)}
              className="min-h-24 md:col-span-2"
              placeholder="ATS keywords extracted from the job description"
            />
          </div>
        </EditorCard>

        <RoleSection title="Work experience" items={data.workExperience} onChange={(items) => update(["workExperience"], items)} />
        <RoleSection title="Internships" items={data.internships} onChange={(items) => update(["internships"], items)} />
        <RoleSection title="Freelance experience" items={data.freelance} onChange={(items) => update(["freelance"], items)} />
        <ProjectSection items={data.projects} onChange={(items) => update(["projects"], items)} />
        <EducationSection items={data.education} onChange={(items) => update(["education"], items)} />
        <SimpleSection title="Certifications" items={data.certifications} onChange={(items) => update(["certifications"], items)} />
        <ListSection title="Achievements" items={data.achievements} onChange={(items) => update(["achievements"], items)} />
        <ListSection title="Extracurricular activities" items={data.extracurricular} onChange={(items) => update(["extracurricular"], items)} />

        <EditorCard title="Additional sections" icon={Languages}>
          <div className="grid gap-4 md:grid-cols-2">
            <Textarea value={data.languages} onChange={(event) => update(["languages"], event.target.value)} placeholder="Languages, separated by commas" />
            <Textarea value={data.interests} onChange={(event) => update(["interests"], event.target.value)} placeholder="Interests / hobbies, optional" />
            <Textarea className="md:col-span-2" value={data.references} onChange={(event) => update(["references"], event.target.value)} placeholder="References, optional" />
          </div>
        </EditorCard>

        {workspaceMode ? <ResumeInsightsPanel insights={resumeInsights} /> : null}
      </section>

      <aside className={cn("min-w-0", workspaceMode && "xl:sticky xl:top-4 xl:self-start")}>
        <Card className="overflow-visible rounded-lg bg-card/90">
          <CardHeader className="shrink-0 gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Live preview</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Empty sections hide automatically.
              </p>
            </div>
            <Button
              type="button"
              onClick={downloadResume}
              disabled={isDownloading}
              className="h-10 bg-[#7C3AED] px-4 shadow-[0_0_24px_rgba(124,58,237,0.28)] transition-all duration-200 hover:bg-[#8B5CF6] hover:shadow-[0_0_32px_rgba(236,72,153,0.28)]"
            >
              {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {isDownloading ? "Downloading" : "Download Resume"}
            </Button>
          </CardHeader>
          <CardContent className="overflow-visible rounded-none border-t border-border bg-[#0B0F14] p-5 sm:p-8">
            <style>{`
              @media print {
                html,
                body {
                  width: 210mm !important;
                  min-height: 297mm !important;
                  margin: 0 !important;
                  overflow: visible !important;
                  background: #ffffff !important;
                }
                body * { visibility: hidden !important; }
                #resume-print-area, #resume-print-area * { visibility: visible !important; }
                #resume-print-area {
                  position: absolute !important;
                  inset: 0 auto auto 0 !important;
                  width: 210mm !important;
                  min-height: 297mm !important;
                  height: auto !important;
                  margin: 0 !important;
                  box-shadow: none !important;
                  transform: none !important;
                  overflow: visible !important;
                }
                @page { size: A4; margin: 0; }
              }
            `}</style>
            <ResumePreview
              data={data}
              livePreview
              manualPageCount={manualPageCount}
              onAddPage={() => setManualPageCount((count) => count + 1)}
            />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function EditorCard({ title, icon: Icon, children }) {
  return (
    <Card className="rounded-lg bg-card/90 transition-transform duration-200 hover:-translate-y-0.5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function TextInput({ label, value, onChange, type = "text" }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10"
      />
    </label>
  );
}

function RoleSection({ title, items, onChange }) {
  return (
    <EditorCard title={title} icon={Briefcase}>
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => onChange([...items, blankRole()])}>
          <Plus className="size-4" />
          Add role
        </Button>
      </div>
      {items.length ? (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-lg border border-border bg-surface-1 p-4">
              <EntryHeader title={`Role ${index + 1}`} onDelete={() => onChange(items.filter((entry) => entry.id !== item.id))} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Role" value={item.role} onChange={(value) => patchItem(items, onChange, index, "role", value)} />
                <TextInput label="Company" value={item.company} onChange={(value) => patchItem(items, onChange, index, "company", value)} />
                <TextInput label="Location" value={item.location} onChange={(value) => patchItem(items, onChange, index, "location", value)} />
                <TextInput label="Start date" value={item.startDate} onChange={(value) => patchItem(items, onChange, index, "startDate", value)} />
                <TextInput label="End date" value={item.endDate} onChange={(value) => patchItem(items, onChange, index, "endDate", value)} />
              </div>
              <BulletEditor
                bullets={item.bullets}
                onChange={(bullets) => patchItem(items, onChange, index, "bullets", bullets)}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyEditorState label={`No ${title.toLowerCase()} added yet.`} />
      )}
    </EditorCard>
  );
}

function ProjectSection({ items, onChange }) {
  return (
    <EditorCard title="Projects" icon={FileText}>
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => onChange([...items, blankProject()])}>
          <Plus className="size-4" />
          Add project
        </Button>
      </div>
      {items.length ? (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-lg border border-border bg-surface-1 p-4">
              <EntryHeader title={`Project ${index + 1}`} onDelete={() => onChange(items.filter((entry) => entry.id !== item.id))} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Project name" value={item.name} onChange={(value) => patchItem(items, onChange, index, "name", value)} />
                <TextInput label="Tech stack" value={item.stack} onChange={(value) => patchItem(items, onChange, index, "stack", value)} />
                <TextInput label="Link" value={item.link} onChange={(value) => patchItem(items, onChange, index, "link", value)} />
                <TextInput label="Short description" value={item.description} onChange={(value) => patchItem(items, onChange, index, "description", value)} />
              </div>
              <BulletEditor bullets={item.bullets} onChange={(bullets) => patchItem(items, onChange, index, "bullets", bullets)} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyEditorState label="No projects added yet." />
      )}
    </EditorCard>
  );
}

function EducationSection({ items, onChange }) {
  return (
    <EditorCard title="Education" icon={FileText}>
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => onChange([...items, blankEducation()])}>
          <Plus className="size-4" />
          Add education
        </Button>
      </div>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border border-border bg-surface-1 p-4">
            <EntryHeader title={`Education ${index + 1}`} onDelete={() => onChange(items.filter((entry) => entry.id !== item.id))} />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="School" value={item.school} onChange={(value) => patchItem(items, onChange, index, "school", value)} />
              <TextInput label="Degree" value={item.degree} onChange={(value) => patchItem(items, onChange, index, "degree", value)} />
              <TextInput label="Location" value={item.location} onChange={(value) => patchItem(items, onChange, index, "location", value)} />
              <TextInput label="Year" value={item.year} onChange={(value) => patchItem(items, onChange, index, "year", value)} />
            </div>
            <Textarea
              value={item.details}
              onChange={(event) => patchItem(items, onChange, index, "details", event.target.value)}
              placeholder="Relevant coursework, honors, GPA, or thesis"
            />
          </div>
        ))}
      </div>
    </EditorCard>
  );
}

function SimpleSection({ title, items, onChange }) {
  return (
    <EditorCard title={title} icon={BadgeCheck}>
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => onChange([...items, blankSimple()])}>
          <Plus className="size-4" />
          Add item
        </Button>
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-lg border border-border bg-surface-1 p-4">
              <EntryHeader title={`${title} ${index + 1}`} onDelete={() => onChange(items.filter((entry) => entry.id !== item.id))} />
              <div className="grid gap-4 md:grid-cols-3">
                <TextInput label="Title" value={item.title} onChange={(value) => patchItem(items, onChange, index, "title", value)} />
                <TextInput label="Issuer" value={item.issuer} onChange={(value) => patchItem(items, onChange, index, "issuer", value)} />
                <TextInput label="Date" value={item.date} onChange={(value) => patchItem(items, onChange, index, "date", value)} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyEditorState label={`No ${title.toLowerCase()} added yet.`} />
      )}
    </EditorCard>
  );
}

function ListSection({ title, items, onChange }) {
  return (
    <EditorCard title={title} icon={BadgeCheck}>
      <BulletEditor bullets={items} onChange={onChange} />
    </EditorCard>
  );
}

function BulletEditor({ bullets, onChange }) {
  const safeBullets = normalizeEditableList(bullets);
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Bullets</p>
        <Button type="button" variant="ghost" onClick={() => onChange([...safeBullets, ""])}>
          <Plus className="size-4" />
          Add bullet
        </Button>
      </div>
      {safeBullets.map((bullet, index) => (
        <div key={index} className="flex gap-2">
          <Textarea
            value={bullet}
            onChange={(event) =>
              onChange(safeBullets.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
            }
            className="min-h-16"
            placeholder="Start with an action verb and include measurable impact where possible."
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(safeBullets.filter((_, itemIndex) => itemIndex !== index))}
            aria-label="Delete bullet"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function EntryHeader({ title, onDelete }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <p className="text-sm font-semibold">{title}</p>
      <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label={`Delete ${title}`}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function EmptyEditorState({ label }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-1 p-5 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function ScoreCard({ score, data }) {
  const draft = normalizeDraft(data);
  const checks = [
    { label: "Contact details", done: Boolean(draft.personalInfo.email && draft.personalInfo.phone) },
    { label: "Summary", done: Boolean(normalizeString(draft.summary)) },
    { label: "Experience bullets", done: draft.workExperience.some((item) => compactList(item.bullets).length) },
    { label: "Skills", done: Boolean(normalizeString(draft.technicalSkills)) },
    { label: "Education", done: draft.education.some((item) => item.school || item.degree) },
  ];

  return (
    <Card className="rounded-lg bg-card/90">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">ATS readiness</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete high-signal sections and measurable bullets.
            </p>
          </div>
          <div className="text-3xl font-semibold text-primary">{score}%</div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${score}%` }} />
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-5">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("size-2 rounded-full", check.done ? "bg-success" : "bg-warning")} />
              {check.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ResumeInsightsPanel({ insights }) {
  return (
    <Card className="rounded-lg bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" />
          Resume Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <InsightStat label="ATS Score" value={`${insights.atsScore}%`} />
          <InsightStat label="Word Count" value={insights.wordCount} />
          <InsightStat label="Length" value={insights.estimatedLength} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <InsightList title="Missing Sections" items={insights.missingSections} emptyText="Core sections are covered." />
          <InsightList title="Resume Strengths" items={insights.strengths} emptyText="Add more resume detail to surface strengths." />
          <InsightList title="Improvement Suggestions" items={insights.suggestions} emptyText="No urgent suggestions." />
          <div className="rounded-lg border border-border bg-surface-1 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Last Saved</p>
            <p className="mt-2 text-sm font-medium text-white">{insights.lastSaved}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightStat({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function InsightList({ title, items, emptyText }) {
  const visible = items.length ? items : [emptyText];

  return (
    <div className="rounded-lg border border-border bg-surface-1 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-5 text-muted-foreground">
        {visible.map((item, index) => (
          <li key={`insight-${index}-${toProfessionalFileName(item)}`} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function patchItem(items, onChange, index, key, value) {
  onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
}

function compactList(list) {
  return normalizeList(list);
}

function toProfessionalFileName(name) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.replace(/[^a-z0-9]/gi, ""))
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join("-") || "Resume"
  );
}

function serializeResumeForPdf(node) {
  const clone = node.cloneNode(true);
  inlineComputedStyles(node, clone);
  return clone.outerHTML;
}

function inlineComputedStyles(source, target) {
  if (source.nodeType !== Node.ELEMENT_NODE || target.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const computedStyle = window.getComputedStyle(source);
  const styleText = Array.from(computedStyle)
    .map((property) => `${property}:${computedStyle.getPropertyValue(property)};`)
    .join("");

  target.setAttribute("style", styleText);
  target.removeAttribute("class");

  Array.from(source.children).forEach((child, index) => {
    inlineComputedStyles(child, target.children[index]);
  });
}

function cloneDraft(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (Array.isArray(value)) return normalizeList(value).join(", ");

  if (typeof value === "object") {
    for (const key of TEXT_FIELD_KEYS) {
      const normalized = normalizeString(value[key]);
      if (normalized) return normalized;
    }

    return normalizeList(Object.values(value)).join(", ");
  }

  return "";
}

function normalizeList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,;]+/)
      : value == null
        ? []
        : [value];

  return source.flatMap((item) => {
    if (Array.isArray(item)) return normalizeList(item);
    if (item && typeof item === "object") {
      const direct = normalizeString(item);
      return direct ? [direct] : [];
    }

    const text = normalizeString(item);
    return text ? [text] : [];
  });
}

function normalizeEditableList(value) {
  if (Array.isArray(value)) {
    const items = value.map((item) => normalizeString(item));
    return items.length ? items : [""];
  }

  const items = normalizeList(value);
  return items.length ? items : [""];
}

function normalizeRecord(value = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeEntryItems(items) {
  if (Array.isArray(items)) return items;
  return items && typeof items === "object" ? [items] : [];
}

function normalizeRole(item = {}) {
  const source = normalizeRecord(item);
  return {
    role: normalizeString(source.role || source.title || source.position),
    company: normalizeString(source.company || source.organization || source.employer),
    location: normalizeString(source.location),
    startDate: normalizeString(source.startDate || source.start || source.from),
    endDate: normalizeString(source.endDate || source.end || source.to),
    bullets: normalizeList(source.bullets || source.responsibilities || source.achievements || source.description),
  };
}

function normalizeProject(item = {}) {
  const source = normalizeRecord(item);
  return {
    name: normalizeString(source.name || source.title),
    stack: normalizeString(source.stack || source.technologies || source.tools),
    link: normalizeString(source.link || source.url),
    description: normalizeString(source.description || source.summary),
    bullets: normalizeList(source.bullets || source.highlights || source.achievements),
  };
}

function normalizeEducation(item = {}) {
  const source = normalizeRecord(item);
  return {
    school: normalizeString(source.school || source.institution || source.university),
    degree: normalizeString(source.degree || source.qualification),
    location: normalizeString(source.location),
    year: normalizeString(source.year || source.endDate || source.graduationYear),
    details: normalizeString(source.details || source.description || source.coursework),
  };
}

function normalizeSimple(item = {}) {
  const source = normalizeRecord(item);
  return {
    title: normalizeString(source.title || source.name),
    issuer: normalizeString(source.issuer || source.organization),
    date: normalizeString(source.date || source.year),
  };
}

function hasMeaningfulResumeContent(draft = {}) {
  const normalized = normalizeDraft(draft);
  const personalInfo = normalized.personalInfo || {};
  return Boolean(
    personalInfo.name ||
      personalInfo.title ||
      personalInfo.email ||
      personalInfo.phone ||
      personalInfo.location ||
      normalized.summary ||
      normalized.technicalSkills ||
      normalized.softSkills ||
      normalized.keywords ||
      normalized.workExperience.some((item) => item.role || item.company || compactList(item.bullets).length) ||
      normalized.projects.some((item) => item.name || item.stack || item.description || compactList(item.bullets).length) ||
      normalized.education.some((item) => item.school || item.degree || item.details) ||
      normalized.certifications.some((item) => item.title || item.issuer) ||
      compactList(normalized.achievements).length
  );
}

function mergeDraftWithSuggestions(currentDraft, suggestionDraft) {
  const next = cloneDraft(currentDraft);
  const suggestions = normalizeDraft(suggestionDraft || {});

  next.personalInfo = {
    ...next.personalInfo,
    ...Object.fromEntries(
      Object.entries(suggestions.personalInfo || {}).filter(
        ([key, value]) => !next.personalInfo?.[key] && value
      )
    ),
  };

  for (const key of ["summary", "technicalSkills", "softSkills", "keywords", "languages"]) {
    if (!normalizeString(next[key]) && normalizeString(suggestions[key])) {
      next[key] = suggestions[key];
    }
  }

  for (const key of ["workExperience", "projects", "education", "certifications"]) {
    if (!hasMeaningfulSection(next[key]) && hasMeaningfulSection(suggestions[key])) {
      next[key] = suggestions[key];
    }
  }

  for (const key of ["achievements", "extracurricular"]) {
    if (!compactList(next[key]).length && compactList(suggestions[key]).length) {
      next[key] = suggestions[key];
    }
  }

  return next;
}

function hasMeaningfulSection(items = []) {
  return normalizeEntryItems(items).some((item) =>
    Object.entries(item || {}).some(([key, value]) => {
      if (key === "id") return false;
      if (Array.isArray(value)) return compactList(value).length > 0;
      return Boolean(normalizeString(value));
    })
  );
}

function normalizeEntryIds(items, factory, normalizer = (item) => item) {
  return normalizeEntryItems(items).map((item) => {
    const source = normalizeRecord(item);
    return {
      ...factory(),
      ...normalizer(source),
      id: normalizeString(source.id) || createId(),
    };
  });
}

function normalizeDraft(draft) {
  const source = normalizeRecord(draft);
  const defaults = createDefaultData();
  const personalInfoSource = normalizeRecord(source.personalInfo || source.contact);
  const socialLinks = normalizeRecord(source.socialLinks);
  const technicalSkills = normalizeString(
    source.technicalSkills || source.skills || source.technologies || source.tools
  );

  return {
    ...defaults,
    ...source,
    template: normalizeString(source.template) || defaults.template,
    accent: normalizeString(source.accent) || defaults.accent,
    personalInfo: {
      ...defaults.personalInfo,
      name: normalizeString(personalInfoSource.name || source.name),
      title: normalizeString(personalInfoSource.title || source.headline || source.title),
      photo: normalizeString(personalInfoSource.photo),
      email: normalizeString(personalInfoSource.email),
      phone: normalizeString(personalInfoSource.phone),
      location: normalizeString(personalInfoSource.location || personalInfoSource.address),
      linkedin: normalizeString(personalInfoSource.linkedin || socialLinks.linkedin),
      github: normalizeString(personalInfoSource.github || socialLinks.github),
      portfolio: normalizeString(personalInfoSource.portfolio || socialLinks.portfolio || socialLinks.website),
    },
    headline: normalizeString(source.headline),
    summary: normalizeString(source.summary),
    technicalSkills,
    softSkills: normalizeString(source.softSkills),
    tools: normalizeString(source.tools),
    technologies: normalizeString(source.technologies),
    atsKeywords: normalizeString(source.atsKeywords),
    contact: normalizeString(source.contact),
    socialLinks: {
      linkedin: normalizeString(socialLinks.linkedin || personalInfoSource.linkedin),
      github: normalizeString(socialLinks.github || personalInfoSource.github),
      portfolio: normalizeString(socialLinks.portfolio || socialLinks.website || personalInfoSource.portfolio),
    },
    workExperience: normalizeEntryIds(
      normalizeEntryItems(source.workExperience || source.experience).length
        ? source.workExperience || source.experience
        : [blankRole()],
      blankRole,
      normalizeRole
    ),
    internships: normalizeEntryIds(source.internships, blankRole, normalizeRole),
    freelance: normalizeEntryIds(source.freelance, blankRole, normalizeRole),
    projects: normalizeEntryIds(source.projects, blankProject, normalizeProject),
    education: normalizeEntryIds(
      normalizeEntryItems(source.education).length ? source.education : [blankEducation()],
      blankEducation,
      normalizeEducation
    ),
    certifications: normalizeEntryIds(source.certifications, blankSimple, normalizeSimple),
    keywords: normalizeString(source.keywords || source.atsKeywords),
    achievements: normalizeList(source.achievements).length ? normalizeList(source.achievements) : [""],
    extracurricular: normalizeList(source.extracurricular).length ? normalizeList(source.extracurricular) : [""],
    languages: normalizeString(source.languages),
    interests: normalizeString(source.interests),
    references: normalizeString(source.references),
  };
}

function buildResumeInsights(data, atsScore, lastSavedAt) {
  const draft = normalizeDraft(data);
  const missingSections = [];
  const strengths = [];
  const suggestions = [];
  const workBullets = draft.workExperience.flatMap((item) => compactList(item.bullets));
  const projectBullets = draft.projects.flatMap((item) => compactList(item.bullets));
  const totalBullets = workBullets.length + projectBullets.length + compactList(draft.achievements).length;
  const keywordCount = compactList(draft.keywords).length;
  const wordCount = countResumeWords(draft);

  if (!draft.personalInfo.email || !draft.personalInfo.phone) missingSections.push("Complete contact details");
  if (!draft.summary) missingSections.push("Professional summary");
  if (!draft.technicalSkills) missingSections.push("Technical skills");
  if (!workBullets.length) missingSections.push("Experience bullets");
  if (!draft.education.some((item) => item.school || item.degree)) missingSections.push("Education");

  if (draft.summary && draft.summary.length >= 120) strengths.push("Summary gives useful role context");
  if (keywordCount >= 6) strengths.push("ATS keywords are well represented");
  if (workBullets.length >= 4) strengths.push("Experience section has supporting bullets");
  if (compactList(draft.softSkills).length >= 4) strengths.push("Soft skills are clearly stated");

  if (atsScore < 80) suggestions.push("Fill missing high-signal sections to improve ATS readiness");
  if (totalBullets < 6) suggestions.push("Add more measurable bullet points");
  if (wordCount < 300) suggestions.push("Add enough detail for a complete one-page resume");
  if (wordCount > 850) suggestions.push("Trim lower-impact details for readability");

  return {
    atsScore,
    missingSections: missingSections.slice(0, 4),
    strengths: strengths.slice(0, 4),
    suggestions: suggestions.slice(0, 4),
    lastSaved: formatLastSaved(lastSavedAt),
    wordCount,
    estimatedLength: estimateResumeLength(wordCount),
  };
}

function countResumeWords(draft) {
  const text = [
    draft.personalInfo.name,
    draft.personalInfo.title,
    draft.personalInfo.email,
    draft.personalInfo.phone,
    draft.personalInfo.location,
    draft.summary,
    draft.technicalSkills,
    draft.softSkills,
    draft.keywords,
    draft.languages,
    draft.interests,
    draft.references,
    ...draft.workExperience.flatMap((item) => [
      item.role,
      item.company,
      item.location,
      item.startDate,
      item.endDate,
      ...compactList(item.bullets),
    ]),
    ...draft.projects.flatMap((item) => [
      item.name,
      item.stack,
      item.link,
      item.description,
      ...compactList(item.bullets),
    ]),
    ...draft.education.flatMap((item) => [item.school, item.degree, item.location, item.year, item.details]),
    ...draft.certifications.flatMap((item) => [item.title, item.issuer, item.date]),
    ...compactList(draft.achievements),
    ...compactList(draft.extracurricular),
  ].join(" ");

  return text.match(/\b[\w'-]+\b/g)?.length || 0;
}

function estimateResumeLength(wordCount) {
  if (wordCount < 450) return "Under 1 page";
  if (wordCount <= 750) return "About 1 page";
  if (wordCount <= 1100) return "1-2 pages";
  return "2+ pages";
}

function formatLastSaved(value) {
  if (!value) return "Not saved this session";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function calculateScore(data) {
  const draft = normalizeDraft(data);
  const checks = [
    draft.personalInfo.name,
    draft.personalInfo.title,
    draft.personalInfo.email,
    draft.personalInfo.phone,
    draft.summary,
    draft.technicalSkills,
    draft.workExperience.some((item) => item.role && item.company),
    draft.workExperience.some((item) => compactList(item.bullets).length >= 2),
    draft.education.some((item) => item.school || item.degree),
    draft.projects.some((item) => item.name || compactList(item.bullets).length),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
