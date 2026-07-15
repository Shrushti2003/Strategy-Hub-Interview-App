"use client";

import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import AnoAI from "@/components/ui/animated-shader-background";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#050505] font-sans text-white">
      <AnoAI />

      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,rgba(5,5,5,0.10),rgba(5,5,5,0.22)_48%,rgba(5,5,5,0.58)_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.30)_0%,rgba(0,0,0,0.12)_42%,rgba(0,0,0,0.36)_100%)]" />

      <section className="relative z-20 mx-auto flex min-h-[100svh] w-full max-w-7xl items-center justify-center px-5 py-14 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
          <div
            className="landing-reveal inline-flex items-center gap-2.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-5 py-2 text-[14px] font-bold uppercase tracking-[0.12em] text-[#F5F1E8] shadow-[0_18px_50px_rgba(0,0,0,0.22),0_0_34px_rgba(124,58,237,0.14),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl sm:text-[15px]"
            style={{ fontFamily: "Candara, Inter, ui-sans-serif, system-ui, sans-serif" }}
          >
            <span className="size-1.5 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(167,139,250,0.95)]" />
            Strategy Hub
          </div>

          <h1
            className="landing-reveal landing-reveal-delay-1 mt-14 max-w-5xl text-balance text-[42px] font-bold italic leading-[1.05] tracking-[-1.3px] text-[#F7F3EC] sm:text-[60px] lg:text-[72px]"
            style={{
              fontFamily:
                '"Franklin Gothic Demi", "Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif',
            }}
          >
            <span>Ace Every </span>
            <span className="text-[#FFF8EE]">
              Interview
            </span>{" "}
            <span
              className="align-baseline text-[0.58em] font-normal normal-case tracking-normal text-[#F7F3EC]"
              style={{ fontFamily: '"Freestyle Script", "Brush Script MT", cursive' }}
            >
              with
            </span>{" "}
            <span className="inline-block bg-gradient-to-b from-[#DCCBFF] to-[#8EBBFF] bg-clip-text text-[1.08em] text-transparent">
              AI
            </span>
          </h1>

          <p
            className="landing-reveal landing-reveal-delay-2 mt-10 max-w-[47.5rem] text-pretty text-lg font-normal italic leading-[1.8] text-[#D8D2C8] sm:text-xl lg:text-[22px]"
            style={{ fontFamily: '"Sitka Banner", "Times New Roman", serif' }}
          >
            Master every stage of your job search with AI-powered interview preparation,
            ATS resume optimization, personalized strategies, and career guidance&mdash;all in
            one place.
          </p>

          <div className="landing-reveal landing-reveal-delay-3 mt-16 flex w-full max-w-md flex-col items-stretch justify-center gap-4 sm:max-w-none sm:flex-row sm:items-center sm:gap-5">
            <Button
              size="lg"
              render={<Link href={isAuthenticated ? "/dashboard" : "/register"} />}
              className="h-14 rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,#8B5CF6_0%,#4F8BFF_100%)] bg-[length:100%_145%] px-[34px] py-4 text-[17px] font-bold tracking-[0.3px] text-[#FFFDF8] shadow-[0_18px_46px_rgba(79,139,255,0.20),0_12px_34px_rgba(139,92,246,0.28),inset_0_1px_0_rgba(255,255,255,0.20)] transition-all duration-300 ease-out [font-family:Perpetua,Georgia,serif] hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-[position:0_100%] hover:shadow-[0_22px_58px_rgba(79,139,255,0.28),0_16px_42px_rgba(139,92,246,0.34),inset_0_1px_0_rgba(255,255,255,0.24)] focus-visible:ring-violet-200/80 sm:min-w-48"
            >
              {isAuthenticated ? (
                <>
                  Open Dashboard
                  <LayoutDashboard className="size-4" />
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
            {!isAuthenticated ? (
              <Button
                size="lg"
                variant="outline"
                render={<Link href="/login" />}
                className="h-14 rounded-[14px] border-white/[0.15] bg-white/[0.04] px-[34px] py-4 text-[17px] font-bold tracking-[0.3px] text-[#F5F1E8] shadow-[0_16px_42px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-300 ease-out [font-family:Perpetua,Georgia,serif] hover:-translate-y-0.5 hover:scale-[1.02] hover:border-white/30 hover:bg-white/[0.08] hover:text-[#F5F1E8] hover:shadow-[0_18px_46px_rgba(0,0,0,0.36),0_0_24px_rgba(142,187,255,0.12),inset_0_1px_0_rgba(255,255,255,0.08)] focus-visible:ring-blue-300/60 sm:min-w-40"
              >
                Sign In
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
