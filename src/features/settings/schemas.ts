import { z } from "zod";

export const companySchema = z.object({
  name: z.string().trim().min(1, "Enter your shop's name.").max(120),
  legalName: z.string().trim().max(160),
  address: z.string().trim().max(400),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("Enter a valid email address.")]),
  taxId: z.string().trim().max(40),
});

export type CompanyValues = z.infer<typeof companySchema>;