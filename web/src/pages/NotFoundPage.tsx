import { Link } from 'react-router';
import { Page } from '../components/Page';

export default function NotFoundPage() {
  return (
    <Page name="notfound" title="Page not found, Daniel Al Kabbout">
      <div className="page-center">
        <h1 tabIndex={-1}>Page not found</h1>
        <p>This address doesn't match any page on the site.</p>
        <Link className="btn primary" to="/">
          Back to home
        </Link>
      </div>
    </Page>
  );
}
