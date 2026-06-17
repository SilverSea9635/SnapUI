import { RouterProvider } from 'react-router-dom';
import { router } from '@/router/index.tsx';
import Toast from '@/components/Toast.tsx';

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toast />
    </>
  );
}

export default App;