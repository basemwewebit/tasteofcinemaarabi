'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import styles from './import.module.css';

interface Job {
    id: number;
    targetUrl: string;
    status: string;
    pagesFound: number;
    imagesFound: number;
    imagesSaved: number;
    startedAt: string;
    completedAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'قيد الانتظار',
    processing: 'قيد المعالجة',
    completed: 'مكتملة',
    failed: 'فشلت',
};

function parseSqliteDate(value: string): Date | null {
    const sqliteMatch = value.match(
        /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
    );

    if (sqliteMatch) {
        const [, y, m, d, hh, mm, ss] = sqliteMatch;
        return new Date(
            Number(y),
            Number(m) - 1,
            Number(d),
            Number(hh),
            Number(mm),
            Number(ss)
        );
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatJobDate(value: string | null): string {
    if (!value) return 'قيد الانتظار';
    const parsed = parseSqliteDate(value);
    if (!parsed) {
        return value;
    }

    return new Intl.DateTimeFormat('ar-SA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(parsed);
}

export default function AdminImportPage() {
    const [urlsInput, setUrlsInput] = useState('');
    const [scrapeDelay, setScrapeDelay] = useState<number>(2);
    const [savingSettings, setSavingSettings] = useState(false);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.scrape_delay_seconds !== undefined) {
                setScrapeDelay(data.scrape_delay_seconds);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchJobs = async () => {
        try {
            const res = await fetch('/api/scrape?limit=20&offset=0');
            const data = await res.json();
            if (data.success && data.jobs) {
                setJobs(data.jobs);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchJobs();
        const interval = setInterval(fetchJobs, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scrape_delay_seconds: scrapeDelay }),
            });
        } catch (err) {
            console.error(err);
        } finally {
            setSavingSettings(false);
        }
    };

    const handleSubmit = async () => {
        setError(null);
        const urls = urlsInput.split('\n').map(u => u.trim()).filter(u => u);

        if (urls.length === 0) {
            setError('يرجى إدخال رابط واحد على الأقل');
            return;
        }

        setSubmitting(true);
        try {
            let successCount = 0;
            for (const url of urls) {
                const res = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                });
                const data = await res.json();
                if (data.success) {
                    successCount++;
                } else {
                    setError(data.error);
                }
            }
            if (successCount > 0) {
                setUrlsInput('');
                fetchJobs();
                alert(`تم بدء الاستيراد لـ ${successCount} رابط. يتم الترجمة في الخلفية.`);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error checking batch api');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>استيراد الدفعات والترجمة (Batch Process)</h1>
            </header>

            <div className={styles.formBox} style={{ marginBottom: '2rem' }}>
                <h2 className={styles.listTitle}>إعدادات الساحب (Scraper Settings)</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <label>
                        تأخير السحب (ثواني):
                        <input
                            type="number"
                            min="0" max="30"
                            value={scrapeDelay}
                            onChange={(e) => setScrapeDelay(parseInt(e.target.value) || 0)}
                            style={{ margin: '0 1rem', padding: '0.5rem', width: '80px', borderRadius: '4px', border: '1px solid var(--border)' }}
                        />
                    </label>
                    <Button onClick={handleSaveSettings} disabled={savingSettings}>
                        {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                    </Button>
                </div>
            </div>

            <div className={styles.formBox}>
                <h2 className={styles.listTitle}>إضافة روابط جديدة للترجمة</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                    ألصق روابط مقالات Taste of Cinema هنا. (كل رابط في سطر منفصل)
                </p>

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

            <div className={styles.listContainer}>
                <h2 className={styles.listTitle}>سجل المعالجات</h2>

                {jobs.map(job => (
                    <div key={job.id} className={styles.batchItem}>
                        <div className={styles.batchHeader}>
                            <strong>المهمة #{job.id}</strong>
                            <Badge variant={
                                job.status === 'completed' ? 'success' :
                                    job.status === 'failed' ? 'danger' :
                                        job.status === 'pending' ? 'default' : 'gold'
                            }>
                                {STATUS_LABELS[job.status] ?? job.status}
                            </Badge>
                        </div>

                        <div className={styles.batchStatus}>
                            <span>الصور الموجودة: {job.imagesFound}</span>
                            <span>-</span>
                            <span style={{ color: 'var(--color-success)' }}>الصور المحملة بقاعدة البيانات: {job.imagesSaved}</span>
                            <span>-</span>
                            <span>الصفحات المعالجة: {job.pagesFound}</span>
                        </div>

                        <div className={styles.batchMeta}>
                            <div className={styles.metaUrl}>
                                URL: {job.targetUrl}
                            </div>
                            <div className={styles.metaDate} dir="rtl">
                                بدأ في: {formatJobDate(job.startedAt)}
                            </div>
                            {job.completedAt && (
                                <div className={styles.metaDate} dir="rtl">
                                    انتهى في: {formatJobDate(job.completedAt)}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {jobs.length === 0 && <p>لا توجد مهام سحب حالية.</p>}
            </div>
        </div>
    );
}
