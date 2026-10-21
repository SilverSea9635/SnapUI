import { lazy } from 'react';

export const Home = lazy(() => import('@/pages/Home.tsx'));
export const ChatPage = lazy(() => import('@/pages/ChatPage.tsx'));
export const Login = lazy(() => import('@/pages/Login.tsx'));
export const Register = lazy(() => import('@/pages/Register.tsx'));
export const ForgotPassword = lazy(() => import('@/pages/ForgotPassword.tsx'));
export const Profile = lazy(() => import('@/pages/Profile.tsx'));
export const History = lazy(() => import('@/pages/History.tsx'));
export const Credits = lazy(() => import('@/pages/Credits.tsx'));
export const Gallery = lazy(() => import('@/pages/Gallery.tsx'));
export const WorksPage = lazy(() => import('@/pages/WorksPage.tsx'));
export const WorkDetail = lazy(() => import('@/pages/WorkDetail.tsx'));
