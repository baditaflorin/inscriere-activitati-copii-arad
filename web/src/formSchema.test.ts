import { describe, expect, it } from "vitest";
import { enrollmentFormSchema } from "./formSchema";

const validForm = {
  parentName: "Popescu Maria",
  childName: "Popescu Ana",
  school: "Scoala Gimnaziala Mihai Eminescu",
  className: "III",
  cnp: "6123456789012",
  address: "Strada Exemplu 10, Arad",
  phone: "0712 345 678",
  consent: "DA",
  date: "2026-05-04",
};

describe("enrollmentFormSchema", () => {
  it("accepts a complete enrollment form", () => {
    expect(enrollmentFormSchema.safeParse(validForm).success).toBe(true);
  });

  it("rejects CNP values that are not 13 digits", () => {
    const result = enrollmentFormSchema.safeParse({ ...validForm, cnp: "123" });
    expect(result.success).toBe(false);
  });
});
