import Link from "next/link";
import styles from "./management-back-button.module.css";

type BackButtonProps = { label?: string } & (
  | { href: string; onClick?: never; disabled?: never }
  | { href?: never; onClick: () => void; disabled?: boolean }
);

export function ManagementBackButton({ label = "Quay lại", href, onClick, disabled }: BackButtonProps) {
  const className = styles.back;
  const content = <><i className="isax isax-arrow-left" aria-hidden="true" />{label}</>;

  return href !== undefined ? (
    <Link href={href} prefetch={false} className={className}>{content}</Link>
  ) : (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>{content}</button>
  );
}
