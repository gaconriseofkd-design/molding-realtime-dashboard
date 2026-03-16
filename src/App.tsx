import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useLanguage } from './contexts/LanguageContext';
import { Layout } from './components/Layout';
import { LiveDashboard } from './components/LiveDashboard';
import { ScanInOut } from './components/ScanInOut';
import { MoldDatabase } from './components/MoldDatabase';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LiveDashboard />} />
          <Route path="scan" element={<ScanInOut />} />
          <Route path="database" element={<MoldDatabase />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
