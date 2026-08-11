import { useState, type ReactNode } from 'react'
import { useLocale } from '../../i18n/LocaleContext'

// ── Icons (1.7px stroke inline SVG, no emoji) ───────────────────────────────

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function IconClose() {
  return (
    <IconBase>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </IconBase>
  )
}

export function IconChevron() {
  return (
    <IconBase>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  )
}

export function IconGlobe() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" />
    </IconBase>
  )
}

export function IconCode() {
  return (
    <IconBase>
      <path d="m8 6-6 6 6 6" />
      <path d="m16 6 6 6-6 6" />
    </IconBase>
  )
}

export function IconShield() {
  return (
    <IconBase>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </IconBase>
  )
}

export function IconTerminal() {
  return (
    <IconBase>
      <path d="m4 7 4 4-4 4" />
      <path d="M12 15h8" />
    </IconBase>
  )
}

export function IconLink() {
  return (
    <IconBase>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </IconBase>
  )
}

export function IconLayers() {
  return (
    <IconBase>
      <path d="m12 2 8 4.5-8 4.5-8-4.5L12 2z" />
      <path d="m4 12 8 4.5 8-4.5" />
      <path d="m4 16.5 8 4.5 8-4.5" />
    </IconBase>
  )
}

export function IconSliders() {
  return (
    <IconBase>
      <path d="M4 21v-7" />
      <path d="M4 10V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M20 21v-5" />
      <path d="M20 12V3" />
      <path d="M2 14h4" />
      <path d="M10 8h4" />
      <path d="M18 16h4" />
    </IconBase>
  )
}

// ── Section shell ───────────────────────────────────────────────────────────

export function Section({
  title,
  icon,
  children,
  disabled,
}: {
  title: ReactNode
  icon?: ReactNode
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <section className={`config-section${disabled ? ' is-disabled' : ''}`}>
      <div className="config-section-title">
        {icon && <span className="config-section-icon">{icon}</span>}
        {title}
      </div>
      {disabled ? (
        <fieldset className="config-section-body" disabled>
          {children}
        </fieldset>
      ) : (
        <div className="config-section-body">{children}</div>
      )}
    </section>
  )
}

// ── Form primitives ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="config-url-row">
      <label className="config-url-label">{label}</label>
      {children}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  mono,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  mono?: boolean
  placeholder?: string
}) {
  return (
    <Field label={label}>
      <input
        className={`config-url-input${mono ? ' mono' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
    </Field>
  )
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <Field label={label}>
      <input
        className="config-url-input"
        type="text"
        inputMode="decimal"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value.replace(/,/g, '')))}
        spellCheck={false}
      />
    </Field>
  )
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <Field label={label}>
      <select className="select-mini config-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function ToggleRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string
  desc?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="config-toggle-row">
      <span className="config-row-label">
        <span className="config-row-title">{title}</span>
        {desc && <span className="config-row-desc">{desc}</span>}
      </span>
      <span className="config-switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="config-switch-track">
          <span className="config-switch-thumb" />
        </span>
      </span>
    </label>
  )
}

export function CheckGrid({
  options,
  selected,
  onToggle,
  mono,
}: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  mono?: boolean
}) {
  return (
    <div className="config-check-grid">
      {options.map((v) => {
        const on = selected.includes(v)
        return (
          <button
            key={v}
            type="button"
            className={`chip${on ? ' active' : ''}`}
            onClick={() => onToggle(v)}
            aria-pressed={on}
          >
            {mono ? <span className="mono">{v}</span> : v}
          </button>
        )
      })}
    </div>
  )
}

/** List editor for a repeated string value (bootnode / announced addresses). */
export function TagEditor({
  label,
  items,
  onAdd,
  onRemove,
  placeholder,
  disabled,
}: {
  label: string
  items: string[]
  onAdd: (v: string) => void
  onRemove: (v: string) => void
  placeholder: string
  disabled?: boolean
}) {
  const { t } = useLocale()
  const [draft, setDraft] = useState('')

  const add = () => {
    if (disabled) return
    const v = draft.trim()
    if (!v) return
    onAdd(v)
    setDraft('')
  }

  return (
    <div className={`config-tag-editor${disabled ? ' is-disabled' : ''}`}>
      <label className="config-url-label">{label}</label>
      {items.length > 0 && (
        <div className="config-tag-list">
          {items.map((v) => (
            <span key={v} className="config-tag mono">
              {v}
              <button type="button" aria-label={t.cfgRemove} onClick={() => onRemove(v)} disabled={disabled}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="config-tag-input-row">
        <input
          className="config-url-input mono"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          spellCheck={false}
        />
        <button type="button" className="btn-secondary" onClick={add} disabled={disabled}>
          {t.cfgAddAddr}
        </button>
      </div>
    </div>
  )
}

/** An editable repeated card (contract script / UDT whitelist entry). */
export function ItemCard({
  head,
  onRemove,
  children,
}: {
  head: ReactNode
  onRemove: () => void
  children: ReactNode
}) {
  const { t } = useLocale()
  return (
    <div className="config-item-card">
      <div className="config-item-head">
        <div className="config-item-head-left">{head}</div>
        <button type="button" className="config-item-remove" aria-label={t.cfgRemove} onClick={onRemove}>
          ×
        </button>
      </div>
      <div className="config-item-grid">{children}</div>
    </div>
  )
}
