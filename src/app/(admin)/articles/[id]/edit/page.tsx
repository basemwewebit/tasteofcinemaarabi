'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Article } from '@/types/article';
import styles from './edit.module.css';

export default function ArticleEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [formData, setFormData] = useState<Partial<Article>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchArticle() {
            try {
                const res = await fetch(`/api/articles/${id}`);
                const data = await res.json();
                if (data.success) {
                    setFormData(data.data);
                } else {
                    setError(data.error);
                }
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Error fetching article');
            } finally {
                setLoading(false);
            }
        }
        fetchArticle();
    }, [id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (status: 'draft' | 'published' = 'draft') => {
        setSaving(true);
        setError(null);
        try {
            const payload = { ...formData, status };
            const res = await fetch(`/api/articles/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                alert('تم الحفظ بنجاح');
                if (status === 'published') {
                    router.push('/articles');
                }
            } else {
                setError(data.error);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error saving article');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className={styles.container}>جاري التنزيل...</div>;
    if (error && !formData.id) return <div className={styles.container}>خطأ: {error}</div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>تحرير المقال</h1>
                <div className={styles.actions}>
                    <Button variant="secondary" onClick={() => router.push('/articles')}>
                        إلغاء
                    </Button>
                    <Button variant="secondary" onClick={() => handleSave('draft')} disabled={saving}>
                        حفظ مسودة
                    </Button>
                    <Button variant="primary" onClick={() => handleSave('published')} disabled={saving}>
                        {saving ? 'جاري النشر...' : 'حفظ ونشر'}
                    </Button>
                </div>
            </header>

            {error && <div style={{ color: 'var(--color-danger)' }}>{error}</div>}

            <div className={styles.form}>
                <div className={styles.fieldGroup}>
                    <label className={styles.label}>العنوان (عربي)</label>
                    <input
                        className={styles.input}
                        name="title_ar"
                        value={formData.title_ar || ''}
                        onChange={handleChange}
                        dir="rtl"
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label className={styles.label}>العنوان (إنجليزي) اختياري</label>
                    <input
                        className={styles.input}
                        name="title_en"
                        value={formData.title_en || ''}
                        onChange={handleChange}
                        dir="ltr"
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label className={styles.label}>رابط المقال (Slug)</label>
                    <input
                        className={styles.input}
                        name="slug"
                        value={formData.slug || ''}
                        onChange={handleChange}
                        dir="ltr"
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label className={styles.label}>الوصف/المقتطف</label>
                    <textarea
                        className={`${styles.textarea}`}
                        style={{ minHeight: '100px' }}
                        name="excerpt_ar"
                        value={formData.excerpt_ar || ''}
                        onChange={handleChange}
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label className={styles.label}>التصنيف</label>
                    <input
                        className={styles.input}
                        name="category"
                        value={formData.category || ''}
                        onChange={handleChange}
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label className={styles.label}>محتوى المقال (MDX)</label>
                    <textarea
                        className={styles.textarea}
                        name="content"
                        value={formData.content || ''}
                        onChange={handleChange}
                    />
                </div>
            </div>
        </div>
    );
}
