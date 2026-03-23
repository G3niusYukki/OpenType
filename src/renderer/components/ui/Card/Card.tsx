import { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  className?: string;
  glass?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

export function Card({ children, className, glass = false, padding = 'md' }: CardProps) {
  const classes = [
    styles.card,
    glass && styles.glass,
    styles[`padding-${padding}`],
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes}>{children}</div>;
}
