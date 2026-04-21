import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Tester } from './pages/Tester';
import { Transactions } from './pages/Transactions';
import { Alerts } from './pages/Alerts';
import { Providers } from './pages/Providers';

function App() {
  return (
    <BrowserRouter>
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
