import "./App.css";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import UploadPage from "./pages/UploadPage";

function RootLayout() {
  return <Outlet />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<Navigate to="/auth" replace />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="upload" element={<UploadPage />} />
      </Route>
    </Routes>
  );
}

export default App;
