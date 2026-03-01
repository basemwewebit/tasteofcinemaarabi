export interface ParsedResponse<T> {
    data: T | null;
    rawText: string;
    isJson: boolean;
}

export async function parseResponseJson<T = Record<string, unknown>>(res: Response): Promise<ParsedResponse<T>> {
    const rawText = await res.text();
    if (!rawText) {
        return { data: null, rawText: '', isJson: false };
    }

    try {
        const data = JSON.parse(rawText) as T;
        return { data, rawText, isJson: true };
    } catch {
        return { data: null, rawText, isJson: false };
    }
}

export function getApiErrorMessage(
    res: Response,
    payload: unknown,
    rawText: string,
    fallback = 'حدث خطأ غير متوقع'
): string {
    if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;
        if (typeof record.error === 'string' && record.error.trim()) {
            return record.error;
        }
        if (typeof record.message === 'string' && record.message.trim()) {
            return record.message;
        }
    }

    if (rawText.trim()) {
        return rawText.trim().slice(0, 240);
    }

    return `${fallback} (${res.status} ${res.statusText})`;
}
