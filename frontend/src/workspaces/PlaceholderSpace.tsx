type PlaceholderSpaceProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PlaceholderSpace({ eyebrow, title, description }: PlaceholderSpaceProps) {
  return (
    <main className="workspace-main workspace-mode-space placeholder-space">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  );
}
