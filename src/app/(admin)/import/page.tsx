'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getApiErrorMessage, parseResponseJson } from '@/lib/http/response';
import styles from './import.module.css';

interface Job {
    id: number;
    targetUrl: string;
    status: string;
    pagesFound: number;
    imagesFound: number;
    imagesSaved: number;
    articleId: number | null;
    errorLog: string | null;
    startedAt: string;
    completedAt: string | null;
}

interface ActiveJob {
    jobId: number;
    url: string;
    status: string;
    articleId: number | null;
    errorLog: string | null;
    dismissed: boolean;
}

interface Toast {
    id: number;
    type: 'success' | 'error';
    message: string;
}

// Pipeline stages in order
const STAGES = [
    { key: 'scraping',            label: 'سحب',     pct: 15 },
    { key: 'processing-images',   label: 'صور',     pct: 35 },
    { key: 'translating',         label: 'ترجمة',   pct: 70 },
    { key: 'completed',           label: 'اكتمل',   pct: 100 },
] as const;

const STAGE_LABEL_AR: Record<string, string> = {
    pending:               'في قائمة الانتظار...',
    scraping:              'سحب المقال من الموقع...',
    'processing-images':   'معالجة الصور وتحميلها...',
    translating:           'الترجمة بالذكاء الاصطناعي...',
    completed:             'اكتملت بنجاح ✓',
    failed:                'فشلت العملية ✗',
};

function statusToPct(status: string): number {
    if (status === 'completed') return 100;
    if (status === 'failed')    return 100;
    const stage = STAGES.find(s => s.key === status);
    return stage ? stage.pct : 5;
}

const STATUS_LABELS: Record<string, string> = {
    pending:               'قيد الانتظار',
    scraping:              'يسحب',
    'processing-images':   'يعالج الصور',
    translating:           'يترجم',
    completed:             'مكتملة',
    failed:                'فشلت',
};

