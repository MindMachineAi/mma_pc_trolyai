"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { isAdminConfigured, verifyAdminCredentials } from "@/lib/password";

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!isAdminConfigured()) {
    redirect("/login?error=config");
  }

  if (!verifyAdminCredentials(email, password)) {
    redirect("/login?error=invalid");
  }

  await createSession(email.trim().toLowerCase());
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
