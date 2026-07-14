import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// BrowserRouter navigations don't reload the page, so the browser never
// resets scroll position on its own — without this, a new route renders
// wherever the previous page happened to be scrolled to.
export const useScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // A hash means this navigation is deep-linking to a section — that's
    // useScrollToHash's job, not this hook's, so don't fight it.
    if (hash) return;
    window.scrollTo(0, 0);
    // Intentionally keyed on pathname only, not hash — a hash-only change
    // (e.g. clicking an in-page anchor) shouldn't reset scroll to top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
};
