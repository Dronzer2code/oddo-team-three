/**
 * Wordmark. The reference sets a light lowercase logotype with a small
 * registered mark raised at the shoulder; that is reproduced in type rather
 * than as an image so it stays crisp and recolours with the surface.
 */
export function Brand({ ink = false, href = '#top' }: { ink?: boolean; href?: string }) {
  return (
    <a className={ink ? 'brand brand--ink' : 'brand'} href={href} aria-label="RideSync home">
      <span className="brand__name">ridesync</span>
      <span className="brand__reg" aria-hidden="true">
        ®
      </span>
    </a>
  );
}
