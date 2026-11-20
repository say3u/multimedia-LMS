import { Routes, Route, Navigate } from 'react-router-dom'
import Home      from './pages/Home.jsx'
import Login     from './pages/Login.jsx'
import Register  from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import About     from './pages/About.jsx'
import GamePage  from './pages/GamePage.jsx'
import Browse    from './pages/Browse.jsx'
import SubmitGame from './pages/SubmitGame.jsx'
import Feed      from './pages/Feed.jsx'
import Profile   from './pages/Profile.jsx'

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
      {/* phase 2 pages */}
      <Route path="/browse"         element={<PrivateRoute><Browse /></PrivateRoute>} />
      <Route path="/games/new"      element={<PrivateRoute><SubmitGame /></PrivateRoute>} />
      <Route path="/games/:id/edit" element={<PrivateRoute><SubmitGame /></PrivateRoute>} />
      <Route path="/games/:id"      element={<PrivateRoute><GamePage /></PrivateRoute>} />
      <Route path="/feed"           element={<PrivateRoute><Feed /></PrivateRoute>} />
      <Route path="/u/:username"    element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  )
}
