export function FinanceList({ items, compact, className }) {
  const classes = ["finance-list", compact ? "compact" : null, className].filter(Boolean).join(" ");

  return (
    <ul className={classes}>
      {items.map((item) => (
        <li key={item.key}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </li>
      ))}
    </ul>
  );
}
