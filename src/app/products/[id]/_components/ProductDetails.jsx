import NutritionTable from "./NutritionTable";

// The category's admin-set toggle decides the flavor: an always-visible
// Ingredients section, or an Item Details section that only appears when
// filled in. The nutrition panel shares the same edible-category gate,
// so a product moved to a non-food category doesn't keep showing one
// (its rows are preserved, just hidden).
export default function ProductDetails({
  showsIngredients,
  itemDetails,
  nutritionFacts,
}) {
  return (
    <>
      {(showsIngredients || itemDetails) && (
        <div className="mt-8 bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-[#2A4A52] mb-2">
            {showsIngredients ? "Ingredients" : "Item Details"}
          </h2>
          {itemDetails ? (
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">
              {itemDetails}
            </p>
          ) : (
            <p className="text-gray-600 text-sm">
              Full ingredient list coming soon — ask us at the booth or email
              info@barks-a-lot.com.
            </p>
          )}
        </div>
      )}

      {showsIngredients && nutritionFacts?.length > 0 && (
        <NutritionTable rows={nutritionFacts} />
      )}
    </>
  );
}
