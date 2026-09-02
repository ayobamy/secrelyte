type MarkProps = {
  size?: number;
  title?: string;
};

export function Mark({ size = 28, title = 'Secrelyte' }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d="M16 4 L16 12" stroke="#F5B32E" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 12 L7 22" stroke="#0E1116" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 12 L16 24" stroke="#0E1116" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 12 L25 22" stroke="#0E1116" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="12" r="2.2" fill="#F5B32E" />
    </svg>
  );
}
