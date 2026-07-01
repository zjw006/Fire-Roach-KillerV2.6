import { Routes, Route } from 'react-router';
import { GameCanvas } from '@/components/game/GameCanvas';
import AdminPage from '@/pages/AdminPage';
import TestEngine from '@/pages/TestEngine';

function App() {
  return (
    <Routes>
      <Route path="/" element={
        <div className="w-screen h-screen bg-black overflow-hidden">
          <GameCanvas />
        </div>
      } />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/test-engine" element={<TestEngine />} />
    </Routes>
  );
}

export default App;
