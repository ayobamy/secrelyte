export function LightField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[40rem] overflow-hidden"
    >
      <div className="light-wash absolute inset-0" />
      <div className="light-ray" />
    </div>
  );
}
