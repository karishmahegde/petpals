import { Link } from "react-router-dom";
import { FaFacebook, FaInstagram, FaXTwitter } from "react-icons/fa6";
import logoFooter from "../../static/assets/images/branding/logoFooter.png";

const socialLinks = [
  { href: "https://www.facebook.com/", label: "Facebook", Icon: FaFacebook },
  { href: "https://www.instagram.com/", label: "Instagram", Icon: FaInstagram },
  { href: "https://x.com/", label: "X", Icon: FaXTwitter },
];

const Footer = () => {
  return (
    <footer className="mt-auto bg-rose-dark font-body text-white p-12">
      <div className="lg:flex">
        <div className="lg:w-1/3 p-3 flex flex-col items-center justify-center text-center">
          <h2 className="font-display text-2xl mb-4">Know More</h2>
          <p>
            {/* TODO: point to real FAQs page once it's built later this sprint */}
            <a href="#">FAQs</a>
          </p>
          <p>
            {/* TODO: point to real Privacy Policy page once it's built later this sprint */}
            <a href="#">Privacy Policy</a>
          </p>
          <p>
            <Link to="/about#testimonials">Testimonials</Link>
          </p>
          <p>
            {/* TODO: point to real Support page once it's built later this sprint */}
            <a href="#">Support</a>
          </p>
          <p>
            {/* TODO: point to real Terms of Service page once it's built later this sprint */}
            <a href="#">Terms of Service</a>
          </p>
        </div>

        <div className="lg:w-1/3 border-y-2 lg:border-x-2 lg:border-y-0 border-white p-3 flex flex-col items-center justify-center text-center">
          <img src={logoFooter} alt="PetPals" className="mb-3 w-4/5" />
          <p className="text-black text-sm mb-3">
            41 Manor Road
            <br /> Saint Augustine, GA 32084
          </p>
          <p className="text-black text-sm">
            +1 (706) 342-8631 <br /> support@petpals.com
          </p>
        </div>

        <div className="lg:w-1/3 p-3 flex flex-col items-center justify-center">
          <h2 className="font-display text-2xl mb-1">Follow us:</h2>
          <div className="flex space-x-2 justify-center">
            {socialLinks.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="w-12 h-12 border-2 border-white rounded-full flex items-center justify-center text-white"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
