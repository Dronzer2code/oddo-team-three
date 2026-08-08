/**
 * Five-star rating mark. Drawn as SVG rather than a star glyph so it renders
 * identically everywhere, inherits the surrounding colour, and does not depend
 * on a font subset that may not carry the character.
 */
export function Stars({ size = 18, count = 5 }: { size?: number; count?: number }) {
  return (
    <span className="rating__stars" role="img" aria-label={`${count} out of 5`}>
      {Array.from({ length: count }).map((_, index) => (
        <svg
          key={index}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2.4l2.9 6.2 6.8.8-5 4.6 1.3 6.7-6-3.4-6 3.4 1.3-6.7-5-4.6 6.8-.8z" />
        </svg>
      ))}
    </span>
  );
}
