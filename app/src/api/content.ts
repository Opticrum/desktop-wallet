// HTTP content domain — the app marketplace's content-type data
// (apps / banners / news / changelogs).
//
// Per `docs/ipc/ipc-api.md` §2.2 this is the **fetch boundary**, not IPC: these
// are content-shaped records served from a remote directory. `DIRECTORY_URL`
// is the mock → real catalog toggle; while `null`, the embedded datasets in
// `app/src/content/` are returned.

import { apps, banners, type MarketApp, type MarketBanner } from '../content/apps'
import { news, type NewsItem } from '../content/news'
import { changelogs, type ChangelogItem } from '../content/changelogs'

/** Remote directory base URL. Set to a real catalog to fetch over HTTP. */
const DIRECTORY_URL: string | null = null

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  if (!DIRECTORY_URL) return fallback
  try {
    const res = await fetch(`${DIRECTORY_URL}/${path}`)
    if (!res.ok) return fallback
    return (await res.json()) as T
  } catch {
    return fallback
  }
}

export const content = {
  getApps: () => fetchJson<MarketApp[]>('apps.json', apps),
  getBanners: () => fetchJson<MarketBanner[]>('banners.json', banners),
  getNews: () => fetchJson<NewsItem[]>('news.json', news),
  getChangelogs: () => fetchJson<ChangelogItem[]>('changelogs.json', changelogs),
}
