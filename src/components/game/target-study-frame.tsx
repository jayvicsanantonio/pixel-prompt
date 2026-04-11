import styles from "./target-study-frame.module.css";

interface TargetStudyFrameProps {
  ariaLabel: string;
  className?: string;
  expanded?: boolean;
}

export function TargetStudyFrame({ ariaLabel, className, expanded = false }: TargetStudyFrameProps) {
  return (
    <div
      className={[styles.frame, expanded ? styles.expanded : "", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel}
    >
      <div className={styles.wall} />
      <div className={styles.table} />
      <div className={styles.cloth} />
      <div className={styles.bottle} />
      <div className={styles.plate} />
      <div className={styles.pearLeft} />
      <div className={styles.pearRight} />
    </div>
  );
}
