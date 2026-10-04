import { useParams } from 'react-router';
import { useContent } from '../api/content';

export default function ProjectsPage() {
  const { data } = useContent();
  const { projectId } = useParams();
  const projects = data.projects.filter((p) => p.visible);
  return (
    <section className="wrap section">
      <h1>Projects</h1>
      {projectId && <p className="muted">Deep link to: {projectId}</p>}
      <ul className="list">
        {projects.map((p) => (
          <li key={p.id} id={`pj-${p.id}`}><strong>{p.title}</strong> <span className="muted">{p.kind}</span></li>
        ))}
      </ul>
    </section>
  );
}
