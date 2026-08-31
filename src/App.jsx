import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Voting from "./pages/Voting";
import VoteConfirm from "./pages/VoteConfirm";
import VoteSuccess from "./pages/VoteSuccess";
import AdminLogin from "./pages/AdminLogin";
import Admin from "./pages/Admin";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/vote" element={<Voting />} />
      <Route path="/voting" element={<Voting />} />
      <Route path="/confirm" element={<VoteConfirm />} />
      <Route path="/vote-confirm" element={<VoteConfirm />} />
      <Route path="/success" element={<VoteSuccess />} />
      <Route path="/vote-success" element={<VoteSuccess />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

export default App;
