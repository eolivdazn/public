import { formatCurrency } from "../lib/format.js";

// On phones each row collapses into a card; data-label feeds the inline labels (see .trips-table in styles.css).
export function TripsTable({ trips, year, fallbackCurrency }) {
  return (
    <table className="trips-table">
      <thead>
        <tr>
          <th scope="col">Trip</th>
          <th scope="col">Dates</th>
          <th scope="col" className="is-numeric">Days</th>
          <th scope="col" className="is-numeric">Spend</th>
          <th scope="col" className="is-numeric">Per person</th>
          <th scope="col">Cities</th>
        </tr>
      </thead>
      <tbody>
        {(trips || []).map((trip) => {
          const currency = trip.expenses?.baseCurrency || fallbackCurrency;
          return (
            <tr key={`${year}-${trip.slug}`}>
              <th scope="row" data-label="Trip">
                <a href={`../${trip.slug}.html`}>{trip.title}</a>
              </th>
              <td data-label="Dates">
                {trip.startDate} → {trip.endDate}
              </td>
              <td data-label="Days in year" className="is-numeric num">
                {trip.vacationDays}
              </td>
              <td data-label="Spend" className="is-numeric num">
                {formatCurrency(trip.expenses?.total || 0, currency)}
              </td>
              <td data-label="Per person" className="is-numeric num">
                {formatCurrency(trip.expenses?.totalPerPerson || 0, currency)}
              </td>
              <td data-label="Cities">{(trip.cities || []).join(", ")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
