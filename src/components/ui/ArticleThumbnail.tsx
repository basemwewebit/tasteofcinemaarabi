'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './ArticleThumbnail.module.css';

interface ArticleThumbnailProps {
    src: string;
    alt: string;
}

export function ArticleThumbnail({ src, alt }: ArticleThumbnailProps) {
    const [hasError, setHasError] = useState(false);

    if (hasError) return null;

    return (
        <div className={styles.thumbnailWrapper}>
            <Image
                src={src}
                alt={`صورة غلاف مقال: ${alt}`}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 800px"
                className={styles.thumbnailImage}
                onError={() => setHasError(true)}
            />
        </div>
    );
}
