import { Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import Layout from '@/components/Layout.tsx';
import RequireAuth from '@/components/RequireAuth.tsx';
import {
  ChatPage,
  Credits,
  ForgotPassword,
  History,
  HistoryDetail,
  Home,
  Login,
  Profile,
  QuickStart,
  Register,
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
        element: lazyPage(
          <RequireAuth>
            <QuickStart />
          </RequireAuth>
        ),
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
        path: 'history',
        element: lazyPage(
          <RequireAuth>
            <History />
          </RequireAuth>
        ),
      },
      {
        path: 'history/:conversationId',
        element: lazyPage(
          <RequireAuth>
            <HistoryDetail />
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
