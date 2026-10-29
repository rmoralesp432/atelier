import React from 'react';
import ReactDOM from 'react-dom/client';
import WorkspaceHost from './projects/WorkspaceHost';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { setKernelWasmUrl } from './geometry/kernel';
setKernelWasmUrl(wasmUrl);
import './styles.css';
import './studio/interface.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkspaceHost />
  </React.StrictMode>,
);
