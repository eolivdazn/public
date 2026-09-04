const STAR_POSITIONS = [1, 2, 3, 4, 5];

export function StarRating({ value = 0, onChange = () => {}, disabled }) {
  const safeValue = value || 0;

  return (
    <div className={`star-rating${!disabled ? " star-rating--interactive" : ""}`} role="radiogroup" aria-label="Rating">
      {STAR_POSITIONS.map((star) => {
        const fillPercent = Math.max(0, Math.min(1, safeValue - (star - 1))) * 100;
        return (
          <span className="star-rating-item" key={star}>
            <span className="star-rating-empty" aria-hidden="true">
              ★
            </span>
            <span className="star-rating-filled" aria-hidden="true" style={{ width: `${fillPercent}%` }}>
              ★
            </span>
            {!disabled ? (
              <>
                <button
                  type="button"
                  className="star-rating-half star-rating-half-left"
                  aria-label={`${star - 0.5} stars`}
                  onClick={() => onChange(safeValue === star - 0.5 ? 0 : star - 0.5)}
                />
                <button
                  type="button"
                  className="star-rating-half star-rating-half-right"
                  aria-label={`${star} stars`}
                  onClick={() => onChange(safeValue === star ? 0 : star)}
                />
              </>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
