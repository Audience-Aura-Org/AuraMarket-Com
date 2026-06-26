"use client";

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Password field with show/hide toggle.
 * Pass `icon` + `iconClassName` for left-icon layouts (e.g. UnifiedAuth).
 */
export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Enter password',
  required = false,
  disabled = false,
  className = '',
  icon: Icon = null,
  iconClassName = 'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]',
  id,
  name,
  autoComplete,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative group">
      {Icon && <Icon className={iconClassName} />}
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        required={required}
        disabled={disabled}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={className}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center size-9 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/60 transition-all disabled:opacity-40 ${Icon ? 'right-2' : 'right-1'}`}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
