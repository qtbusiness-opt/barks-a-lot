import { withOccurrenceKeys } from "../_lib/product-view";

// Nutrition facts for edible products, as a simple two-column table.
// Row headers carry the labels so screen readers announce "Crude Protein
// (min), 24%" instead of reading two disconnected cells.
export default function NutritionTable({ rows }) {
  // Nothing in the admin form stops two rows sharing a label, so each row
  // is keyed by its label plus which occurrence of that label it is.
  const keyedRows = withOccurrenceKeys(rows, (row) => row.label);
  return (
    <div className="mt-6 bg-white rounded-xl shadow-sm p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-[#2A4A52] mb-3">
        Nutrition Facts
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">
            Nutrition facts, per guaranteed analysis
          </caption>
          <tbody>
            {keyedRows.map((row) => (
              <tr
                key={row.key}
                className="border-b border-gray-100 last:border-0"
              >
                <th
                  scope="row"
                  className="py-2 pr-4 text-left font-medium text-gray-700"
                >
                  {row.label}
                </th>
                <td className="py-2 text-right text-[#2A4A52] whitespace-nowrap">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
