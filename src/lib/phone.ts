export const PHONE_MIN_DIGITS = 8;
export const PHONE_MAX_DIGITS = 15;

export function normalizePhoneDigits(value: string | null | undefined) {
    return (value || "").replace(/\D/g, "");
}

export function isPlausiblePhoneDigits(value: string) {
    return value.length >= PHONE_MIN_DIGITS && value.length <= PHONE_MAX_DIGITS;
}

export function getPhoneSuffix(value: string) {
    const normalized = normalizePhoneDigits(value);
    if (!normalized) return "";
    return normalized.length > 10 ? normalized.slice(-10) : normalized;
}

export function uniquePhoneCandidates(values: Array<string | null | undefined>) {
    const seen = new Set<string>();

    return values
        .map((value) => normalizePhoneDigits(value))
        .filter((value) => isPlausiblePhoneDigits(value))
        .filter((value) => {
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
}

export function buildPhoneMatchClauses(values: Array<string | null | undefined>) {
    const candidates = uniquePhoneCandidates(values);
    const clauses: Array<{ phone: string } | { phone: { endsWith: string } }> = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
        const exactKey = `eq:${candidate}`;
        if (!seen.has(exactKey)) {
            clauses.push({ phone: candidate });
            seen.add(exactKey);
        }

        const suffix = getPhoneSuffix(candidate);
        if (suffix && suffix !== candidate) {
            const suffixKey = `suffix:${suffix}`;
            if (!seen.has(suffixKey)) {
                clauses.push({ phone: { endsWith: suffix } });
                seen.add(suffixKey);
            }
        }
    }

    return clauses;
}
