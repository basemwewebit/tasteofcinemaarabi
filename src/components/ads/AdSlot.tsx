'use client';

import { useEffect, useRef } from 'react';
import styles from './AdSlot.module.css';

interface AdSlotProps {
    slot: string;
    variant?: 'horizontal' | 'rectangle';
    className?: string;
}

export function AdSlot({ slot, variant = 'horizontal', className = '' }: AdSlotProps) {
    const adRef = useRef<HTMLModElement>(null);

    useEffect(() => {
        try {
            const win = window as unknown as { adsbygoogle?: unknown[] };
            if (typeof window !== 'undefined' && win.adsbygoogle) {
                // Prevent pushing multiple times per element
                if (adRef.current && adRef.current.getAttribute('data-adsbygoogle-status') !== 'done') {
                    win.adsbygoogle.push({});
                }
            }
        } catch (err) {
            console.error('AdSense push failed', err);
        }
    }, []);

    // For development (if no adsense id), we just show the placeholder natively
    const isDev = process.env.NODE_ENV === 'development';

    return (
        <div className={`${styles.adContainer} ${styles[variant]} ${className}`}>
            {!isDev && (
                <ins
                    ref={adRef}
                    className={`adsbygoogle ${styles.adContent}`}
                    style={{ display: 'block' }}
                    data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_ID || 'ca-pub-000000000'}
                    data-ad-slot={slot}
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                />
            )}
        </div>
    );
}
