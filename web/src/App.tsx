import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { RequireAuth } from "./components/RequireAuth";
import { CatalogPage } from "./pages/CatalogPage";
import { BookDetailPage } from "./pages/BookDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { MyLoansPage } from "./pages/MyLoansPage";
import { StaffDeskPage } from "./pages/StaffDeskPage";

export function App() {
  return (
    <>
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/books/:id" element={<BookDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/loans"
            element={
              <RequireAuth>
                <MyLoansPage />
              </RequireAuth>
            }
          />
          <Route
            path="/desk"
            element={
              <RequireAuth role="STAFF">
                <StaffDeskPage />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </>
  );
}
