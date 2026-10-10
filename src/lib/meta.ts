import { useEffect } from 'react';

/** Keep <title>, the description and the canonical link in step with the page (crawlers and share sheets read them). */
export function useDocumentMeta(opts: { title: string; description: string; path: string }) {
  const { title, description, path } = opts;
  useEffect(() => {
    document.title = title;
    const setMeta = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLElement>(selector);
      if (!el) { el = create(); document.head.appendChild(el); }
      el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), 'content', description);
    setMeta('meta[property="og:title"]', () => { const m = document.createElement('meta'); m.setAttribute('property', 'og:title'); return m; }, 'content', title);
    setMeta('meta[property="og:description"]', () => { const m = document.createElement('meta'); m.setAttribute('property', 'og:description'); return m; }, 'content', description);
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', `${window.location.origin}${path}`);
  }, [title, description, path]);
}
