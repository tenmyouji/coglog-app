import { Route, Routes } from 'react-router-dom';
import { Showcase } from './routes/Showcase';
import { Experiment } from './routes/Experiment';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Showcase />} />
      <Route path="/experiment" element={<Experiment />} />
    </Routes>
  );
}
