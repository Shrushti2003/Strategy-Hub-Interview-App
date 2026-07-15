import { Suspense } from "react";
import PasswordResetCard from "@/components/auth/password-reset-card";

export const metadata = {
  title: "Forgot password | Strategy Hub",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <PasswordResetCard mode="request" />
    </Suspense>
  );
}