function parseSqliteDate(value: string): Date | null {
    const sqliteMatch = value.match(
        /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
    );
    if (sqliteMatch) {
        const [, y, m, d, hh, mm, ss] = sqliteMatch;
        return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatJobDate(value: string | null): string {
    if (!value) return 'قيد الانتظار';
    const parsed = parseSqliteDate(value);
    if (!parsed) return value;
    return new Intl.DateTimeFormat('ar-SA', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(parsed);
}

let toastSeq = 0;

export default function AdminImportPage() {
    const [urlsInput, setUrlsInput]         = useState('');
    const [scrapeDelay, setScrapeDelay]     = useState<number>(2);
    const [savingSettings, setSavingSettings] = useState(false);
    const [jobs, setJobs]                   = useState<Job[]>([]);
    const [submitting, setSubmitting]       = useState(false);
    const [error, setError]                 = useState<string | null>(null);
    const [activeJobs, setActiveJobs]       = useState<ActiveJob[]>([]);
    const [toasts, setToasts]               = useState<Toast[]>([]);
    const pollingRef                        = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Toast helpers ───────────────────────────────────────────────────────
    const pushToast = useCallback((type: 'success' | 'error', message: string) => {
        const id = ++toastSeq;
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }, []);

    // ── Poll a single job and update activeJobs state ───────────────────────
    const pollJob = useCallback(async (jobId: number) => {
        try {
            const res = await fetch(`/api/scrape/${jobId}`);
            const { data, rawText } = await parseResponseJson<Job>(res);
            if (!res.ok || !data) {
                console.error(getApiErrorMessage(res, data, rawText, 'Poll failed'));
                return;
            }

            setActiveJobs(prev => prev.map(aj => {
                if (aj.jobId !== jobId) return aj;
                const wasTerminal = aj.status === 'completed' || aj.status === 'failed';
                if (wasTerminal) return aj; // already notified

                const isCompleted = data.status === 'completed';
                const isFailed    = data.status === 'failed';

                if (isCompleted) {
                    pushToast('success', `✓ اكتمل الاستيراد بنجاح!\n${aj.url.split('/').filter(Boolean).pop() ?? aj.url}`);
                }
                if (isFailed) {
                    pushToast('error', `✗ فشل الاستيراد:\n${data.errorLog ?? aj.url}`);
                }

                return {
                    ...aj,
                    status:    data.status,
                    articleId: data.articleId ?? null,
                    errorLog:  data.errorLog ?? null,
                };
            }));
        } catch { /* ignore poll errors */ }
    }, [pushToast]);

    // ── Global poll loop: tick every 1.5 s while there are active non-terminal jobs ──
    useEffect(() => {
        const hasLive = activeJobs.some(
            aj => !aj.dismissed && aj.status !== 'completed' && aj.status !== 'failed'
        );
        if (hasLive) {
            pollingRef.current = setInterval(() => {
                activeJobs
                    .filter(aj => !aj.dismissed && aj.status !== 'completed' && aj.status !== 'failed')
                    .forEach(aj => pollJob(aj.jobId));
            }, 1500);
        } else {
            if (pollingRef.current) clearInterval(pollingRef.current);
        }
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [activeJobs, pollJob]);

    // ── Fetch settings + job history ────────────────────────────────────────
    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const { data } = await parseResponseJson<{ scrape_delay_seconds?: number }>(res);
            if (res.ok && data?.scrape_delay_seconds !== undefined) {
                setScrapeDelay(data.scrape_delay_seconds);
            }
        } catch { /* ignore */ }
    };

    const fetchJobs = async () => {
        try {
            const res = await fetch('/api/scrape?limit=20&offset=0');
            const { data } = await parseResponseJson<{ success?: boolean; jobs?: Job[] }>(res);
            if (res.ok && data?.success && data.jobs) setJobs(data.jobs);
        } catch { /* ignore */ }
    };

    useEffect(() => {
        fetchSettings();
        fetchJobs();
        const interval = setInterval(fetchJobs, 5000);
        return () => clearInterval(interval);
    }, []);

    // ── Submit ───────────────────────────────────────────────────────────────
    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scrape_delay_seconds: scrapeDelay }),
            });
        } finally {
            setSavingSettings(false);
        }
    };

    const handleSubmit = async () => {
        setError(null);
        const urls = urlsInput.split('\n').map(u => u.trim()).filter(u => u);
        if (urls.length === 0) { setError('يرجى إدخال رابط واحد على الأقل'); return; }

        setSubmitting(true);
        try {
            for (const url of urls) {
                const res  = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                });
                const { data, rawText } = await parseResponseJson<{ jobId?: number; error?: string }>(res);
                const jobId = data?.jobId;
                if (res.ok && typeof jobId === 'number') {
                    setActiveJobs(prev => [
                        ...prev,
                        { jobId, url, status: 'pending', articleId: null, errorLog: null, dismissed: false },
                    ]);
                } else {
                    setError(getApiErrorMessage(res, data, rawText, 'خطأ غير معروف'));
                }
            }
            setUrlsInput('');
            fetchJobs();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'خطأ في الشبكة');
        } finally {
            setSubmitting(false);
        }
    };

    const dismissActiveJob = (jobId: number) => {
        setActiveJobs(prev => prev.map(aj => aj.jobId === jobId ? { ...aj, dismissed: true } : aj));
    };

    const visibleActiveJobs = activeJobs.filter(aj => !aj.dismissed);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className={styles.container}>
            {/* Toast container */}
            <div className={styles.toastContainer}>
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`${styles.toast} ${t.type === 'success' ? styles.success : styles.error}`}
                        onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                        style={{ whiteSpace: 'pre-line' }}
                    >
                        {t.message}
                    </div>
                ))}
            </div>

            <header className={styles.header}>
                <h1 className={styles.title}>استيراد الدفعات والترجمة (Batch Process)</h1>
            </header>

            {/* ── Settings ── */}
            <div className={styles.formBox} style={{ marginBottom: '2rem' }}>
                <h2 className={styles.listTitle}>إعدادات الساحب (Scraper Settings)</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <label>
                        تأخير السحب (ثواني):
                        <input
                            type="number" min="0" max="30" value={scrapeDelay}
                            onChange={(e) => setScrapeDelay(parseInt(e.target.value) || 0)}
                            style={{ margin: '0 1rem', padding: '0.5rem', width: '80px', borderRadius: '4px', border: '1px solid var(--border)' }}
                        />
                    </label>
                    <Button onClick={handleSaveSettings} disabled={savingSettings}>
                        {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                    </Button>
                </div>
            </div>

            {/* ── URL input ── */}
            <div className={styles.formBox}>
                <h2 className={styles.listTitle}>إضافة روابط جديدة للترجمة</h2>
                <p style={{ color: 'var(--text-muted)' }}>ألصق روابط مقالات Taste of Cinema هنا. (كل رابط في سطر منفصل)</p>

                {error && <div style={{ color: 'var(--color-danger)' }}>{error}</div>}

                <textarea
                    className={styles.textarea}
                    dir="ltr"
                    placeholder="https://tasteofcinema.com/..."
                    value={urlsInput}
                    onChange={(e) => setUrlsInput(e.target.value)}
                    disabled={submitting}
                />

                <div>
                    <Button onClick={handleSubmit} disabled={submitting} aria-label="Start Scraping and Translation">
                        {submitting ? 'جاري البدء...' : 'بدء الترجمة والمعالجة'}
                    </Button>
                </div>
            </div>

            {/* ── Active Job Progress Cards ── */}
            {visibleActiveJobs.length > 0 && (
                <div className={styles.activeSection}>
                    <h2 className={styles.listTitle}>المهام الجارية</h2>
                    {visibleActiveJobs.map(aj => {
                        const pct      = statusToPct(aj.status);
                        const isDone   = aj.status === 'completed';
                        const isFailed = aj.status === 'failed';
                        const stageAr  = STAGE_LABEL_AR[aj.status] ?? aj.status;
                        const slug     = aj.url.split('/').filter(Boolean).pop() ?? '';

                        return (
                            <div
                                key={aj.jobId}
                                className={`${styles.activeJobCard} ${isDone ? styles.done : ''} ${isFailed ? styles.failed : ''}`}
                            >
                                {/* Header row */}
                                <div className={styles.jobCardHeader}>
                                    <span className={styles.jobCardUrl} dir="ltr">{aj.url}</span>
                                    <span className={`${styles.jobCardStage} ${isDone ? styles.stageDone : ''} ${isFailed ? styles.stageFail : ''}`}>
                                        {stageAr}
                                    </span>
                                </div>

                                {/* Progress bar */}
                                <div className={styles.progressTrack}>
                                    <div
                                        className={`${styles.progressBar} ${isDone ? styles.barDone : ''} ${isFailed ? styles.barFail : ''}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>

                                {/* Stage step dots */}
                                <div className={styles.stageSteps}>
                                    {STAGES.map(stage => {
                                        const stageIdx   = STAGES.findIndex(s => s.key === aj.status);
                                        const thisIdx    = STAGES.findIndex(s => s.key === stage.key);
                                        const isActive   = stage.key === aj.status;
                                        const isComplete = thisIdx < stageIdx || isDone;
                                        return (
                                            <div
                                                key={stage.key}
                                                className={`${styles.stepDot} ${isActive ? styles.active : ''} ${isComplete ? styles.complete : ''}`}
                                            >
                                                <div className={styles.stepDotCircle} />
                                                <span>{stage.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Actions */}
                                <div className={styles.jobCardActions}>
                                    {isDone && aj.articleId && (
                                        <a href={`/admin/articles/${aj.articleId}/edit`} className={styles.viewArticleLink}>
                                            عرض المقال ←
                                        </a>
                                    )}
                                    {isDone && !aj.articleId && (
                                        <a href={`/article/${slug}`} className={styles.viewArticleLink}>
                                            عرض المقال ←
                                        </a>
                                    )}
                                    {isFailed && aj.errorLog && (
                                        <span style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>
                                            {aj.errorLog.slice(0, 120)}
                                        </span>
                                    )}
                                    {(isDone || isFailed) && (
                                        <button
                                            onClick={() => dismissActiveJob(aj.jobId)}
                                            style={{ marginInlineStart: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                                        >
                                            إخفاء
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Job history ── */}
            <div className={styles.listContainer}>
                <h2 className={styles.listTitle}>سجل المعالجات</h2>

                {jobs.map(job => (
                    <div key={job.id} className={styles.batchItem}>
                        <div className={styles.batchHeader}>
                            <strong>المهمة #{job.id}</strong>
                            <Badge variant={
                                job.status === 'completed' ? 'success' :
                                job.status === 'failed'    ? 'danger'  :
                                job.status === 'pending'   ? 'default' : 'gold'
                            }>
                                {STATUS_LABELS[job.status] ?? job.status}
                            </Badge>
                        </div>

                        <div className={styles.batchStatus}>
                            <span>الصور الموجودة: {job.imagesFound}</span>
                            <span>-</span>
                            <span style={{ color: 'var(--color-success)' }}>الصور المحملة: {job.imagesSaved}</span>
                            <span>-</span>
                            <span>الصفحات: {job.pagesFound}</span>
                        </div>

                        <div className={styles.batchMeta}>
                            <div className={styles.metaUrl}>URL: {job.targetUrl}</div>
                            <div className={styles.metaDate} dir="rtl">بدأ في: {formatJobDate(job.startedAt)}</div>
                            {job.completedAt && (
                                <div className={styles.metaDate} dir="rtl">انتهى في: {formatJobDate(job.completedAt)}</div>
                            )}
                        </div>
                    </div>
                ))}

                {jobs.length === 0 && <p>لا توجد مهام سحب حالية.</p>}
            </div>
        </div>
    );
}
