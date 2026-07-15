"use client";

import { motion } from "framer-motion";
import { BrainCircuit } from "lucide-react";

const rows = [72, 92, 84, 66];

export default function AiLoadingScreen() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center py-20">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center gap-3 rounded-full border border-border bg-surface-1 px-4 py-2 text-sm text-muted-foreground"
      >
        <BrainCircuit className="size-4 text-primary" />
        Processing your strategy
      </motion.div>

      <div className="w-full rounded-2xl border border-border bg-card p-5">
        <div className="mb-5 h-4 w-40 animate-pulse rounded-full bg-surface-3" />
        <div className="space-y-3">
          {rows.map((width) => (
            <div
              key={width}
              className="h-12 overflow-hidden rounded-lg border border-border bg-surface-1"
            >
              <div className="h-full w-full animate-[shimmer_1.6s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent,rgba(124,58,237,0.14),transparent)]" />
              <div className="sr-only" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        This may take a few seconds while the backend prepares your plan.
      </p>
    </div>
  );
}
