import { forwardRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export interface Navigation {
  /** The current path, e.g. `/room/abc`. Query and hash are not included. */
  pathname: string;
  /** Go somewhere, leaving the current entry in the history. */
  push: (href: string) => void;
  /** Go somewhere, replacing the current entry — a redirect, not a step. */
  replace: (href: string) => void;
}

/**
 * The app's only way to move between screens.
 *
 * Which router draws the URL is the core's business, not a skin's: skins import
 * from `@/core` and nothing else, the same rule that keeps them from importing
 * each other. Routing them through here is what let the app move off Next
 * without touching eleven skins twice.
 */
export function useNavigation(): Navigation {
  const navigate = useNavigate();
  const location = useLocation();

  return {
    pathname: location.pathname,
    push: (href) => navigate(href),
    replace: (href) => navigate(href, { replace: true }),
  };
}

/**
 * A link to another screen. It stays a plain `<a>` — a real href is what makes
 * middle-click, "open in new tab" and the status bar work — so a skin can style
 * it as freely as any other element it draws.
 */
export const AppLink = forwardRef<
  HTMLAnchorElement,
  { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>
>(function AppLink({ href, children, ...rest }, ref) {
  // `#` is the skins' placeholder for a chat that has no room yet. Handing it
  // to the router would push a bogus entry, so it degrades to a dead anchor.
  if (href === '#') {
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link ref={ref} to={href} {...rest}>
      {children}
    </Link>
  );
});
