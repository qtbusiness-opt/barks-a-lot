// One inline-SVG icon set for the storefront: 24px grid, 2px round strokes,
// colour from currentColor so every icon follows the text/token around it.
// Decorative by default (aria-hidden); pass a `title` to give one a name.

function Icon({ title, className = "h-6 w-6", children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      focusable="false"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {children}
    </svg>
  );
}

export function PawIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="5.5" cy="11" r="1.75" />
      <circle cx="9" cy="6.5" r="1.75" />
      <circle cx="15" cy="6.5" r="1.75" />
      <circle cx="18.5" cy="11" r="1.75" />
      <path d="M12 12.5c-2.9 0-5.5 3-5.5 5.2 0 1.5 1.4 2.3 3 2.3 1 0 1.6-.4 2.5-.4s1.5.4 2.5.4c1.6 0 3-.8 3-2.3 0-2.2-2.6-5.2-5.5-5.2z" />
    </Icon>
  );
}

export function CalendarIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Icon>
  );
}

export function BagIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 8h14l-1 12H6L5 8z" />
      <path d="M9 8V6.5a3 3 0 016 0V8" />
    </Icon>
  );
}

export function LeafIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z" />
      <path d="M5 19c3-4 6-6.5 9-8" />
    </Icon>
  );
}

export function HeartIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.3a4.3 4.3 0 017.5 2.5C19.5 15.4 12 20 12 20z" />
    </Icon>
  );
}

export function ArrowRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function CheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function CrossIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}
