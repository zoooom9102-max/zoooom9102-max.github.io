import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/layout/SiteLayout";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";

function EvaluationProjectRedirect() {
  useEffect(() => {
    window.location.replace("/work/evaluation-labeling/");
  }, []);

  return null;
}

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="profile" element={<Navigate to="/#portfolio" replace />} />
        <Route path="timeline" element={<Navigate to="/#timeline" replace />} />
        <Route path="skills" element={<Navigate to="/#skills" replace />} />
        <Route path="projects" element={<Navigate to="/#projects" replace />} />
        <Route path="projects/eval-method" element={<EvaluationProjectRedirect />} />
        <Route path="contact" element={<Navigate to="/#contact" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
