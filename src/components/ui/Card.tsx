import { HTMLAttributes, forwardRef } from 'react';
import styles from './Card.module.css';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className = '', children, ...props }, ref) => {
        return (
            <div ref={ref} className={`${styles.card} ${className}`} {...props}>
                {children}
            </div>
        );
    }
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className = '', children, ...props }, ref) => {
        return (
            <div ref={ref} className={`${styles.cardHeader} ${className}`} {...props}>
                {children}
            </div>
        );
    }
);
CardHeader.displayName = 'CardHeader';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className = '', children, ...props }, ref) => {
        return (
            <div ref={ref} className={`${styles.cardContent} ${className}`} {...props}>
                {children}
            </div>
        );
    }
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className = '', children, ...props }, ref) => {
        return (
            <div ref={ref} className={`${styles.cardFooter} ${className}`} {...props}>
                {children}
            </div>
        );
    }
);
CardFooter.displayName = 'CardFooter';
