export function FormField({ label, full, children }) {
  return (
    <label className={`expense-field${full ? " expense-field-full" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
