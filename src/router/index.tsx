import { Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout.tsx';
import RequireAuth from '@/components/RequireAuth.tsx';
import {
  ChatPage,
  Credits,
  ForgotPassword,
  Gallery,
  History,
  Home,
  Login,
  Profile,
  Register,
  WorkDetail,
  WorksPage,
} from './lazyPages';

function lazyPage(element: ReactNode) {
  return <Suspense fallback={<div aria-live="polite">页面加载中...</div>}>{element}</Suspense>;
}

const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: lazyPage(<Home />),
      },
      {
        path: 'login',
        element: lazyPage(<Login />),
      },
      {
        path: 'register',
        element: lazyPage(<Register />),
      },
      {
        path: 'forgot-password',
        element: lazyPage(<ForgotPassword />),
      },
      {
        path: 'quick-start',
        element: <Navigate to="/chat" replace />,
      },
      {
        path: 'chat',
        element: lazyPage(
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        ),
      },
      {
        path: 'gallery',
        element: lazyPage(<Gallery />),
      },
      {
        path: 'works',
        element: lazyPage(
          <RequireAuth>
            <WorksPage />
          </RequireAuth>
        ),
      },
      {
        path: 'works/:id',
        element: lazyPage(<WorkDetail />),
      },
      {
        path: 'history',
        element: lazyPage(
          <RequireAuth>
            <History />
          </RequireAuth>
        ),
      },
      {
        path: 'credits',
        element: lazyPage(
          <RequireAuth>
            <Credits />
          </RequireAuth>
        ),
      },
      {
        path: 'profile',
        element: lazyPage(
          <RequireAuth>
            <Profile />
          </RequireAuth>
        ),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
