import Header from "./Header";
import Footer from "./Footer";

export function PageContainer({ children, className = "" }) {
  return (
    <div className="app-wrapper">
      <Header />
      <main className={`page-container ${className}`}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

export default PageContainer;
