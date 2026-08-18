import { useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'

type Section = { title: string; lines: string[] }

/** A lead paragraph + titled bullet sections — reused by every help tab. */
function HelpSections({ lead, sections }: { lead: string; sections: Section[] }) {
  return (
    <div className="help-sections">
      <p className="help-lead">{lead}</p>
      {sections.map((s) => (
        <section key={s.title} className="help-section">
          <h4 className="help-section-title">{s.title}</h4>
          <ul className="help-section-list">
            {s.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

const TABS = ['helpTabProtocol', 'helpTabBuyer', 'helpTabSeller'] as const

/**
 * Help dialog — explains the Opticrum protocol and usage from three angles
 * (protocol / buyer / seller). Opened from the top bar's "关于" button.
 */
export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale()
  const [tab, setTab] = useState(0)

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal help-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t.helpTitle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">{t.helpTitle}</div>

        <div className="help-tabs" role="tablist" aria-label={t.helpTitle}>
          {TABS.map((key, i) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === i}
              className={tab === i ? 'help-tab is-active' : 'help-tab'}
              onClick={() => setTab(i)}
            >
              {t[key]}
            </button>
          ))}
        </div>

        {/* key={tab} remounts the body so the switch cross-fades in */}
        <div className="help-body" key={tab}>
          {tab === 0 && (
            <HelpSections
              lead={t.hpLead}
              sections={[
                { title: t.hpS1Title, lines: [t.hpS1a, t.hpS1b, t.hpS1c] },
                { title: t.hpS2Title, lines: [t.hpS2a, t.hpS2b] },
              ]}
            />
          )}
          {tab === 1 && (
            <HelpSections
              lead={t.hbLead}
              sections={[
                { title: t.hbS1Title, lines: [t.hbS1a, t.hbS1b] },
                { title: t.hbS2Title, lines: [t.hbS2a, t.hbS2b] },
              ]}
            />
          )}
          {tab === 2 && (
            <HelpSections
              lead={t.hsLead}
              sections={[
                { title: t.hsS1Title, lines: [t.hsS1a] },
                { title: t.hsS2Title, lines: [t.hsS2a, t.hsS2b] },
              ]}
            />
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
