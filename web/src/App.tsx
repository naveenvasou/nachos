import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Focus from './pages/Focus';
import Strategy from './pages/Strategy';

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/focus" element={<Focus />} />
        <Route path="/strategy" element={<Strategy />} />
      </Routes>
    </div>
  );
}
