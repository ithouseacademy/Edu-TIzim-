import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import BottomNav from "./components/BottomNav"
import SideDrawer from "./components/SideDrawer"
import { DrawerProvider } from "./context/DrawerContext"
import { AppSettingsProvider } from "./AppSettings"
import LoginPhone from "./pages/LoginPhone"
import VerifyCode from "./pages/VerifyCode"
import SetPassword from "./pages/SetPassword"
import PasswordLogin from "./pages/PasswordLogin"
import Home from "./pages/Home"
import NewsDetail from "./pages/NewsDetail"
import Schedule from "./pages/Schedule"
import Homework from "./pages/Homework"
import Notifications from "./pages/Notifications"
import Messages from "./pages/Messages"
import Profile from "./pages/Profile"
import LessonDetail from "./pages/LessonDetail"
import AttendanceHistory from "./pages/AttendanceHistory"
import TransactionsPage from "./pages/TransactionsPage"
import GroupsPage from "./pages/GroupsPage"
import BalancePage from "./pages/BalancePage"
import CoinsPage from "./pages/Coins"
import ShopPage from "./pages/Shop"
import Suggestions from "./pages/Suggestions"
import FeedbackHistory from "./pages/FeedbackHistory"
import SettingsPage from "./pages/SettingsPage"
import ProfileInfo from "./pages/ProfileInfo"

function ProtectedLayout({ children, showNav = true }: { children: React.ReactNode; showNav?: boolean }) {
  const token = localStorage.getItem("student_token")
  if (!token) return <Navigate to="/" replace />
  return (
    <>
      {children}
      {showNav && <BottomNav />}
    </>
  )
}

export default function StudentApp() {
  return (
    <AppSettingsProvider>
      <DrawerProvider>
        <BrowserRouter>
          <SideDrawer />
          <Routes>
            <Route path="/" element={<LoginPhone />} />
          <Route path="/verify-code" element={<VerifyCode />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/password-login" element={<PasswordLogin />} />
          <Route
            path="/home"
            element={
              <ProtectedLayout showNav={false}>
                <Home />
              </ProtectedLayout>
            }
          />
          <Route
            path="/news/:id"
            element={
              <ProtectedLayout>
                <NewsDetail />
              </ProtectedLayout>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedLayout>
                <Schedule />
              </ProtectedLayout>
            }
          />
          <Route
            path="/homework"
            element={
              <ProtectedLayout>
                <Homework />
              </ProtectedLayout>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedLayout>
                <Notifications />
              </ProtectedLayout>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedLayout>
                <Messages />
              </ProtectedLayout>
            }
          />
          <Route
            path="/profile/settings/info"
            element={
              <ProtectedLayout showNav={false}>
                <ProfileInfo />
              </ProtectedLayout>
            }
          />
          <Route
            path="/profile/settings"
            element={
              <ProtectedLayout showNav={false}>
                <SettingsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedLayout>
                <Profile />
              </ProtectedLayout>
            }
          />
          <Route
            path="/profile/transactions"
            element={
              <ProtectedLayout>
                <TransactionsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/profile/balance"
            element={
              <ProtectedLayout showNav={false}>
                <BalancePage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/coins"
            element={
              <ProtectedLayout>
                <CoinsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/shop"
            element={
              <ProtectedLayout showNav={false}>
                <ShopPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/profile/groups"
            element={
              <ProtectedLayout>
                <GroupsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/profile/feedback"
            element={
              <ProtectedLayout showNav={false}>
                <Suggestions />
              </ProtectedLayout>
            }
          />
          <Route
            path="/profile/feedback/history"
            element={
              <ProtectedLayout showNav={false}>
                <FeedbackHistory />
              </ProtectedLayout>
            }
          />
          <Route
            path="/lesson/:id"
            element={
              <ProtectedLayout>
                <LessonDetail />
              </ProtectedLayout>
            }
          />
          <Route
            path="/attendance-history"
            element={
              <ProtectedLayout>
                <AttendanceHistory />
              </ProtectedLayout>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </DrawerProvider>
    </AppSettingsProvider>
  )
}
