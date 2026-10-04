import { useContent } from '../api/content';

export default function ExperiencePage() {
  const { data } = useContent();
  const roles = [...data.experience].sort((a, b) => b.start.localeCompare(a.start));
  return (
    <section className="wrap section">
      <h1>Experience</h1>
      <ul className="list">
        {roles.map((r) => (
          <li key={r.id}><strong>{r.title}</strong> <span className="muted">{r.org}, {r.start} to {r.milestone ? '' : r.end ?? 'present'}</span></li>
        ))}
      </ul>
    </section>
  );
}
