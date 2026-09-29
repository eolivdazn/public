export function SegmentedControl({ id, labelledBy, options, value, onChange, disabled }) {
  return (
    <div className="segmented-control" id={id} role="group" aria-labelledby={labelledBy}>
      {options.map((option) => {
        const isActive = String(value) === String(option.value);
        return (
          <button
            key={option.value}
            className={isActive ? "is-active" : ""}
            type="button"
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
