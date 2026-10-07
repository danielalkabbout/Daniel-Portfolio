import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { ErrorPage } from './ErrorPage';
import HomePage from '../pages/HomePage';
import AboutPage from '../pages/AboutPage';
import ExperiencePage from '../pages/ExperiencePage';
import ProjectsPage from '../pages/ProjectsPage';
import ServicesPage from '../pages/ServicesPage';
import NotFoundPage from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'experience', element: <ExperiencePage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:projectId', element: <ProjectsPage /> },
      { path: 'services', element: <ServicesPage /> },
      // The studio is only for the owner, so its code loads on demand.
      { path: 'admin/*', lazy: async () => ({ Component: (await import('../pages/AdminPage')).default }) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
