import { Link } from 'react-router';
import { useContent } from '../api/content';

export default function HomePage() {
  const { data } = useContent();
  const p = data.profile;
  return (
    <section className="wrap section">
      <p className="muted">{p.hello}</p>
      <h1>{p.headline} <span className="grad">{p.rotating[0]}</span></h1>
      <p className="lead"><strong>{p.intro}</strong> {p.introRest}</p>
      <div className="row">
        <Link className="btn primary" to="/services">Request my services</Link>
        <Link className="btn" to="/about">Get to know me</Link>
      </div>
      <p className="phase-note">Phase 1 placeholder. The full home page arrives in Phase 4.</p>
    </section>
  );
}
