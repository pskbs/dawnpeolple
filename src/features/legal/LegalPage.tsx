import { AppBar } from '../../components/ui'
import { LEGAL_COPY } from '../../config/copy'
import { MARKETING, PRIVACY, TERMS, type LegalDoc } from '../../config/legal'
import './LegalPage.css'

export function LegalDocView({ doc }: { doc: LegalDoc }) {
  return (
    <article className="legal-doc">
      <p className="legal-doc__draft">{doc.draftNotice}</p>
      <p className="legal-doc__version">{LEGAL_COPY.version(doc.version, doc.effectiveDate)}</p>
      {doc.intro && <p className="legal-doc__intro">{doc.intro}</p>}
      {doc.articles.map((a) => (
        <section key={a.title} className="legal-doc__article">
          <h3>{a.title}</h3>
          {a.blocks.map((b, i) =>
            typeof b === 'string' ? (
              <p key={i}>{b}</p>
            ) : (
              <ol key={i}>
                {b.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            ),
          )}
        </section>
      ))}
    </article>
  )
}

// /terms, /privacy, /marketing — 앱인토스 콘솔에 등록할 공개 URL로도 써요(로그인 없이 열람).
export function LegalPage({ kind }: { kind: 'terms' | 'privacy' | 'marketing' }) {
  const doc = kind === 'terms' ? TERMS : kind === 'privacy' ? PRIVACY : MARKETING
  return (
    <section className="legal-page">
      <AppBar back title={doc.title} />
      <div className="sheet legal-sheet">
        <LegalDocView doc={doc} />
      </div>
    </section>
  )
}
