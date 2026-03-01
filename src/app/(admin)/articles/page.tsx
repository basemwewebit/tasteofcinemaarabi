'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage, parseResponseJson } from '@/lib/http/response';
import { ArticleMetadata } from '@/types/article';
import styles from './articles.module.css';

export default function AdminArticlesPage() {
    const [articles, setArticles] = useState<ArticleMetadata[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchArticles = async () => {
        try {
            const res = await fetch('/api/articles');
            const { data, rawText } = await parseResponseJson<{ success?: boolean; data?: ArticleMetadata[] }>(res);
            if (res.ok && data?.success && Array.isArray(data.data)) {
                setArticles(data.data);
            } else {
                console.error(getApiErrorMessage(res, data, rawText));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchArticles();
    }, []);

    const handleDelete = async (id?: number) => {
        if (!id || !confirm('هل أنت متأكد من حذف هذا المقال بصورة نهائية؟')) return;

        try {
            const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
            const { data, rawText } = await parseResponseJson<{ success?: boolean; error?: string }>(res);
            if (res.ok && data?.success) {
                setArticles(articles.filter(a => a.id !== id));
            } else {
                alert(getApiErrorMessage(res, data, rawText));
            }
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء الحذف');
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>إدارة المقالات</h1>
                <Link href="/import">
                    <Button variant="primary">استيراد جديد</Button>
                </Link>
            </header>

            {loading ? (
                <p>جاري التحميل...</p>
            ) : (
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>العنوان</th>
                                <th>التصنيف</th>
                                <th>الحالة</th>
                                <th>التاريخ</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {articles.map(article => (
                                <tr key={article.id}>
                                    <td>
                                        <strong>{article.title_ar}</strong>
                                    </td>
                                    <td>{article.category}</td>
                                    <td>
                                        <Badge variant={article.status === 'published' ? 'success' : 'default'}>
                                            {article.status === 'published' ? 'منشور' : 'مسودة'}
                                        </Badge>
                                    </td>
                                    <td>
                                        {new Date(article.created_at || '').toLocaleDateString('ar-AR')}
                                    </td>
                                    <td className={styles.actions}>
                                        <Link href={`/articles/${article.id}/edit`} className={styles.link}>
                                            تحرير
                                        </Link>
                                        <span>|</span>
                                        <button onClick={() => handleDelete(article.id)} className={styles.deleteBtn}>
                                            حذف
                                        </button>
                                        <span>|</span>
                                        <Link href={`/article/${article.slug}`} className={styles.link} target="_blank">
                                            معاينة
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {articles.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center' }}>
                                        لا توجد مقالات حتى الآن
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
