import '../css/app.css';
import '@fontsource/figtree/300.css';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/figtree/800.css';
import '@fontsource/figtree/900.css';
import '@fontsource/figtree/300-italic.css';
import '@fontsource/figtree/400-italic.css';
import '@fontsource/figtree/500-italic.css';
import '@fontsource/figtree/600-italic.css';
import '@fontsource/figtree/700-italic.css';
import '@fontsource/figtree/800-italic.css';
import '@fontsource/figtree/900-italic.css';

import { createInertiaApp } from '@inertiajs/react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';

createInertiaApp({
  title: (title) => title ? `${title} - NiyAI ELMS` : 'NiyAI ELMS',
  resolve: (name) => {
    const pages = import.meta.glob<{ default: ComponentType }>('./Pages/**/*.tsx', { eager: true });
    return pages[`./Pages/${name}.tsx`];
  },
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />);
  },
});
