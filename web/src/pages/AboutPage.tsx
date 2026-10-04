import { useContent } from '../api/content';

export default function AboutPage() {
  const { data } = useContent();
  return (
    <section className="wrap section">
      <h1>About</h1>
      <ul className="list">
        {data.skills.map((c) => (
          <li key={c.name}><strong>{c.name}</strong> <span className="muted">{c.items.length} skills</span></li>
        ))}
      </ul>
    </section>
  );
}
