import { Routes, Route } from 'react-router';
import { GameCanvas } from '@/components/game/GameCanvas';
import AdminPage from '@/pages/AdminPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={
        <div className="w-screen h-screen bg-black overflow-hidden">
          <GameCanvas />
        </div>
      } />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}

export default App;
