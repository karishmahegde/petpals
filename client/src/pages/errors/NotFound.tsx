import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div>
      <p>404 Not Found, bad request.</p>
      <Link to="/">Return home</Link>
    </div>
  );
};

export default NotFound;
