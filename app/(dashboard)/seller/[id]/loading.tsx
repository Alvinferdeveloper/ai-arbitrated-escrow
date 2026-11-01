export default function SellerDealLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[640px] space-y-8 px-4 pb-20 pt-6 md:px-6"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading the deal</span>
      <div aria-hidden="true" className="h-4 w-36 rounded-sm bg-kraft" />
      <div aria-hidden="true" className="h-44 rounded-lg border border-rule-line bg-kraft" />
      <div aria-hidden="true" className="space-y-3">
        <div className="h-8 w-2/3 rounded-sm bg-kraft" />
        <div className="h-4 w-1/2 rounded-sm bg-kraft" />
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-72 rounded-lg border border-rule-line bg-kraft" />
        ))}
      </div>
    </div>
  );
}
