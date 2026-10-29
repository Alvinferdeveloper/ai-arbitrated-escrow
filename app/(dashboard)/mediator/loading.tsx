export default function MediatorQueueLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Loading the mediation queue</span>
      <div aria-hidden="true" className="space-y-3">
        <div className="h-3 w-24 rounded-sm bg-kraft" />
        <div className="h-8 w-2/3 rounded-sm bg-kraft" />
        <div className="h-4 w-full max-w-[52ch] rounded-sm bg-kraft" />
      </div>
      <div aria-hidden="true" className="h-11 border-b border-rule-line bg-kraft" />
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-lg border border-rule-line bg-sheet"
      >
        <div className="h-11 border-b border-rule-line bg-kraft" />
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="flex h-16 items-center gap-4 border-b border-rule-line px-4 last:border-b-0"
          >
            <div className="h-4 flex-1 rounded-sm bg-kraft" />
            <div className="h-4 w-20 rounded-sm bg-kraft" />
            <div className="h-4 w-28 rounded-sm bg-kraft" />
          </div>
        ))}
      </div>
    </div>
  );
}
