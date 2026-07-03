import { Outlet } from "react-router-dom";
import Navbar from "../components/layout/Navbar";

const PublicLayout = () => {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </>
  );
};

export default PublicLayout;
