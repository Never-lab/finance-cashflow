/** Avvera / SDD car financing (not insurance). */
export function isCarLoanTransaction(input: {
  description: string;
  category?: string;
}): boolean {
  const hay = input.description;
  if (input.category === "Finanziamento auto") return true;
  return /payment loan/i.test(hay) && /avvera/i.test(hay);
}

export function carLoanKeyFromDescription(description: string): string | null {
  const m = description.match(/payment loan\s+n\.?\s*(\d+)/i);
  if (m) return `avvera-${m[1]}`;
  if (/avvera/i.test(description) && /prg\.car/i.test(description)) {
    return "avvera-car";
  }
  return null;
}
