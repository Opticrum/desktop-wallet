import { useEffect, useState } from 'react'
import { banners } from '../mock/apps'
import { useLocale } from '../i18n/LocaleContext'

export function Banner() {
  const { locale } = useLocale()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => setI((x) => (x + 1) % banners.length), 4000)
    return () => window.clearInterval(id)
  }, [paused])

  const slide = banners[i]

  return (
    <section
      className="banner"
      style={{ ['--banner-accent' as string]: slide.accent }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="banner-accent-strip" style={{ background: slide.accent }} />
      <h1>{locale === 'zh' ? slide.titleZh : slide.titleEn}</h1>
      <p>{locale === 'zh' ? slide.subtitleZh : slide.subtitleEn}</p>
      <div className="banner-dots">
        {banners.map((b, idx) => (
          <button
            key={b.id}
            type="button"
            aria-label={`banner ${idx + 1}`}
            className={idx === i ? 'active' : ''}
            onClick={() => setI(idx)}
          />
        ))}
      </div>
    </section>
  )
}
