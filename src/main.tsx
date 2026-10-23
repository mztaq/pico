import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { PicoTelemetry } from './telemetry/PicoTelemetry';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <PicoTelemetry />
  </React.StrictMode>,
);
