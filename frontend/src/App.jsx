import { Routes, Route, Navigate } from 'react-router-dom'
import Home      from './pages/Home.jsx'
import Login     from './pages/Login.jsx'
import Register  from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import About     from './pages/About.jsx'

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<Home />} />
      <Route path="/about"     element={<About />} />
      <Route path="/login"     element={<Login />} />
      <Route path="/register"  element={<Register />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  )
}
