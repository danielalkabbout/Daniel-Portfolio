import { useContent } from '../api/content';

export default function ServicesPage() {
  const { data } = useContent();
  return (
    <section className="wrap section">
      <h1>Services</h1>
      <ul className="list">
        {data.services.filter((s) => s.visible).map((s) => (
          <li key={s.id}><strong>{s.title}</strong> <span className="muted">{s.desc}</span></li>
        ))}
      </ul>
    </section>
  );
}
