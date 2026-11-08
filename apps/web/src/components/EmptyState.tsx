/**
 * Shared empty / first-run block for tabs without data.
 */
type Props = {
  title: string;
  children: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondary?: React.ReactNode;
};

export function EmptyState({
  title,
  children,
  primaryLabel = "Carica CSV",
  onPrimary,
  secondary,
}: Props) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <div className="muted">{children}</div>
      {onPrimary && (
        <button type="button" className="btn primary" onClick={onPrimary}>
          {primaryLabel}
        </button>
      )}
      {secondary}
    </div>
  );
}
