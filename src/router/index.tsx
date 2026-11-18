import type { ComponentType } from 'react';
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

function lazyPage(
  load: () => Promise<{ default: ComponentType }>,
  requireAuth = false
) {
  // 交给路由等待 chunk，切页时保留当前内容，避免 Suspense fallback 闪烁。
  return async () => {
    const { default: Page } = await load();
    return {
      element: requireAuth ? <RequireAuth><Page /></RequireAuth> : <Page />,
    };
  };
}

const routes = [
  {
    path: '/',
    element: <Layout />,
    // 首次直达懒加载路由时先显示布局，避免整个应用空白。
    HydrateFallback: Layout,
    children: [
      {
        index: true,
        lazy: lazyPage(Home),
      },
      {
        path: 'login',
        lazy: lazyPage(Login),
      },
      {
        path: 'register',
        lazy: lazyPage(Register),
      },
      {
        path: 'forgot-password',
        lazy: lazyPage(ForgotPassword),
      },
      {
        path: 'quick-start',
        element: (
          <Navigate
            to="/chat"
            replace
          />
        ),
      },
      {
        path: 'chat',
        lazy: lazyPage(ChatPage, true),
      },
      {
        path: 'gallery',
        lazy: lazyPage(Gallery),
      },
      {
        path: 'works',
        lazy: lazyPage(WorksPage, true),
      },
      {
        path: 'works/:id',
        lazy: lazyPage(WorkDetail),
      },
      {
        path: 'history',
        lazy: lazyPage(History, true),
      },
      {
        path: 'credits',
        lazy: lazyPage(Credits, true),
      },
      {
        path: 'profile',
        lazy: lazyPage(Profile, true),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
