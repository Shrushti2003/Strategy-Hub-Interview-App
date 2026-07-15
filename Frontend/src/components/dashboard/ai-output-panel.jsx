"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Clock, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function AiOutputUi({ report, onReset }) {
  const title = report?.title || "Interview strategy";
  const preparationPlan = report?.preparationPlan || [];
  const skillGaps = report?.skillGaps || [];
  const technicalQuestions = report?.technicalQuestions || [];

  async function copySummary() {
    const text = [
      title,
      report?.matchScore ? `Match score: ${report.matchScore}%` : "",
      ...preparationPlan.map(
        (phase) => `Day ${phase.day}: ${phase.focus}\n${phase.tasks?.join("\n") || ""}`
      ),
    ]
      .filter(Boolean)
      .join("\n\n");

    await navigator.clipboard.writeText(text);
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12"
    >
      <motion.div
        variants={item}
        className="flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-center"
      >
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">Strategy ready</Badge>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="size-3" /> Just now
            </span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h2>
          {report?.matchScore ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Estimated match score: {report.matchScore}%
            </p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copySummary}>
            <Copy className="size-4" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="size-4" /> New
          </Button>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Technical questions" value={technicalQuestions.length} />
        <MetricCard label="Preparation days" value={preparationPlan.length} />
        <MetricCard label="Skill gaps" value={skillGaps.length} />
      </motion.div>

      <motion.div variants={item}>
        <Card className="bg-card/90">
          <CardHeader>
            <CardTitle>Preparation plan</CardTitle>
            <CardDescription>
              A practical sequence generated from your submitted context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preparationPlan.length ? (
              preparationPlan.map((phase) => (
                <div
                  key={`${phase.day}-${phase.focus}`}
                  className="rounded-xl border border-border bg-surface-1 p-4 transition-transform hover:-translate-y-0.5"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                      {phase.day}
                    </div>
                    <p className="font-medium">{phase.focus}</p>
                  </div>
                  <div className="space-y-2">
                    {(phase.tasks || []).map((task) => (
                      <div
                        key={task}
                        className="flex gap-2 text-sm leading-6 text-muted-foreground"
                      >
                        <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />
                        <span>{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <EmptyBlock text="No preparation plan was returned." />
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card/90">
          <CardHeader>
            <CardTitle>Likely questions</CardTitle>
            <CardDescription>
              Use these to rehearse concise, role-specific answers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {technicalQuestions.slice(0, 5).map((question) => (
              <div
                key={question.question}
                className="rounded-lg border border-border bg-surface-1 p-3"
              >
                <p className="text-sm font-medium">{question.question}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {question.intention}
                </p>
              </div>
            ))}
            {!technicalQuestions.length ? (
              <EmptyBlock text="No questions were returned." />
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-card/90">
          <CardHeader>
            <CardTitle>Skill gaps</CardTitle>
            <CardDescription>
              Areas to review before the interview.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {skillGaps.map((gap) => (
              <div
                key={gap.skill}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-1 p-3"
              >
                <span className="text-sm font-medium">{gap.skill}</span>
                <Badge variant="outline">{gap.severity}</Badge>
              </div>
            ))}
            {!skillGaps.length ? <EmptyBlock text="No gaps were returned." /> : null}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function MetricCard({ label, value }) {
  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function EmptyBlock({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-1 p-4 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
