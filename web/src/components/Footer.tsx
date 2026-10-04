import { useContent } from '../api/content';

const YEAR = new Date().getFullYear();

export function Footer() {
  const { data } = useContent();
  return (
    <footer className="site-footer">
      <div className="wrap footer-row">
        <span>© {YEAR} Daniel Al Kabbout</span>
        <a href={`mailto:${data.profile.email}`}>{data.profile.email}</a>
      </div>
    </footer>
  );
}
