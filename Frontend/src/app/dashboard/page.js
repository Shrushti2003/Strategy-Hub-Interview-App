"use client";

import { motion } from "framer-motion";
import AiGenerationFlow from "@/components/dashboard/ai-generation-flow";

export default function DashboardPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
    >
      <AiGenerationFlow />
    </motion.div>
  );
}
