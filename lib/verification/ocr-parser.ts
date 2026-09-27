/** Conservative text candidates only. No identity matching or approval decisions. */
export interface OcrCandidates {
  fullName: string | null;
  dateOfBirth: string | null;
  idType: string | null;
}

export function parseIdText(rawText: string): OcrCandidates {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  function labeled(label: RegExp): string | null {
    const index = lines.findIndex((line) => label.test(line));
    if (index < 0) return null;
    const value = lines[index].replace(label, "").replace(/^\s*[:\-]\s*/, "").trim();
    const next = value || lines[index + 1] || "";
    // Do not consume another field's label as the value.
    return next && !/^(?:full name|name|date of birth|birth date|dob|address|sex|nationality|expiry|signature|.*number)\b/i.test(next) ? next : null;
  }
  const name = labeled(/^(?:full\s+name|name)\b\s*:?[ \t]*/i);
  const birth = labeled(/^(?:date\s+of\s+birth|birth\s+date|dob)\b\s*:?[ \t]*/i);
  // ISO dates and explicit English months only; ambiguous numeric dates stay blank.
  let dateOfBirth: string | null = null;
  if (birth) {
    const iso = birth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const written = birth.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const month = written ? months.findIndex((m) => m === written[2].toLowerCase() || m.slice(0, 3) === written[2].toLowerCase()) + 1 : 0;
    const candidate = iso ? iso[0] : written && month ? `${written[3]}-${String(month).padStart(2, "0")}-${written[1].padStart(2, "0")}` : null;
    if (candidate) {
      const date = new Date(`${candidate}T00:00:00Z`);
      if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === candidate && date <= new Date()) dateOfBirth = candidate;
    }
  }
  const types: [RegExp, string][] = [
    [/\b(?:PHILID|PHILIPPINE IDENTIFICATION CARD|PHILIPPINE NATIONAL ID)\b/i, "Philippine National ID (PhilID)"],
    [/\bDRIVER'?S LICENSE\b/i, "LTO Driver's License"],
    [/\bPASSPORT\b/i, "Philippine Passport"],
    [/\b(?:UMID|UNIFIED MULTI.PURPOSE ID)\b/i, "Unified Multi-Purpose ID (UMID)"],
    [/\bPOSTAL ID\b/i, "Postal ID"],
    [/\bPROFESSIONAL REGULATION COMMISSION\b/i, "PRC ID"],
  ];
  const matches = types.filter(([pattern]) => pattern.test(rawText));
  return {
    fullName: name && name.length <= 120 && /^[\p{L} .,'’\-]+$/u.test(name) && name.split(/\s+/).length >= 2 ? name : null,
    dateOfBirth,
    idType: matches.length === 1 ? matches[0][1] : null,
  };
}
