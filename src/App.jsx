import { useState } from 'react';
import RecoveryView from './components/RecoveryView.jsx';
import PlanView from './components/PlanView.jsx';
import { INK, SURFACE2, BORDER, PAPER, MUTE, GREEN, DISPLAY } from './lib/theme.js';

export default function App() {
  const [view, setView] = useState('recovery');

  return (
    <div style={{ background: INK, minHeight: '100vh', color: PAPER, fontFamily: DISPLAY }}>
      <div style={{ display: 'flex', background: SURFACE2, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 200, paddingTop: 'env(safe-area-inset-top)' }}>
        <button
          onClick={() => setView('recovery')}
          style={tabStyle(view === 'recovery')}
        >
          Recovery
        </button>
        <button
          onClick={() => setView('plan')}
          style={tabStyle(view === 'plan')}
        >
          Plan
        </button>
      </div>

      {view === 'recovery' ? <RecoveryView /> : <PlanView />}
    </div>
  );
}

function tabStyle(active) {
  return {
    flex: 1,
    padding: '14px 0',
    border: 'none',
    background: 'transparent',
    color: active ? GREEN : MUTE,
    fontFamily: DISPLAY,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    borderBottom: active ? `2px solid ${GREEN}` : '2px solid transparent',
  };
}
