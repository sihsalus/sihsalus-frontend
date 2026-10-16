import type { ReactNode } from "react";
import styles from "./dashboard.scss";

export function ConfigurationTile({
  icon,
  children,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.configurationTile}
      onClick={onClick}
    >
      <span className={styles.configurationIcon} aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </button>
  );
}
