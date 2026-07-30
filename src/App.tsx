import { Route, Routes } from 'react-router-dom';
import { Launch } from './routes/Launch';
import { Experiment } from './routes/Experiment';
import { Debrief } from './routes/Debrief';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Launch />} />
      <Route path="/experiment" element={<Experiment />} />
      <Route path="/tutorial" element={<Experiment tutorial />} />
      <Route path="/debrief" element={<Debrief />} />
    </Routes>
  );
}
