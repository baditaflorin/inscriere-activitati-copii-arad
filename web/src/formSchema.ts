import { z } from "zod";

export const consentValues = ["DA", "NU"] as const;

export const enrollmentFormSchema = z.object({
  parentName: z.string().trim().min(3, "Scrie numele parintelui sau tutorelui."),
  childName: z.string().trim().min(3, "Scrie numele copilului."),
  school: z.string().trim().min(2, "Scrie gradinita sau scoala."),
  className: z.string().trim().min(1, "Scrie grupa sau clasa."),
  cnp: z
    .string()
    .trim()
    .regex(/^\d{13}$/, "CNP-ul copilului trebuie sa aiba exact 13 cifre."),
  address: z.string().trim().min(6, "Scrie adresa completa."),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9 .()-]{7,20}$/, "Scrie un numar de telefon valid."),
  consent: z.enum(consentValues),
  date: z.string().trim().min(1, "Alege data cererii."),
});

export type EnrollmentFormData = z.infer<typeof enrollmentFormSchema>;

export function defaultEnrollmentDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
