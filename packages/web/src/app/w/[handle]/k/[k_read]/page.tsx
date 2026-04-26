/**
 * Public-form view per visual_direction_v1.md §10.5.
 * Server has K_read in path; can render the body server-side.
 * Implementation in Phase G.
 */

export default async function PublicFormView({
  params,
}: {
  params: Promise<{ handle: string; k_read: string }>;
}) {
  const { handle } = await params;
  return (
    <main style={{ padding: "var(--spacing-12)", color: "var(--color-ink-muted)" }}>
      <p>public-form view of {handle} — not implemented yet</p>
    </main>
  );
}
