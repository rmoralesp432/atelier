/** ATELIER's single-stroke architectural monogram, shared by both entrances. */
export default function BrandMark() {
  return (
    <svg
      className="atelier-mark"
      viewBox="0 0 36 36"
      width="36"
      height="36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 31 18 5 31 31M10 23 24 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
