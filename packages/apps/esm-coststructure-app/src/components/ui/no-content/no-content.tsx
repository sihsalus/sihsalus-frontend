import styles from './styles.scss';

interface Props {
  title: string;
  message: string;
}
export default function NoContent({ title, message }: Props) {
  return (
    <div className={styles['empty-state-message']}>
      <p>{title}</p>
      <p>{message}</p>
    </div>
  );
}
