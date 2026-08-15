/**
 * The chat list is drawn by the skin, which the root layout mounts once for
 * every route. This page exists so `/` resolves — it deliberately renders
 * nothing, because rendering the skin here would tear it down on every
 * navigation to a room.
 */
export default function HomePage() {
  return null;
}
