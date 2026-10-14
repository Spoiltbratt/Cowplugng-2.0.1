import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/AuthContext';
import { BrandingProvider } from './lib/BrandingContext';
import { PwaProvider } from './lib/PwaContext';

// Global error tracking for better debugging
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error || event.message);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrandingProvider>
        <PwaProvider>
          <App />
        </PwaProvider>
      </BrandingProvider>
    </AuthProvider>
  </StrictMode>,
);

