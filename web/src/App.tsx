import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { RequireAuth } from "./components/RequireAuth";
import { CatalogPage } from "./pages/CatalogPage";
import { BookDetailPage } from "./pages/BookDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { MyLoansPage } from "./pages/MyLoansPage";
import { StaffDeskPage } from "./pages/StaffDeskPage";
import { BorrowersPage } from "./pages/BorrowersPage";
import { AddBorrowerPage } from "./pages/AddBorrowerPage";
import { BorrowerDetailPage } from "./pages/BorrowerDetailPage";
import { AddBookPage } from "./pages/AddBookPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <>
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route
            path="/books/new"
            element={
              <RequireAuth role="STAFF">
                <AddBookPage />
              </RequireAuth>
            }
          />
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
          <Route
            path="/borrowers"
            element={
              <RequireAuth role="STAFF">
                <BorrowersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/borrowers/new"
            element={
              <RequireAuth role="STAFF">
                <AddBorrowerPage />
              </RequireAuth>
            }
          />
          <Route
            path="/borrowers/:id"
            element={
              <RequireAuth role="STAFF">
                <BorrowerDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth role="STAFF">
                <SettingsPage />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </>
  );
}
