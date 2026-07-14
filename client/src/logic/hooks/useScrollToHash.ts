import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// React Router's <Link> intercepts the click and navigates client-side — it
// never triggers the browser's native scroll-to-#id behavior, so a hash link
// to a section on the target page needs to be handled manually.
export const useScrollToHash = () => {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    document
      .getElementById(location.hash.slice(1))
      ?.scrollIntoView({ behavior: "smooth" });
  }, [location.hash]);
};
