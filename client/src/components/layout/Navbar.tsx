import { Outlet } from "react-router-dom";

const Navbar = () => {
  return (
    <>
      <nav>
        <span>PetPals</span>
        {/* Nav links, user menu — added in later sprints */}
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
};

export default Navbar;
