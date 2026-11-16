'use client';

import { useEffect, useRef } from 'react';

/**
 * Holds the browser tab's title at `title` while the caller is mounted.
 *
 * Next writes the route's metadata `<title>` itself, and on a client
 * navigation it can do so after the new page has mounted and set its own
 * title, which left the game tab reading the landing page's title until the
 * next state change. So this watches `<head>` and puts the title back
 * whenever something else changes it. `null` lets go without touching it.
 */
export function useDocumentTitle(title: string | null) {
  const wanted = useRef<string | null>(null);

  useEffect(() => {
    wanted.current = title;
    if (title !== null && document.title !== title) document.title = title;
  }, [title]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const want = wanted.current;
      if (want !== null && document.title !== want) document.title = want;
    });
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      wanted.current = null;
    };
  }, []);
}
