import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { bootstrap } from '@/app/bootstrap';
import './styles/index.css';

bootstrap();

const root = document.getElementById('root');
if (!root) {
  throw new Error('missing #root element');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
