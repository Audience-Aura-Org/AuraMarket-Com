"use client";
import styles from './AdminFinance.module.css';

export function FinanceTable({ children, columns = ['Account / details', 'Reference / information', 'Status', 'Amount', 'Date', 'Actions'], label = 'Financial records' }) {
  return <div className={styles.tableScroll} tabIndex={0} aria-label={label}>
    <p className={styles.tableHint}>Swipe horizontally to see all columns <span aria-hidden="true">&#8596;</span></p>
    <table className={styles.recordTable} data-columns={columns.length}>
      <thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      {children}
    </table>
  </div>;
}

export default function FinanceEntry({ icon, title, description, reference, amount, date, status, tone = 'neutral', meta, expandable, expanded = false, onOpen, controls, actions, children, showActions = true }) {
  return <tbody className={styles.entry} data-tone={tone}>
    <tr>
      <td><div className={styles.tableIdentity}>{icon && <span className={styles.entryIcon}>{icon}</span>}<div><p className={styles.entryTitle}>{title}</p>{description && <p className={styles.entryDescription}>{description}</p>}</div></div></td>
      <td>{reference && <p className={styles.entryReference}>{reference}</p>}{meta && <div className={styles.entryMeta}>{meta}</div>}{!reference && !meta && <span aria-label="Not available">&mdash;</span>}</td>
      <td>{status && <span className={styles.entryStatus}>{status}</span>}</td>
      <td className={styles.tableAmount}>{amount}</td>
      <td><time className={styles.entryDate}>{date || '\u2014'}</time></td>
      {showActions && <td>{actions || (onOpen && <button type="button" className={styles.button} onClick={onOpen} aria-label={'View record for ' + title} aria-expanded={expandable ? expanded : undefined} aria-controls={controls}>{expanded ? 'Close' : 'View'}</button>)}</td>}
    </tr>
    {children && <tr className={styles.tableDetails}><td colSpan={showActions ? 6 : 5}>{children}</td></tr>}
  </tbody>;
}
