import { z } from "zod";

export const TenantOnboardingSchema = z.object({
  tenant_id: z.string().min(1),
  admin_email: z.string().email(),
  plan: z.enum(["trial", "growth", "enterprise"]),
});

export type TenantOnboarding = z.infer<typeof TenantOnboardingSchema>;

export type OnboardingState = "pending" | "active" | "dead_letter";
