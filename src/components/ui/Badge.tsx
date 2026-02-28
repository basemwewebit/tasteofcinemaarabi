import { HTMLAttributes, forwardRef } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'gold' | 'danger' | 'success';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className = '', variant = 'default', children, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={`${styles.badge} ${styles[variant]} ${className}`}
                {...props}
            >
                {children}
            </span>
        );
    }
);
Badge.displayName = 'Badge';
