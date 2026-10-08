import type React from 'react';
import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { ErrorPage } from './ErrorPage';
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';

// The home page ships in the first download; every other page loads when it is first visited.
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', lazy: page(() => import('../pages/AboutPage')) },
      { path: 'experience', lazy: page(() => import('../pages/ExperiencePage')) },
      { path: 'projects', lazy: page(() => import('../pages/ProjectsPage')) },
      { path: 'projects/:projectId', lazy: page(() => import('../pages/ProjectsPage')) },
      { path: 'services', lazy: page(() => import('../pages/ServicesPage')) },
      { path: 'cv', lazy: page(() => import('../pages/CvPage')) },
      // The studio is only for the owner.
      { path: 'admin/*', lazy: page(() => import('../pages/AdminPage')) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
