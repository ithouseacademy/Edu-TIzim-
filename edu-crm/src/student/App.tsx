import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import BottomNav from "./components/BottomNav"
import SideDrawer from "./components/SideDrawer"
import { DrawerProvider } from "./context/DrawerContext"
import LoginPhone from "./pages/LoginPhone"
import VerifyCode from "./pages/VerifyCode"
import SetPassword from "./pages/SetPassword"
import PasswordLogin from "./pages/PasswordLogin"
import Home from "./pages/Home"
import Schedule from "./pages/Schedule"
import Homework from "./pages/Homework"
import Notifications from "./pages/Notifications"
import Messages from "./pages/Messages"
import Profile from "./pages/Profile"
import LessonDetail from "./pages/LessonDetail"
import AttendanceHistory from "./pages/AttendanceHistory"

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("student_token")
  if (!token) return <Navigate to="/" replace />
  return (
    <>
      {children}
      <BottomNav />
    </>
  )
}

export default function StudentApp() {
  return (
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
              <ProtectedLayout>
                <Home />
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
            path="/profile"
            element={
              <ProtectedLayout>
                <Profile />
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
  )
}
