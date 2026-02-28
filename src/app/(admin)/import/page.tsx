'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import styles from './import.module.css';

interface Batch {
    id: number;
    source_url: string;
    total_articles: number;
    translated: number;
    failed: number;
    status: string;
    started_at: string;
    completed_at: string | null;
}

export default function AdminImportPage() {
    const [urlsInput, setUrlsInput] = useState('');
    const [batches, setBatches] = useState<Batch[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBatches = async () => {
        try {
            const res = await fetch('/api/import-batch');
            const data = await res.json();
            if (data.success) {
                setBatches(data.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchBatches();
        const interval = setInterval(fetchBatches, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = async () => {
        setError(null);
        const urls = urlsInput.split('\n').map(u => u.trim()).filter(u => u);

        if (urls.length === 0) {
            setError('يرجى إدخال رابط واحد على الأقل');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/import-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls }),
            });
            const data = await res.json();

            if (data.success) {
                setUrlsInput('');
                fetchBatches();
                alert('تم بدء الاستيراد. يتم الترجمة في الخلفية.');
            } else {
                setError(data.error);
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
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'جاري البدء...' : 'بدء الترجمة والمعالجة'}
                    </Button>
                </div>
            </div>

            <div className={styles.listContainer}>
                <h2 className={styles.listTitle}>سجل المعالجات</h2>

                {batches.map(batch => (
                    <div key={batch.id} className={styles.batchItem}>
                        <div className={styles.batchHeader}>
                            <strong>الدفعة #{batch.id}</strong>
                            <Badge variant={
                                batch.status === 'completed' ? 'success' :
                                    batch.status === 'failed' ? 'danger' :
                                        batch.status === 'processing' ? 'gold' : 'default'
                            }>
                                {batch.status}
                            </Badge>
                        </div>

                        <div className={styles.batchStatus}>
                            <span>الروابط المُرسلة: {batch.total_articles}</span>
                            <span>-</span>
                            <span style={{ color: 'var(--color-success)' }}>المترجمة بنجاح: {batch.translated}</span>
                            <span>-</span>
                            <span style={{ color: 'var(--color-danger)' }}>الفاشلة: {batch.failed}</span>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'left' }}>
                            Base URL: {batch.source_url}
                            <br />
                            Started: {new Date(batch.started_at).toLocaleString('ar-AR')}
                        </div>
                    </div>
                ))}

                {batches.length === 0 && <p>لا توجد دفعات حالية.</p>}
            </div>
        </div>
    );
}
