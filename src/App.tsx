import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LiveDashboard } from './components/LiveDashboard';
import { ScanInOut } from './components/ScanInOut';
import { MoldDatabase } from './components/MoldDatabase';
import { MachineDatabase } from './components/MachineDatabase';
import { MoldShelfDatabase } from './components/MoldShelfDatabase';
import { UserManagement } from './components/UserManagement';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LiveDashboard />} />
            <Route path="scan" element={<ScanInOut />} />
            <Route path="shelves" element={<MoldShelfDatabase />} />
            <Route path="database" element={<MoldDatabase />} />
            <Route path="machines" element={<MachineDatabase />} />
            <Route path="users" element={<UserManagement />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
