import { Routes, Route } from 'react-router';
import { GameCanvas } from '@/components/game/GameCanvas';
import { ErrorBoundary } from '@/components/game/ErrorBoundary';
import AdminPage from '@/pages/AdminPage';
import EffectLabPage from '@/pages/effect-lab/EffectLabPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={
        <div className="w-screen h-screen bg-black overflow-hidden">
          <ErrorBoundary>
            <GameCanvas />
          </ErrorBoundary>
        </div>
      } />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/effect-lab" element={<EffectLabPage />} />
    </Routes>
  );
}

export default App;
