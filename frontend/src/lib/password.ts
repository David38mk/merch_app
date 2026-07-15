export interface PwCheck {
  label: string;
  ok: boolean;
}

export function passwordChecks(pw: string): PwCheck[] {
  return [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "Contains a letter", ok: /[A-Za-z]/.test(pw) },
    { label: "Contains a number", ok: /\d/.test(pw) },
  ];
}

export function isPasswordValid(pw: string): boolean {
  return passwordChecks(pw).every((c) => c.ok);
}
