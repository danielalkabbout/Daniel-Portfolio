import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="page-center">
      <h1>Page not found</h1>
      <p className="muted">This address doesn't match any page on the site.</p>
      <Link className="btn" to="/">Back to home</Link>
    </div>
  );
}
