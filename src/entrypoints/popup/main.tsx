import { createRoot } from 'react-dom/client';
import { applyDocumentLocale } from '@/core/i18n';
import '@/ui/base.css';
import './style.css';
import { App } from './App';

applyDocumentLocale();
createRoot(document.getElementById('root')!).render(<App />);
