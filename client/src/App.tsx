import "./App.css";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import UploadPage from "./pages/UploadPage";
import NavMenu from "./components/NavMenu";
import RequireAuth from "./components/RequireAuth";
import Dashboard from "./Dashboard";

function RootLayout() {
  const location = useLocation();
  const showNav = location.pathname !== "/auth";


      <div className="ticks"></div>
      <section id="spacer"></section>
>>>>>>> origin/Killian
  );
}

<<<<<<< HEAD
function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<Navigate to="/auth" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
        <Route path="auth" element={<AuthPage />} />
        {/* Routes protégées */}
        <Route element={<RequireAuth />}>
          <Route path="upload" element={<UploadPage />} />
        </Route>
      </Route>
    </Routes>
=======
export default App
>>>>>>> origin/Killian
