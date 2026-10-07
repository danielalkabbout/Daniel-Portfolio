import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export function ErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Something broke while loading this page.';
  return (
    <div className="page-center">
      <h1>That didn't load</h1>
      <p>{message}</p>
      <Link className="btn primary" to="/">
        Back to home
      </Link>
    </div>
  );
}
