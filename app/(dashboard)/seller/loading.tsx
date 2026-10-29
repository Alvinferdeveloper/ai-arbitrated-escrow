export default function SellerLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[640px] px-4 pb-20 pt-6 md:px-6"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading the seller view</span>
      <div aria-hidden="true" className="h-4 w-28 rounded-sm bg-kraft" />
      <div aria-hidden="true" className="mt-4 h-8 w-40 rounded-sm bg-kraft" />
      <div aria-hidden="true" className="mt-2 h-4 w-2/3 rounded-sm bg-kraft" />
      <div aria-hidden="true" className="mt-8 space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="h-20 rounded-md bg-kraft" />
          <div className="h-20 rounded-md bg-kraft" />
        </div>
        <div className="h-20 rounded-md bg-kraft" />
        <div className="h-32 rounded-md bg-kraft" />
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="h-20 rounded-md bg-kraft" />
          <div className="h-20 rounded-md bg-kraft" />
        </div>
        <div className="h-12 w-40 rounded-md bg-kraft" />
      </div>
    </div>
  );
}
