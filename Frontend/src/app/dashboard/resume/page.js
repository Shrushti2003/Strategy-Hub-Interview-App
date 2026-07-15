import ResumeBuilder from "@/components/resume/resume-builder";

export const metadata = {
  title: "ATS Resume Builder | Strategy Hub",
  description: "Build an ATS-optimized resume tailored to your career goals.",
};

export default function ResumePage() {
  return (
    <div className="w-full h-full">
      <ResumeBuilder />
    </div>
  );
}
