import { redirect } from "next/navigation";

export const metadata = {
  title: "Generate Strategy | Strategy Hub",
  description: "Generate personalized career and interview strategies using AI.",
};

export default function GeneratePage() {
  redirect("/dashboard");
}
