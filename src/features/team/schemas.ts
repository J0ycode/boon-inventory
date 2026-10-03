import { z } from "zod";

export const memberSchema = z
  .object({
    userId: z.uuid().nullable(),
    fullName: z.string().trim().min(1, "Enter their name.").max(120),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    role: z.enum(["STOREROOM_MANAGER", "STORE_STAFF"], { message: "Choose a role." }),
    locationId: z.string(),
    active: z.boolean(),
  })
  .refine((v) => v.role !== "STORE_STAFF" || v.locationId !== "", {
    message: "Choose the store they work in.",
    path: ["locationId"],
  });

export type MemberFormValues = z.infer<typeof memberSchema>;

export const locationSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Enter a name.").max(80),
  address: z.string().trim().max(300),
  active: z.boolean(),
});

export type LocationFormValues = z.infer<typeof locationSchema>;
