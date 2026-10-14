import type { ReactNode } from "react";
import styles from "./dashboard.scss";

/** Carbon hides validation for disabled controls, whose derived values can still be invalid. */
export function FieldError({ message }: { message?: ReactNode }) {
  return message ? (
    <p role="alert" className={styles.fieldError}>
      {message}
    </p>
  ) : null;
}
