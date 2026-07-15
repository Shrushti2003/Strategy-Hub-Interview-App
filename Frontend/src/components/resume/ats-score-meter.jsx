"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";

export default function AtsScoreMeter({ score = 85, keywords = [], missingKeywords = [] }) {
  // Determine color based on score
  const getScoreColor = () => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreGradient = () => {
    if (score >= 80) return "from-green-500 to-emerald-400";
    if (score >= 60) return "from-yellow-500 to-amber-400";
    return "from-red-500 to-rose-400";
  };

  return (
    <div className="bg-secondary/30 border border-border/50 rounded-xl p-5 w-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          ATS Match Score
        </h3>
        <span className={`text-2xl font-bold ${getScoreColor()}`}>
          {score}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full bg-gradient-to-r ${getScoreGradient()}`}
        />
      </div>

      <div className="space-y-3 mt-2">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            Optimized Keywords
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map(kw => (
              <span key={kw} className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 text-[10px] font-medium">
                {kw}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
            Suggested Additions
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {missingKeywords.map(kw => (
              <span key={kw} className="px-2 py-0.5 rounded-md bg-secondary/50 text-muted-foreground border border-border/50 text-[10px] font-medium cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors">
                + {kw}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
