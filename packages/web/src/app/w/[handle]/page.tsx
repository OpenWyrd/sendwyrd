/**
 * Fragment-form view per visual_direction_v1.md §10.4.
 * Server returns the HTML shell; client decrypts via K_read in URL fragment.
 * Implementation in Phase G.
 */

export default async function FragmentFormView({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return (
    <main style={{ padding: "var(--spacing-12)", color: "var(--color-ink-muted)" }}>
      <p>fragment-form view of {handle} — not implemented yet</p>
    </main>
  );
}
