import { ArrowLeft } from "lucide-react";
import { ActionButton } from "../components/ui/ActionButton";

export function NotFoundPage() {
  return (
    <section className="not-found page-container">
      <p>ERROR · 404</p>
      <h1>页面未找到</h1>
      <span>The requested route is outside this system.</span>
      <ActionButton to="/">
        <ArrowLeft size={18} /> 返回首页
      </ActionButton>
    </section>
  );
}
