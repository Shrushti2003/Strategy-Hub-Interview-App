import { Suspense } from "react";
import PasswordResetCard from "@/components/auth/password-reset-card";

export const metadata = {
  title: "Reset password | Strategy Hub",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <PasswordResetCard mode="reset" />
    </Suspense>
  );
}
