import { formatCurrency } from "../lib/format.js";

export function TripsTable({ trips, year, fallbackCurrency }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Trip</th>
            <th>Dates</th>
            <th>Days in year</th>
            <th>Spend</th>
            <th>Per person</th>
            <th>Cities</th>
          </tr>
        </thead>
        <tbody>
          {(trips || []).map((trip) => (
            <tr key={`${year}-${trip.slug}`}>
              <td>
                <a href={`../${trip.slug}.html`}>{trip.title}</a>
              </td>
              <td>
                {trip.startDate} to {trip.endDate}
              </td>
              <td>{trip.vacationDays}</td>
              <td>{formatCurrency(trip.expenses?.total || 0, trip.expenses?.baseCurrency || fallbackCurrency)}</td>
              <td>{formatCurrency(trip.expenses?.totalPerPerson || 0, trip.expenses?.baseCurrency || fallbackCurrency)}</td>
              <td>{(trip.cities || []).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
