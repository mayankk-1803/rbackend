import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Tester } from './pages/Tester';
import { Transactions } from './pages/Transactions';
import { Alerts } from './pages/Alerts';
import { Providers } from './pages/Providers';

function App() {
  return (
    <BrowserRouter>
      <Toaster 
        position="top-right" 
        toastOptions={{ 
          style: { 
            background: "#111827", 
            color: "#fff", 
            fontSize: "14px", 
            borderRadius: "6px" 
          } 
        }} 
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tester" element={<Tester />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="providers" element={<Providers />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
