"use client";
import styles from './AdminFinance.module.css';

export function FinanceTable({ children }) {
  return <div className={styles.tableScroll} tabIndex={0} aria-label="Financial records">
    <table className={styles.recordTable}>
      <thead><tr><th scope="col">Account / details</th><th scope="col">Reference / information</th><th scope="col">Status</th><th scope="col">Amount</th><th scope="col">Date</th><th scope="col">Actions</th></tr></thead>
      {children}
    </table>
  </div>;
}

export default function FinanceEntry({ icon, title, description, reference, amount, date, status, tone = 'neutral', meta, expandable, expanded = false, onOpen, controls, actions, children }) {
  return <tbody className={styles.entry} data-tone={tone}>
    <tr>
      <td><div className={styles.tableIdentity}>{icon && <span className={styles.entryIcon}>{icon}</span>}<div><p className={styles.entryTitle}>{title}</p>{description && <p className={styles.entryDescription}>{description}</p>}</div></div></td>
      <td>{reference && <p className={styles.entryReference}>{reference}</p>}{meta && <div className={styles.entryMeta}>{meta}</div>}{!reference && !meta && <span aria-label="Not available">&mdash;</span>}</td>
      <td>{status && <span className={styles.entryStatus}>{status}</span>}</td>
      <td className={styles.tableAmount}>{amount}</td>
      <td><time className={styles.entryDate}>{date || '\u2014'}</time></td>
      <td>{actions || (onOpen && <button type="button" className={styles.button} onClick={onOpen} aria-label={'View record for ' + title} aria-expanded={expandable ? expanded : undefined} aria-controls={controls}>{expanded ? 'Close' : 'View'}</button>)}</td>
    </tr>
    {children && <tr className={styles.tableDetails}><td colSpan={6}>{children}</td></tr>}
  </tbody>;
}
