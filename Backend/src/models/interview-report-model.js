const mongoose = require("mongoose")

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    intention: { type: String, default: "" },
    answer: { type: String, required: true },
    explanation: { type: String, default: "" },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "intermediate"
    },
    followUps: [{ type: String }],
    category: { type: String, default: "" },
    whyInterviewerAsks: { type: String, default: "" },
    bestPractices: [{ type: String }],
    commonMistakes: [{ type: String }],
    recruiterTips: [{ type: String }],
    relevantSkills: [{ type: String }],
    evaluation: [{ type: String }],
    star: {
      situation: { type: String, default: "" },
      task: { type: String, default: "" },
      action: { type: String, default: "" },
      result: { type: String, default: "" }
    }
  },
  { _id: false }
)

const skillGapSchema = new mongoose.Schema(
  {
    skill: { type: String, required: true },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true
    }
  },
  { _id: false }
)

const preparationDaySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true },
    focus: { type: String, required: true },
    tasks: [{ type: String, required: true }]
  },
  { _id: false }
)

const interviewReportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    jobTitle: { type: String, default: "" },
    company: { type: String, default: "" },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    jobDescription: { type: String, required: true },
    jobAnalysis: { type: Object, default: {} },
    selfDescription: { type: String, default: "" },
    resume: { type: String, default: "" },
    styleResumeText: { type: String, default: "" },
    resumeStyleProfile: { type: Object, default: {} },
    atsResumeData: { type: Object, default: {} },
    matchScore: { type: Number, required: true },
    technicalQuestions: [questionSchema],
    behavioralQuestions: [questionSchema],
    resumeQuestions: [questionSchema],
    skillGaps: [skillGapSchema],
    preparationPlan: [preparationDaySchema],
    roadmap: [preparationDaySchema],
    strategy: { type: Object, default: {} },
    atsAnalysis: { type: Object, default: {} },
    resumeBuilder: { type: Object, default: {} },
    resumeSuggestions: [{ type: String }],
    questionState: {
      type: Map,
      of: new mongoose.Schema(
        {
          completed: { type: Boolean, default: false },
          bookmarked: { type: Boolean, default: false }
        },
        { _id: false }
      ),
      default: {}
    },
    dashboardState: {
      activeSection: { type: String, default: "technical" },
      search: { type: String, default: "" },
      difficulty: { type: String, default: "all" },
      status: { type: String, default: "all" },
      sort: { type: String, default: "default" }
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("InterviewReport", interviewReportSchema)
