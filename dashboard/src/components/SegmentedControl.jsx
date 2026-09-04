export function SegmentedControl({ id, options, value, onChange, disabled }) {
  return (
    <div className="segmented-control" id={id}>
      {options.map((option) => (
        <button
          key={option.value}
          className={String(value) === String(option.value) ? "is-active" : ""}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
