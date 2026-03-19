import "./App.css";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import UploadPage from "./pages/UploadPage";
import NavMenu from "./components/NavMenu";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import Dashboard from "./pages/Dashboard";

function RootLayout() {
  const location = useLocation();
  const showNav = location.pathname !== "/auth";

  return (
    <>
      {showNav && <NavMenu />}
      <Outlet />
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<Navigate to="/auth" replace />} />
        <Route path="auth" element={<AuthPage />} />
        {/* Routes protégées */}
        <Route element={<RequireAuth />}>
          <Route path="upload" element={<UploadPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="dashboard" element={<Dashboard />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;