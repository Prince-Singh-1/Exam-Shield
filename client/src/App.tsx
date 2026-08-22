import { Navigate, Route, Routes } from 'react-router-dom';
import { SakuraPetals } from './components/SakuraPetals';
import { useAuth } from './context/AuthContext';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { GoogleAuth } from './pages/GoogleAuth';
import { Dashboard } from './pages/Dashboard';
import { ExamBuilder } from './pages/ExamBuilder';
import { OnlineExam } from './pages/OnlineExam';
import { ProctorDashboard } from './pages/ProctorDashboard';

function Protected({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <div className="relative min-h-screen">
      <SakuraPetals />
      <div className="relative z-10">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/google-auth" element={<GoogleAuth />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/exams/new" element={<Protected><ExamBuilder /></Protected>} />
          <Route path="/proctor" element={<Protected><ProctorDashboard /></Protected>} />
          <Route path="/exam/:examId" element={<Protected><OnlineExam /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
