import { createBrowserRouter } from 'react-router-dom';
import Layout from '@/components/Layout.tsx';
import RequireAuth from '@/components/RequireAuth.tsx';
import Home from '@/pages/Home.tsx';
import QuickStart from '@/pages/QuickStart.tsx';
import ChatPage from '@/pages/ChatPage.tsx';
import Login from '@/pages/Login.tsx';
import Register from '@/pages/Register.tsx';
import ForgotPassword from '@/pages/ForgotPassword.tsx';
import Profile from '@/pages/Profile.tsx';
import History from '@/pages/History.tsx';
import HistoryDetail from '@/pages/HistoryDetail.tsx';
import Credits from '@/pages/Credits.tsx';

const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'login',
        element: <Login />,
      },
      {
        path: 'register',
        element: <Register />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPassword />,
      },
      {
        path: 'quick-start',
        element: (
          <RequireAuth>
            <QuickStart />
          </RequireAuth>
        ),
      },
      {
        path: 'chat',
        element: (
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        ),
      },
      {
        path: 'history',
        element: (
          <RequireAuth>
            <History />
          </RequireAuth>
        ),
      },
      {
        path: 'history/:conversationId',
        element: (
          <RequireAuth>
            <HistoryDetail />
          </RequireAuth>
        ),
      },
      {
        path: 'credits',
        element: (
          <RequireAuth>
            <Credits />
          </RequireAuth>
        ),
      },
      {
        path: 'profile',
        element: (
          <RequireAuth>
            <Profile />
          </RequireAuth>
        ),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
